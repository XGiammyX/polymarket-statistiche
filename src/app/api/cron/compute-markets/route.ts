import { query } from "@/lib/db";
import { withCronGuard } from "@/lib/cronGuard";
import type { CronContext, CronResult } from "@/lib/cronGuard";
import { computeAdviceForMarket, upsertMarketAdvice } from "@/lib/advice/model";
import { BATCH_SIZE, LOCK_KEY } from "@/lib/advice/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 55_000;

async function computeMarketsHandler(ctx: CronContext): Promise<CronResult> {
  /* Select binary markets prioritizing those with followable wallet activity */
  const candidatesRes = await query(
    `WITH scored AS (
       SELECT m.condition_id,
         COALESCE((
           SELECT SUM(ABS(wp.net_shares) * COALESCE(pr.follow_score, 0))
           FROM wallet_positions wp
           LEFT JOIN wallet_profiles pr ON pr.wallet = wp.wallet
           WHERE wp.condition_id = m.condition_id AND wp.net_shares != 0
         ), 0) AS pos_signal,
         COALESCE((
           SELECT COUNT(*)
           FROM trades t
           WHERE t.condition_id = m.condition_id AND t.ts >= now() - interval '7 days'
         ), 0) AS recent_trades
       FROM markets m
       WHERE (m.closed = false OR m.closed IS NULL)
         AND m.outcomes IS NOT NULL
         AND jsonb_array_length(m.outcomes::jsonb) = 2
         AND m.question IS NOT NULL AND m.question != ''
         AND (
           EXISTS (
             SELECT 1 FROM wallet_positions wp
             JOIN wallet_profiles pr ON pr.wallet = wp.wallet
             WHERE wp.condition_id = m.condition_id AND wp.net_shares != 0
               AND (pr.is_followable = true OR pr.follow_score > 5)
           )
           OR EXISTS (
             SELECT 1 FROM trades t
             WHERE t.condition_id = m.condition_id AND t.ts >= now() - interval '3 days'
           )
         )
     )
     SELECT condition_id FROM scored
     ORDER BY pos_signal DESC, recent_trades DESC
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
