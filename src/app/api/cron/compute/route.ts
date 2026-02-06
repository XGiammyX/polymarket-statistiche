import { query, setEtlState } from "@/lib/db";
import { withCronGuard } from "@/lib/cronGuard";
import type { CronContext, CronResult } from "@/lib/cronGuard";
import {
  THRESHOLDS,
  MIN_N_FOR_FOLLOW,
  LATE_HOURS,
  RECENCY_HALF_LIFE_DAYS,
} from "@/lib/scoring/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 55_000;

async function computeHandler(ctx: CronContext): Promise<CronResult> {
  /* ═══════════════════════════════════════════════════
     STEP 1: Upsert wallet_stats for each threshold [0.15, 0.10, 0.05, 0.02]
     ═══════════════════════════════════════════════════ */
  let updatedWalletStatsRows = 0;

  for (const threshold of THRESHOLDS) {
    const res = await query(
      `INSERT INTO wallet_stats (wallet, threshold, n, wins, expected_wins, variance, alphaz, updated_at)
       SELECT
         t.wallet,
         $1 AS threshold,
         COUNT(*)::int AS n,
         SUM(CASE WHEN t.outcome_index = r.winning_outcome_index THEN 1 ELSE 0 END)::int AS wins,
         SUM(t.price) AS expected_wins,
         SUM(t.price * (1.0 - t.price)) AS variance,
         CASE
           WHEN SUM(t.price * (1.0 - t.price)) > 0
           THEN (SUM(CASE WHEN t.outcome_index = r.winning_outcome_index THEN 1 ELSE 0 END) - SUM(t.price))
                / SQRT(SUM(t.price * (1.0 - t.price)))
           ELSE 0
         END AS alphaz,
         now()
       FROM trades t
       JOIN resolutions r ON r.condition_id = t.condition_id
       WHERE t.side = 'BUY'
         AND t.price <= $1
         AND t.price > 0
       GROUP BY t.wallet
       ON CONFLICT (wallet, threshold) DO UPDATE SET
         n             = EXCLUDED.n,
         wins          = EXCLUDED.wins,
         expected_wins = EXCLUDED.expected_wins,
         variance      = EXCLUDED.variance,
         alphaz        = EXCLUDED.alphaz,
         updated_at    = now()`,
      [threshold]
    );
    updatedWalletStatsRows += res.rowCount ?? 0;

    if (ctx.elapsed() > TIME_BUDGET_MS) break;
  }

  console.log(
    `[compute] rid=${ctx.requestId} wallet_stats upserted=${updatedWalletStatsRows} elapsed=${ctx.elapsed()}ms`
  );

  if (ctx.elapsed() > TIME_BUDGET_MS) {
    const lastComputeAt = new Date().toISOString();
    await setEtlState("last_compute_at", lastComputeAt);
    return {
      status: "partial",
      summary: { updatedWalletStatsRows, updatedWalletProfilesRows: 0, lastComputeAt, stoppedAt: "wallet_stats" },
    };
  }

  /* ═══════════════════════════════════════════════════
     STEP 2: Upsert wallet_profiles using best αZ across all thresholds
     Base CTE widened to price <= 0.15 for hedge/late calcs.
     ═══════════════════════════════════════════════════ */
  const profilesRes = await query(
    `WITH
     base AS (
       SELECT t.wallet, t.condition_id, t.outcome_index, t.price, t.ts, m.end_date
       FROM trades t
       JOIN resolutions r ON r.condition_id = t.condition_id
       JOIN markets m     ON m.condition_id = t.condition_id
       WHERE t.side = 'BUY' AND t.price <= 0.15 AND t.price > 0
     ),
     hedge_cte AS (
       SELECT bt.wallet,
         COUNT(DISTINCT bt.condition_id) FILTER (
           WHERE bt.condition_id IN (
             SELECT b2.condition_id FROM base b2
             WHERE b2.wallet = bt.wallet
             GROUP BY b2.condition_id
             HAVING COUNT(DISTINCT b2.outcome_index) >= $1
           )
         )::double precision / NULLIF(COUNT(DISTINCT bt.condition_id), 0) AS hedge_rate
       FROM base bt GROUP BY bt.wallet
     ),
     late_cte AS (
       SELECT wallet,
         SUM(CASE WHEN end_date IS NOT NULL
           AND EXTRACT(EPOCH FROM (end_date - ts)) / 3600.0 <= $2
           AND EXTRACT(EPOCH FROM (end_date - ts)) >= 0
           THEN 1 ELSE 0 END)::double precision / NULLIF(COUNT(*), 0) AS late_sniping_rate
       FROM base GROUP BY wallet
     ),
     last_cte AS (
       SELECT wallet, MAX(ts) AS last_trade_at FROM trades WHERE side = 'BUY' GROUP BY wallet
     ),
     best_stats AS (
       SELECT DISTINCT ON (wallet) wallet, n AS n_02, alphaz AS alphaz_02
       FROM wallet_stats WHERE n >= 3
       ORDER BY wallet, alphaz DESC
     ),
     combined AS (
       SELECT
         s.wallet,
         COALESCE(s.n_02, 0) AS n_02,
         COALESCE(s.alphaz_02, 0) AS alphaz_02,
         COALESCE(h.hedge_rate, 0) AS hedge_rate,
         COALESCE(l.late_sniping_rate, 0) AS late_sniping_rate,
         lc.last_trade_at,
         LEAST(GREATEST(COALESCE(s.n_02, 0)::double precision / 50.0, 0), 1) AS sample_factor,
         LEAST(GREATEST((COALESCE(s.alphaz_02, 0) + 1.0) / 6.0, 0), 1) AS edge_factor,
         1.0 - COALESCE(h.hedge_rate, 0) AS hedge_penalty,
         1.0 - 0.5 * COALESCE(l.late_sniping_rate, 0) AS late_penalty,
         CASE
           WHEN lc.last_trade_at IS NOT NULL
           THEN EXP(-LN(2.0) * EXTRACT(EPOCH FROM (now() - lc.last_trade_at)) / 86400.0 / $3)
           ELSE 0
         END AS recency_factor
       FROM best_stats s
       LEFT JOIN hedge_cte h  ON h.wallet = s.wallet
       LEFT JOIN late_cte l   ON l.wallet = s.wallet
       LEFT JOIN last_cte lc  ON lc.wallet = s.wallet
     )
     INSERT INTO wallet_profiles
       (wallet, follow_score, is_followable, n_02, alphaz_02, hedge_rate, late_sniping_rate, last_trade_at, updated_at)
     SELECT
       c.wallet,
       ROUND((100.0 * c.sample_factor * c.edge_factor * c.hedge_penalty * c.late_penalty * c.recency_factor)::numeric, 2)::double precision,
       (c.n_02 >= $4 AND c.alphaz_02 > 0 AND c.hedge_rate <= 0.25 AND c.late_sniping_rate <= 0.60),
       c.n_02, c.alphaz_02, c.hedge_rate, c.late_sniping_rate, c.last_trade_at, now()
     FROM combined c
     ON CONFLICT (wallet) DO UPDATE SET
       follow_score      = EXCLUDED.follow_score,
       is_followable     = EXCLUDED.is_followable,
       n_02              = EXCLUDED.n_02,
       alphaz_02         = EXCLUDED.alphaz_02,
       hedge_rate        = EXCLUDED.hedge_rate,
       late_sniping_rate = EXCLUDED.late_sniping_rate,
       last_trade_at     = EXCLUDED.last_trade_at,
       updated_at        = now()`,
    [2, LATE_HOURS, RECENCY_HALF_LIFE_DAYS, MIN_N_FOR_FOLLOW]
  );

  const updatedWalletProfilesRows = profilesRes.rowCount ?? 0;
  const lastComputeAt = new Date().toISOString();

  await setEtlState("last_compute_at", lastComputeAt);
  await setEtlState(
    "last_compute_summary",
    JSON.stringify({
      walletStatsRows: updatedWalletStatsRows,
      walletProfilesRows: updatedWalletProfilesRows,
      durationMs: ctx.elapsed(),
    })
  );

  return {
    summary: {
      updatedWalletStatsRows,
      updatedWalletProfilesRows,
      lastComputeAt,
      thresholds: [...THRESHOLDS],
    },
  };
}

export const GET = withCronGuard({
  jobName: "compute",
  lockKey: 9002,
  handler: computeHandler,
});
