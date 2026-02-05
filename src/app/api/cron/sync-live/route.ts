import {
  query,
  insertTradesReturningInserted,
  setEtlState,
  ensureMarketPlaceholder,
} from "@/lib/db";
import type { TradeRow } from "@/lib/db";
import { fetchUserTradesPage, fetchTokenPrice } from "@/lib/polymarket";
import type { TradeNormalized } from "@/lib/polymarket";
import { applyInsertedTradesToPositions } from "@/lib/positions";
import { withCronGuard } from "@/lib/cronGuard";
import type { CronContext, CronResult } from "@/lib/cronGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 25_000;
const MAX_WALLETS_PER_RUN = 10;
const MAX_TARGET_WALLETS = 100;
const MAX_PRICE_TOKENS = 50;

function toTradeRow(t: TradeNormalized): TradeRow {
  return {
    pk: t.pk, ts: t.ts, wallet: t.wallet, condition_id: t.condition_id,
    side: t.side, price: t.price, size: t.size, outcome: t.outcome,
    outcome_index: t.outcome_index, asset: t.asset, tx_hash: t.tx_hash,
  };
}

async function syncLiveHandler(ctx: CronContext): Promise<CronResult> {
  let statusFinal: "success" | "partial" = "success";

  /* 1) Build target wallet list (followable + watchlist, deduped) */
  const followableRes = await query(
    `SELECT wallet FROM wallet_profiles
     WHERE is_followable = true
     ORDER BY follow_score DESC
     LIMIT 50`
  );
  const watchlistRes = await query(`SELECT wallet FROM wallet_watchlist`);

  const walletSet = new Set<string>();
  for (const r of followableRes.rows) walletSet.add(r.wallet as string);
  for (const r of watchlistRes.rows) walletSet.add(r.wallet as string);

  const allWallets = Array.from(walletSet).slice(0, MAX_TARGET_WALLETS);
  const walletsToProcess = allWallets.slice(0, MAX_WALLETS_PER_RUN);

  let walletsProcessed = 0;
  let totalTradesInserted = 0;
  let positionsUpdated = 0;
  let cursorsUpdated = 0;
  const processedWallets: string[] = [];

  /* 2) For each wallet: fetch BUY+SELL trades, insert, update positions+cursor */
  for (const wallet of walletsToProcess) {
    if (ctx.elapsed() > TIME_BUDGET_MS) {
      statusFinal = "partial";
      break;
    }

    try {
      const cursorRes = await query(
        `SELECT last_ts FROM wallet_live_cursor WHERE wallet = $1`,
        [wallet]
      );
      const lastTs: string | null =
        cursorRes.rows.length > 0 ? (cursorRes.rows[0].last_ts as string) : null;

      // Fetch BUY + SELL in parallel
      const [buyResult, sellResult] = await Promise.all([
        fetchUserTradesPage({ wallet, limit: 200, offset: 0, side: "BUY" }),
        fetchUserTradesPage({ wallet, limit: 200, offset: 0, side: "SELL" }),
      ]);

      // Merge and dedup by pk
      const seen = new Set<string>();
      const allTrades: TradeNormalized[] = [];
      for (const t of [...buyResult.normalized, ...sellResult.normalized]) {
        if (!seen.has(t.pk)) {
          seen.add(t.pk);
          allTrades.push(t);
        }
      }

      if (allTrades.length === 0) {
        walletsProcessed++;
        continue;
      }

      // Filter: keep only trades newer than cursor
      let trades = allTrades;
      if (lastTs) {
        const cursorDate = new Date(lastTs).getTime();
        trades = trades.filter((t) => new Date(t.ts).getTime() > cursorDate);
      }

      if (trades.length === 0) {
        walletsProcessed++;
        continue;
      }

      // Ensure market placeholders for FK
      const conditionIds = new Set(trades.map((t) => t.condition_id).filter(Boolean));
      for (const cid of conditionIds) {
        try { await ensureMarketPlaceholder(cid); } catch { /* best effort */ }
      }

      // Insert trades and get actually-inserted rows
      const tradeRows = trades.map(toTradeRow);
      const { count: inserted, insertedRows } = await insertTradesReturningInserted(tradeRows);
      totalTradesInserted += inserted;

      // Update positions ONLY for actually-inserted trades
      if (insertedRows.length > 0) {
        const posCount = await applyInsertedTradesToPositions(insertedRows);
        positionsUpdated += posCount;
      }

      // Update cursor to max ts
      const maxTs = trades.reduce((max, t) => {
        const d = new Date(t.ts).getTime();
        return d > max ? d : max;
      }, lastTs ? new Date(lastTs).getTime() : 0);

      if (maxTs > 0) {
        await query(
          `INSERT INTO wallet_live_cursor (wallet, last_ts, updated_at)
           VALUES ($1, $2, now())
           ON CONFLICT (wallet) DO UPDATE SET
             last_ts = GREATEST(wallet_live_cursor.last_ts, EXCLUDED.last_ts),
             updated_at = now()`,
          [wallet, new Date(maxTs).toISOString()]
        );
        cursorsUpdated++;
      }

      processedWallets.push(wallet);
      walletsProcessed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[sync-live] error for wallet ${wallet}: ${msg}`);
      walletsProcessed++;
    }
  }

  /* 3) Fetch token prices for open positions of processed wallets */
  let pricesFetched = 0;
  if (processedWallets.length > 0 && ctx.elapsed() < TIME_BUDGET_MS) {
    try {
      const tokenRes = await query(
        `SELECT DISTINCT (m.clob_token_ids->>wp.outcome_index::int) AS token_id
         FROM wallet_positions wp
         JOIN markets m ON m.condition_id = wp.condition_id
         WHERE wp.net_shares > 0
           AND wp.wallet = ANY($1)
           AND m.clob_token_ids IS NOT NULL
         LIMIT $2`,
        [processedWallets, MAX_PRICE_TOKENS]
      );

      for (const row of tokenRes.rows) {
        if (ctx.elapsed() > TIME_BUDGET_MS) {
          statusFinal = "partial";
          break;
        }
        const tokenId = row.token_id as string;
        if (!tokenId) continue;

        try {
          const price = await fetchTokenPrice(tokenId);
          if (price != null) {
            await query(
              `INSERT INTO token_prices (token_id, price, fetched_at)
               VALUES ($1, $2, now())
               ON CONFLICT (token_id) DO UPDATE SET
                 price = EXCLUDED.price, fetched_at = now()`,
              [tokenId, price]
            );
            pricesFetched++;
          }
        } catch { /* best effort */ }
      }
    } catch (err) {
      console.warn(`[sync-live] price fetch error: ${err instanceof Error ? err.message : err}`);
    }
  }

  await setEtlState("last_live_sync_at", new Date().toISOString());
  await setEtlState(
    "last_live_sync_summary",
    JSON.stringify({
      walletsTargeted: allWallets.length,
      walletsProcessed,
      tradesInserted: totalTradesInserted,
      positionsUpdated,
      pricesFetched,
      cursorsUpdated,
    })
  );

  return {
    status: statusFinal,
    summary: {
      walletsTargeted: allWallets.length,
      walletsProcessed,
      tradesInserted: totalTradesInserted,
      positionsUpdated,
      pricesFetched,
      cursorsUpdated,
    },
  };
}

export const GET = withCronGuard({
  jobName: "sync-live",
  lockKey: 9003,
  handler: syncLiveHandler,
});
