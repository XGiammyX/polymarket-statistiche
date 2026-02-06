import {
  upsertMarkets,
  upsertResolution,
  insertTrades,
  getEtlState,
  setEtlState,
  ensureTradeBackfillRowsForResolvedMarkets,
  pickTradeBackfillBatch,
  markTradeBackfillProgress,
  markTradeBackfillError,
  ensureMarketPlaceholder,
  query,
} from "@/lib/db";
import type { MarketRow, ResolutionRow, TradeRow } from "@/lib/db";
import { fetchMarketsPage, fetchTradesPage, fetchMarketWinner } from "@/lib/polymarket";
import { withCronGuard } from "@/lib/cronGuard";
import type { CronContext, CronResult } from "@/lib/cronGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 25_000;
const TRADES_RESERVE_MS = 8_000; // reserve at least 8s for trades

async function syncHandler(ctx: CronContext): Promise<CronResult> {
  let statusFinal: "success" | "partial" = "success";

  /* ═══════════════════════════════════════════════════
     A) SYNC MARKETS (Gamma) — batch 200
     ═══════════════════════════════════════════════════ */
  const marketsOffset = parseInt(
    await getEtlState("markets_offset", "0"),
    10
  );

  let marketsFetched = 0;
  let marketsUpserted = 0;
  let newMarketsOffset = marketsOffset;

  try {
    const result = await fetchMarketsPage({
      limit: 500,
      offset: marketsOffset,
    });

    marketsFetched = result.raw.length;
    const normalized = result.normalized;

    if (normalized.length > 0) {
      const rows: MarketRow[] = normalized.map((m) => ({
        condition_id: m.condition_id,
        question: m.question,
        slug: m.slug,
        end_date: m.end_date,
        closed: m.closed,
        outcomes: m.outcomes,
        clob_token_ids: m.clob_token_ids,
      }));
      marketsUpserted = await upsertMarkets(rows);
    }

    newMarketsOffset = marketsFetched === 0 ? 0 : marketsOffset + marketsFetched;
    await setEtlState("markets_offset", String(newMarketsOffset));
  } catch (err) {
    console.error(
      `[sync] markets error: ${err instanceof Error ? err.message : err}`
    );
  }

  console.log(
    `[sync] rid=${ctx.requestId} markets: fetched=${marketsFetched} upserted=${marketsUpserted} offset=${newMarketsOffset}`
  );

  // Check if we have time for resolutions, otherwise skip straight to trades
  const skipResolutions = ctx.elapsed() > (TIME_BUDGET_MS - TRADES_RESERVE_MS);

  /* ═══════════════════════════════════════════════════
     B) SYNC RESOLUTIONS (CLOB) — batch 10 (skip if time is short)
     ═══════════════════════════════════════════════════ */
  let resolutionsAttempted = 0;
  let resolutionsInserted = 0;

  if (!skipResolutions) {
    try {
      const unresolvedRes = await query(
        `SELECT m.condition_id, m.clob_token_ids
         FROM markets m
         WHERE m.closed = true
           AND NOT EXISTS (
             SELECT 1 FROM resolutions r WHERE r.condition_id = m.condition_id
           )
         ORDER BY m.end_date DESC NULLS LAST
         LIMIT 25`
      );

      const unresolvedMarkets = unresolvedRes.rows as Array<{
        condition_id: string;
        clob_token_ids: unknown;
      }>;

      resolutionsAttempted = unresolvedMarkets.length;

      for (const um of unresolvedMarkets) {
        if (ctx.elapsed() > (TIME_BUDGET_MS - TRADES_RESERVE_MS)) {
          statusFinal = "partial";
          break;
        }
        try {
          let tokenIds: string[] = [];
          try {
            const raw = um.clob_token_ids;
            tokenIds =
              typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
          } catch {
            tokenIds = [];
          }

          const winner = await fetchMarketWinner(um.condition_id, tokenIds);

          if (winner && winner.winning_token_id) {
            const row: ResolutionRow = {
              condition_id: winner.condition_id,
              winning_token_id: winner.winning_token_id,
              winning_outcome_index: winner.winning_outcome_index,
            };
            await upsertResolution(row);
            resolutionsInserted++;
          } else {
            // Market exists on CLOB but no winner yet, or returned null — mark with empty resolution
            // so we don't retry endlessly (especially for old 404 markets)
            await upsertResolution({
              condition_id: um.condition_id,
              winning_token_id: null,
              winning_outcome_index: null,
            });
          }
        } catch (err) {
          // 404 or other CLOB error — mark as unresolvable so we skip it next time
          await upsertResolution({
            condition_id: um.condition_id,
            winning_token_id: null,
            winning_outcome_index: null,
          }).catch(() => {});
          console.warn(
            `[sync] resolution error for ${um.condition_id}: ${
              err instanceof Error ? err.message : err
            }`
          );
        }
      }
    } catch (err) {
      console.error(
        `[sync] resolutions query error: ${err instanceof Error ? err.message : err}`
      );
    }
  } else {
    console.log(`[sync] rid=${ctx.requestId} skipping resolutions — reserving time for trades`);
  }

  console.log(
    `[sync] rid=${ctx.requestId} resolutions: attempted=${resolutionsAttempted} inserted=${resolutionsInserted}`
  );

  /* ═══════════════════════════════════════════════════
     C) PREPARE TRADE_BACKFILL (DB only)
     ═══════════════════════════════════════════════════ */
  let backfillRowsCreated = 0;
  try {
    backfillRowsCreated =
      await ensureTradeBackfillRowsForResolvedMarkets(500);
  } catch (err) {
    console.error(
      `[sync] backfill prep error: ${err instanceof Error ? err.message : err}`
    );
  }

  /* ═══════════════════════════════════════════════════
     D) SYNC TRADES (Data API) — batch 5 markets, 500 trades/page
     ═══════════════════════════════════════════════════ */
  let tradesMarketsProcessed = 0;
  let totalTradesInserted = 0;
  let tradesCompleted = 0;

  try {
    const batch = await pickTradeBackfillBatch(15);

    for (const item of batch) {
      if (ctx.elapsed() > TIME_BUDGET_MS) {
        statusFinal = "partial";
        break;
      }
      try {
        // Ensure market exists (FK safety)
        await ensureMarketPlaceholder(item.condition_id);

        const result = await fetchTradesPage({
          conditionId: item.condition_id,
          limit: 500,
          offset: item.next_offset,
          side: "BUY",
        });

        const tradeRows: TradeRow[] = result.normalized.map((t) => ({
          pk: t.pk,
          ts: t.ts,
          wallet: t.wallet,
          condition_id: t.condition_id,
          side: t.side,
          price: t.price,
          size: t.size,
          outcome: t.outcome,
          outcome_index: t.outcome_index,
          asset: t.asset,
          tx_hash: t.tx_hash,
        }));

        // Ensure FK for all unique condition_ids in batch
        const uniqueCids = [...new Set(tradeRows.map((t) => t.condition_id))];
        for (const cid of uniqueCids) {
          await ensureMarketPlaceholder(cid);
        }

        const inserted = await insertTrades(tradeRows);
        totalTradesInserted += inserted;
        tradesMarketsProcessed++;

        const countReturned = result.raw.length;

        if (countReturned < 500) {
          await markTradeBackfillProgress(item.condition_id, 0, true);
          tradesCompleted++;
        } else {
          await markTradeBackfillProgress(
            item.condition_id,
            item.next_offset + 500,
            false
          );
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[sync] trades error for ${item.condition_id} offset=${item.next_offset}: ${errMsg}`
        );
        try {
          await markTradeBackfillError(item.condition_id, errMsg);
        } catch { /* best effort */ }
      }
    }
  } catch (err) {
    console.error(
      `[sync] trades batch error: ${err instanceof Error ? err.message : err}`
    );
  }

  await setEtlState("last_sync_at", new Date().toISOString());
  await setEtlState(
    "last_sync_summary",
    JSON.stringify({
      marketsFetched,
      marketsUpserted,
      resolutionsInserted,
      tradesInserted: totalTradesInserted,
      tradesCompleted,
    })
  );

  return {
    status: statusFinal,
    summary: {
      markets: { fetched: marketsFetched, upserted: marketsUpserted, newOffset: newMarketsOffset },
      resolutions: { attempted: resolutionsAttempted, inserted: resolutionsInserted },
      backfillRowsCreated,
      trades: {
        marketsProcessed: tradesMarketsProcessed,
        tradesInserted: totalTradesInserted,
        completedMarkets: tradesCompleted,
      },
    },
  };
}

export const GET = withCronGuard({
  jobName: "sync",
  lockKey: 9001,
  handler: syncHandler,
});
