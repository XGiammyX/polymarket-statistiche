import { NextRequest, NextResponse } from "next/server";
import { fetchMarketWinner, fetchTradesPage, fetchMarketsPage } from "@/lib/polymarket";
import { randomUUID } from "crypto";
import { IS_PROD } from "@/lib/env";
import { checkAdminAuth } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conditionId: string }> }
) {
  const requestId = randomUUID();
  const start = Date.now();
  const { conditionId } = await params;

  if (IS_PROD && !checkAdminAuth(req)) {
    return NextResponse.json(
      { ok: false, requestId, error: "Debug endpoints require ADMIN_SECRET in production" },
      { status: 403 }
    );
  }

  try {
    // Try to get the market from Gamma to know clobTokenIds
    let clobTokenIds: string[] = [];
    try {
      const gammaResult = await fetchMarketsPage({ limit: 1, offset: 0 });
      // We can't filter by conditionId on Gamma easily, so we'll use empty array
      // and let normalizeResolution handle it
      const found = gammaResult.normalized.find(
        (m) => m.condition_id === conditionId
      );
      if (found) {
        clobTokenIds = found.clob_token_ids;
      }
    } catch {
      // Ignore - we proceed without clobTokenIds
    }

    // Fetch winner via CLOB
    const winner = await fetchMarketWinner(conditionId, clobTokenIds);

    // Fetch trades BUY via Data API
    const trades = await fetchTradesPage({
      conditionId,
      limit: 100,
      offset: 0,
      side: "BUY",
    });

    const summary = {
      requestId,
      conditionId,
      hasWinner: winner !== null,
      tradesRawCount: trades.raw.length,
      tradesNormalizedCount: trades.normalized.length,
      durationMs: Date.now() - start,
    };

    console.log("[/api/debug/market]", JSON.stringify(summary));

    return NextResponse.json({
      ok: true,
      ...summary,
      winner,
      tradesSample: trades.normalized.slice(0, 5),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[/api/debug/market] requestId=${requestId} conditionId=${conditionId} error=${message}`
    );
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
