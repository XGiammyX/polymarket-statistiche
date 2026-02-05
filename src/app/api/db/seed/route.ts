import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSeedSecret, IS_PROD } from "@/lib/env";
import { checkAdminAuth } from "@/lib/adminAuth";
import { upsertMarkets, upsertResolution, insertTrades } from "@/lib/db";
import type { MarketRow, ResolutionRow, TradeRow } from "@/lib/db";
import { fetchMarketsPage, fetchMarketWinner, fetchTradesPage } from "@/lib/polymarket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest): boolean {
  if (IS_PROD) return checkAdminAuth(req);
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token === getSeedSecret();
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const start = Date.now();

  if (!checkAuth(req)) {
    return NextResponse.json(
      { ok: false, requestId, error: IS_PROD ? "Requires ADMIN_SECRET in production" : "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // 1. Fetch 1 page of closed markets
    const marketsResult = await fetchMarketsPage({
      limit: 50,
      offset: 0,
      closed: true,
    });

    const normalizedMarkets = marketsResult.normalized;

    // 2. Upsert markets into DB
    const marketRows: MarketRow[] = normalizedMarkets.map((m) => ({
      condition_id: m.condition_id,
      question: m.question,
      slug: m.slug,
      end_date: m.end_date,
      closed: m.closed,
      outcomes: m.outcomes,
      clob_token_ids: m.clob_token_ids,
    }));

    const marketsUpserted = await upsertMarkets(marketRows);

    // 3. For up to 10 closed markets, try to save resolution
    const marketsForResolution = normalizedMarkets.slice(0, 10);
    let resolutionsSaved = 0;
    const resolvedMarkets: typeof normalizedMarkets = [];

    for (const market of marketsForResolution) {
      try {
        const winner = await fetchMarketWinner(
          market.condition_id,
          market.clob_token_ids
        );
        if (winner) {
          const row: ResolutionRow = {
            condition_id: winner.condition_id,
            winning_token_id: winner.winning_token_id,
            winning_outcome_index: winner.winning_outcome_index,
          };
          await upsertResolution(row);
          resolutionsSaved++;
          resolvedMarkets.push(market);
        }
      } catch (err) {
        console.warn(
          `[seed] Resolution error for ${market.condition_id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // 4. For up to 5 resolved markets, fetch and insert BUY trades
    const marketsForTrades = resolvedMarkets.slice(0, 5);
    let tradesInserted = 0;

    for (const market of marketsForTrades) {
      try {
        const tradesResult = await fetchTradesPage({
          conditionId: market.condition_id,
          limit: 200,
          offset: 0,
          side: "BUY",
        });

        const tradeRows: TradeRow[] = tradesResult.normalized.map((t) => ({
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
        tradesInserted += inserted;
      } catch (err) {
        console.warn(
          `[seed] Trades error for ${market.condition_id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    const report = {
      requestId,
      durationMs: Date.now() - start,
      marketsRaw: marketsResult.raw.length,
      marketsNormalized: normalizedMarkets.length,
      marketsUpserted,
      resolutionsSaved,
      tradesInserted,
    };

    console.log("[/api/db/seed]", JSON.stringify(report));

    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/db/seed] requestId=${requestId} error=${message}`);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
