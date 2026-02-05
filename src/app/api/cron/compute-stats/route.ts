import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { getSeedSecret } from "@/lib/env";
import {
  THRESHOLDS,
  MIN_N_FOR_FOLLOW,
  LATE_HOURS,
  RECENCY_HALF_LIFE_DAYS,
} from "@/lib/scoring/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token === getSeedSecret();
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const start = Date.now();

  if (!checkAuth(req)) {
    return NextResponse.json(
      { ok: false, requestId, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    /* ═══════════════════════════════════════════════════
       STEP 1: Upsert wallet_stats for each threshold
       ═══════════════════════════════════════════════════ */
    let walletStatsUpserted = 0;

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
      walletStatsUpserted += res.rowCount ?? 0;
    }

    console.log(
      `[compute-stats] requestId=${requestId} wallet_stats upserted=${walletStatsUpserted}`
    );

    /* ═══════════════════════════════════════════════════
       STEP 2: Compute and upsert wallet_profiles
       Single query with CTEs for:
       - base_trades: BUY trades on resolved markets with price <= 0.02
       - hedge_cte: hedge_rate per wallet
       - late_cte: late_sniping_rate per wallet
       - last_cte: last_trade_at per wallet
       - stats_cte: n_02 & alphaz_02 from wallet_stats
       ═══════════════════════════════════════════════════ */
    const profileRes = await query(
      `WITH
       /* All BUY trades on resolved markets, price <= 0.02 */
       base AS (
         SELECT t.wallet, t.condition_id, t.outcome_index, t.price, t.ts,
                m.end_date
         FROM trades t
         JOIN resolutions r ON r.condition_id = t.condition_id
         JOIN markets m     ON m.condition_id = t.condition_id
         WHERE t.side = 'BUY'
           AND t.price <= 0.02
           AND t.price > 0
       ),

       /* Hedge rate: fraction of markets where wallet bought both outcomes */
       hedge_cte AS (
         SELECT
           bt.wallet,
           COUNT(DISTINCT bt.condition_id) FILTER (
             WHERE bt.condition_id IN (
               SELECT b2.condition_id
               FROM base b2
               WHERE b2.wallet = bt.wallet
               GROUP BY b2.condition_id
               HAVING COUNT(DISTINCT b2.outcome_index) >= $1
             )
           )::double precision
           / NULLIF(COUNT(DISTINCT bt.condition_id), 0) AS hedge_rate
         FROM base bt
         GROUP BY bt.wallet
       ),

       /* Late sniping rate: trades within LATE_HOURS of end_date */
       late_cte AS (
         SELECT
           wallet,
           SUM(CASE
             WHEN end_date IS NOT NULL
               AND EXTRACT(EPOCH FROM (end_date - ts)) / 3600.0 <= $2
               AND EXTRACT(EPOCH FROM (end_date - ts)) >= 0
             THEN 1 ELSE 0
           END)::double precision
           / NULLIF(COUNT(*), 0) AS late_sniping_rate
         FROM base
         GROUP BY wallet
       ),

       /* Last trade for all BUY trades (not just low-prob) */
       last_cte AS (
         SELECT wallet, MAX(ts) AS last_trade_at
         FROM trades
         WHERE side = 'BUY'
         GROUP BY wallet
       ),

       /* wallet_stats at threshold=0.02 */
       stats_02 AS (
         SELECT wallet, n AS n_02, alphaz AS alphaz_02
         FROM wallet_stats
         WHERE threshold = 0.02
       ),

       /* Combine everything */
       combined AS (
         SELECT
           s.wallet,
           COALESCE(s.n_02, 0) AS n_02,
           COALESCE(s.alphaz_02, 0) AS alphaz_02,
           COALESCE(h.hedge_rate, 0) AS hedge_rate,
           COALESCE(l.late_sniping_rate, 0) AS late_sniping_rate,
           lc.last_trade_at,
           /* sample_factor = clamp(n_02 / 50, 0, 1) */
           LEAST(GREATEST(COALESCE(s.n_02, 0)::double precision / 50.0, 0), 1) AS sample_factor,
           /* edge_factor = clamp((alphaz_02 + 1) / 6, 0, 1) */
           LEAST(GREATEST((COALESCE(s.alphaz_02, 0) + 1.0) / 6.0, 0), 1) AS edge_factor,
           /* hedge_penalty = 1 - hedge_rate */
           1.0 - COALESCE(h.hedge_rate, 0) AS hedge_penalty,
           /* late_penalty = 1 - 0.5 * late_sniping_rate */
           1.0 - 0.5 * COALESCE(l.late_sniping_rate, 0) AS late_penalty,
           /* recency_factor = exp(-ln(2) * days_since / half_life) */
           CASE
             WHEN lc.last_trade_at IS NOT NULL
             THEN EXP(-LN(2.0) * EXTRACT(EPOCH FROM (now() - lc.last_trade_at)) / 86400.0 / $3)
             ELSE 0
           END AS recency_factor
         FROM stats_02 s
         LEFT JOIN hedge_cte h  ON h.wallet = s.wallet
         LEFT JOIN late_cte l   ON l.wallet = s.wallet
         LEFT JOIN last_cte lc  ON lc.wallet = s.wallet
       )

       INSERT INTO wallet_profiles
         (wallet, follow_score, is_followable, n_02, alphaz_02,
          hedge_rate, late_sniping_rate, last_trade_at, updated_at)
       SELECT
         c.wallet,
         ROUND((100.0 * c.sample_factor * c.edge_factor
                * c.hedge_penalty * c.late_penalty * c.recency_factor)::numeric, 2)::double precision
           AS follow_score,
         (c.n_02 >= $4 AND c.alphaz_02 > 0 AND c.hedge_rate <= 0.25 AND c.late_sniping_rate <= 0.60)
           AS is_followable,
         c.n_02,
         c.alphaz_02,
         c.hedge_rate,
         c.late_sniping_rate,
         c.last_trade_at,
         now()
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
      [
        2,                        // $1 = HEDGE_DISTINCT_OUTCOMES
        LATE_HOURS,               // $2
        RECENCY_HALF_LIFE_DAYS,   // $3
        MIN_N_FOR_FOLLOW,         // $4
      ]
    );

    const profilesUpserted = profileRes.rowCount ?? 0;
    const durationMs = Date.now() - start;

    const report = {
      requestId,
      durationMs,
      walletStatsUpserted,
      profilesUpserted,
      thresholds: [...THRESHOLDS],
    };

    console.log("[/api/cron/compute-stats]", JSON.stringify(report));

    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[/api/cron/compute-stats] requestId=${requestId} error=${message}`
    );
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
