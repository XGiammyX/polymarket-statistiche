import { query, setEtlState } from "@/lib/db";
import { withCronGuard } from "@/lib/cronGuard";
import type { CronContext, CronResult } from "@/lib/cronGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 55_000;

async function computeHandler(ctx: CronContext): Promise<CronResult> {
  /* ═══════════════════════════════════════════════════
     QUERY 1: Upsert wallet_stats for thresholds 0.05/0.02/0.01
     Uses partial index idx_trades_lowprob_buy_005 via price<=0.05 filter.
     ═══════════════════════════════════════════════════ */
  const statsRes = await query(`
    WITH thresholds(threshold) AS (
      VALUES (0.05::double precision), (0.02::double precision), (0.01::double precision)
    ),
    base AS (
      SELECT
        t.wallet,
        t.price,
        t.outcome_index,
        r.winning_outcome_index
      FROM trades t
      JOIN resolutions r ON r.condition_id = t.condition_id
      WHERE t.side = 'BUY'
        AND t.price >= 0 AND t.price <= 0.05
    ),
    lowprob AS (
      SELECT
        b.wallet,
        th.threshold,
        b.price,
        CASE WHEN b.outcome_index = b.winning_outcome_index THEN 1 ELSE 0 END AS is_win
      FROM base b
      JOIN thresholds th ON b.price <= th.threshold
    ),
    agg AS (
      SELECT
        wallet,
        threshold,
        COUNT(*)::int AS n,
        SUM(is_win)::int AS wins,
        SUM(price)::double precision AS expected_wins,
        SUM(price * (1 - price))::double precision AS variance
      FROM lowprob
      GROUP BY wallet, threshold
    )
    INSERT INTO wallet_stats(wallet, threshold, n, wins, expected_wins, variance, alphaz, updated_at)
    SELECT
      wallet,
      threshold,
      n,
      wins,
      expected_wins,
      variance,
      CASE
        WHEN variance <= 0 THEN 0
        ELSE (wins - expected_wins) / SQRT(variance)
      END AS alphaz,
      NOW()
    FROM agg
    ON CONFLICT (wallet, threshold)
    DO UPDATE SET
      n = EXCLUDED.n,
      wins = EXCLUDED.wins,
      expected_wins = EXCLUDED.expected_wins,
      variance = EXCLUDED.variance,
      alphaz = EXCLUDED.alphaz,
      updated_at = NOW()
  `);

  const updatedWalletStatsRows = statsRes.rowCount ?? 0;

  console.log(
    `[compute] rid=${ctx.requestId} wallet_stats upserted=${updatedWalletStatsRows} elapsed=${ctx.elapsed()}ms`
  );

  // Time budget check after heavy query 1
  if (ctx.elapsed() > TIME_BUDGET_MS) {
    const lastComputeAt = new Date().toISOString();
    await setEtlState("last_compute_at", lastComputeAt);
    return {
      status: "partial",
      summary: {
        updatedWalletStatsRows,
        updatedWalletProfilesRows: 0,
        lastComputeAt,
        stoppedAt: "wallet_stats",
      },
    };
  }

  /* ═══════════════════════════════════════════════════
     QUERY 2: Upsert wallet_profiles (follow_score + flags)
     Also uses price<=0.05 base then filters to <=0.02.
     ═══════════════════════════════════════════════════ */
  const profilesRes = await query(`
    WITH base_02 AS (
      SELECT
        t.wallet,
        t.condition_id,
        t.outcome_index,
        t.ts,
        t.price,
        m.end_date
      FROM trades t
      JOIN resolutions r ON r.condition_id = t.condition_id
      JOIN markets m ON m.condition_id = t.condition_id
      WHERE t.side = 'BUY'
        AND t.price >= 0 AND t.price <= 0.02
    ),
    n02 AS (
      SELECT wallet, COUNT(*)::int AS n_02, MAX(ts) AS last_trade_at
      FROM base_02
      GROUP BY wallet
    ),
    hedge AS (
      SELECT
        wallet,
        COUNT(*)::int AS total_markets,
        SUM(CASE WHEN distinct_outcomes = 2 THEN 1 ELSE 0 END)::int AS hedged_markets
      FROM (
        SELECT wallet, condition_id, COUNT(DISTINCT outcome_index)::int AS distinct_outcomes
        FROM base_02
        GROUP BY wallet, condition_id
      ) x
      GROUP BY wallet
    ),
    late AS (
      SELECT
        wallet,
        SUM(
          CASE
            WHEN EXTRACT(EPOCH FROM (end_date - ts))/3600.0 <= 6
              AND EXTRACT(EPOCH FROM (end_date - ts)) >= 0
            THEN 1 ELSE 0
          END
        )::int AS late_count
      FROM base_02
      WHERE end_date IS NOT NULL
      GROUP BY wallet
    ),
    alpha AS (
      SELECT wallet, alphaz AS alphaz_02
      FROM wallet_stats
      WHERE threshold = 0.02
    ),
    joined AS (
      SELECT
        n02.wallet,
        n02.n_02,
        COALESCE(alpha.alphaz_02, 0)::double precision AS alphaz_02,
        COALESCE(hedge.total_markets, 0)::int AS total_markets,
        COALESCE(hedge.hedged_markets, 0)::int AS hedged_markets,
        COALESCE(late.late_count, 0)::int AS late_count,
        n02.last_trade_at
      FROM n02
      LEFT JOIN alpha ON alpha.wallet = n02.wallet
      LEFT JOIN hedge ON hedge.wallet = n02.wallet
      LEFT JOIN late ON late.wallet = n02.wallet
    ),
    scored AS (
      SELECT
        wallet,
        n_02,
        alphaz_02,
        CASE
          WHEN total_markets <= 0 THEN 0
          ELSE (hedged_markets::double precision / total_markets::double precision)
        END AS hedge_rate,
        CASE
          WHEN n_02 <= 0 THEN 0
          ELSE (late_count::double precision / n_02::double precision)
        END AS late_sniping_rate,
        last_trade_at,
        EXTRACT(EPOCH FROM (NOW() - last_trade_at)) / 86400.0 AS days_since_last
      FROM joined
    )
    INSERT INTO wallet_profiles(wallet, follow_score, is_followable, n_02, alphaz_02, hedge_rate, late_sniping_rate, last_trade_at, updated_at)
    SELECT
      wallet,
      ROUND(
        (100
        * LEAST(GREATEST(n_02 / 50.0, 0), 1)
        * LEAST(GREATEST((alphaz_02 + 1) / 6.0, 0), 1)
        * (1 - hedge_rate)
        * (1 - 0.5 * late_sniping_rate)
        * EXP(-LN(2.0) * COALESCE(days_since_last, 9999) / 30.0))::numeric
      , 2)::double precision AS follow_score,
      (n_02 >= 20 AND alphaz_02 > 0 AND hedge_rate <= 0.25 AND late_sniping_rate <= 0.60) AS is_followable,
      n_02,
      alphaz_02,
      hedge_rate,
      late_sniping_rate,
      last_trade_at,
      NOW()
    FROM scored
    ON CONFLICT (wallet)
    DO UPDATE SET
      follow_score = EXCLUDED.follow_score,
      is_followable = EXCLUDED.is_followable,
      n_02 = EXCLUDED.n_02,
      alphaz_02 = EXCLUDED.alphaz_02,
      hedge_rate = EXCLUDED.hedge_rate,
      late_sniping_rate = EXCLUDED.late_sniping_rate,
      last_trade_at = EXCLUDED.last_trade_at,
      updated_at = NOW()
  `);

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
    },
  };
}

export const GET = withCronGuard({
  jobName: "compute",
  lockKey: 9002,
  handler: computeHandler,
});
