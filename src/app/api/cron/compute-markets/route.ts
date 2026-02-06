import { query } from "@/lib/db";
import { withCronGuard } from "@/lib/cronGuard";
import type { CronContext, CronResult } from "@/lib/cronGuard";
import { computeAdviceForMarket, upsertMarketAdvice } from "@/lib/advice/model";
import { BATCH_SIZE, LOCK_KEY } from "@/lib/advice/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 55_000;

async function computeMarketsHandler(ctx: CronContext): Promise<CronResult> {
  /* Select binary markets with JOIN-based scoring — no correlated subqueries */
  const candidatesRes = await query(
    `SELECT m.condition_id,
       COALESCE(ps.pos_signal, 0) AS pos_signal,
       COALESCE(tr.recent_trades, 0) AS recent_trades,
       COALESCE(tr.recent_wallets, 0) AS recent_wallets
     FROM markets m
     LEFT JOIN (
       SELECT wp.condition_id,
         SUM(ABS(wp.net_shares) *
           LEAST(GREATEST(COALESCE(pr.follow_score,0)/100.0, 0.01), 1) *
           LEAST(GREATEST((COALESCE(pr.alphaz_02,0)+1.0)/6.0, 0.01), 1)
         ) AS pos_signal
       FROM wallet_positions wp
       LEFT JOIN wallet_profiles pr ON pr.wallet = wp.wallet
       WHERE wp.net_shares != 0
       GROUP BY wp.condition_id
     ) ps ON ps.condition_id = m.condition_id
     LEFT JOIN (
       SELECT t.condition_id,
         COUNT(*) AS recent_trades,
         COUNT(DISTINCT t.wallet) AS recent_wallets
       FROM trades t
       WHERE t.ts >= now() - interval '7 days'
       GROUP BY t.condition_id
     ) tr ON tr.condition_id = m.condition_id
     WHERE (m.closed = false OR m.closed IS NULL)
       AND m.outcomes IS NOT NULL
       AND jsonb_array_length(m.outcomes::jsonb) = 2
       AND m.question IS NOT NULL AND m.question != ''
       AND (ps.pos_signal > 0 OR tr.recent_trades > 0)
     ORDER BY ps.pos_signal DESC, tr.recent_wallets DESC, tr.recent_trades DESC
     LIMIT $1`,
    [BATCH_SIZE]
  );

  const candidates = candidatesRes.rows as { condition_id: string }[];
  let computed = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of candidates) {
    if (ctx.elapsed() > TIME_BUDGET_MS) break;

    try {
      const advice = await computeAdviceForMarket(row.condition_id);
      if (advice) {
        await upsertMarketAdvice(advice);
        computed++;
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      console.error(
        `[compute-markets] rid=${ctx.requestId} error on ${row.condition_id}: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }

  console.log(
    `[compute-markets] rid=${ctx.requestId} computed=${computed} skipped=${skipped} errors=${errors} elapsed=${ctx.elapsed()}ms`
  );

  return {
    summary: {
      candidates: candidates.length,
      computed,
      skipped,
      errors,
    },
  };
}

export const GET = withCronGuard({
  jobName: "compute-markets",
  lockKey: LOCK_KEY,
  handler: computeMarketsHandler,
});
