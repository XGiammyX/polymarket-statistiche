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
  query,
} from "@/lib/db";
import type { MarketRow, ResolutionRow, TradeRow } from "@/lib/db";
import { fetchMarketsPage, fetchTradesPage, fetchMarketWinner } from "@/lib/polymarket";
import { withCronGuard } from "@/lib/cronGuard";
import type { CronContext, CronResult } from "@/lib/cronGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 25_000;

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
      limit: 200,
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

    newMarketsOffset = marketsFetched === 0 ? 0 : marketsOffset + 200;
    await setEtlState("markets_offset", String(newMarketsOffset));
  } catch (err) {
    console.error(
      `[sync] markets error: ${err instanceof Error ? err.message : err}`
    );
  }

  console.log(
    `[sync] rid=${ctx.requestId} markets: fetched=${marketsFetched} upserted=${marketsUpserted} offset=${newMarketsOffset}`
  );

  // Time budget check
  if (ctx.elapsed() > TIME_BUDGET_MS) {
    statusFinal = "partial";
    await setEtlState("last_sync_at", new Date().toISOString());
    return {
      status: statusFinal,
      summary: {
        markets: { fetched: marketsFetched, upserted: marketsUpserted, newOffset: newMarketsOffset },
        resolutions: { attempted: 0, inserted: 0 },
        backfillRowsCreated: 0,
        trades: { marketsProcessed: 0, tradesInserted: 0, completedMarkets: 0 },
        stoppedAt: "markets",
      },
    };
  }

  /* ═══════════════════════════════════════════════════
     B) SYNC RESOLUTIONS (CLOB) — batch 25
     ═══════════════════════════════════════════════════ */
  let resolutionsAttempted = 0;
  let resolutionsInserted = 0;

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
      if (ctx.elapsed() > TIME_BUDGET_MS) {
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
        }
      } catch (err) {
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

  console.log(
    `[sync] rid=${ctx.requestId} resolutions: attempted=${resolutionsAttempted} inserted=${resolutionsInserted}`
  );

  if (ctx.elapsed() > TIME_BUDGET_MS) {
    statusFinal = "partial";
    await setEtlState("last_sync_at", new Date().toISOString());
    return {
      status: statusFinal,
      summary: {
        markets: { fetched: marketsFetched, upserted: marketsUpserted, newOffset: newMarketsOffset },
        resolutions: { attempted: resolutionsAttempted, inserted: resolutionsInserted },
        backfillRowsCreated: 0,
        trades: { marketsProcessed: 0, tradesInserted: 0, completedMarkets: 0 },
        stoppedAt: "resolutions",
      },
    };
  }

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
    const batch = await pickTradeBackfillBatch(5);

    for (const item of batch) {
      if (ctx.elapsed() > TIME_BUDGET_MS) {
        statusFinal = "partial";
        break;
      }
      try {
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
