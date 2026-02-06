import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { computeAdviceForMarket, upsertMarketAdvice } from "@/lib/advice/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conditionId: string }> }
) {
  const { conditionId } = await params;

  if (!conditionId || conditionId.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Invalid conditionId" },
      { status: 400 }
    );
  }

  // Try cache first (max 10 min old)
  const cached = await query(
    `SELECT ma.*, m.question, m.slug, m.event_slug, m.end_date, m.closed, m.outcomes
     FROM market_advice ma
     JOIN markets m ON m.condition_id = ma.condition_id
     WHERE ma.condition_id = $1
       AND ma.updated_at >= now() - interval '10 minutes'`,
    [conditionId]
  );

  if (cached.rows.length > 0) {
    const row = cached.rows[0] as Record<string, unknown>;
    return NextResponse.json({ ok: true, source: "cache", advice: formatRow(row) });
  }

  // Compute on-demand
  try {
    const advice = await computeAdviceForMarket(conditionId);
    if (!advice) {
      return NextResponse.json(
        { ok: false, error: "Market not found or not binary (only YES/NO markets supported)" },
        { status: 404 }
      );
    }

    // Cache it
    await upsertMarketAdvice(advice);

    return NextResponse.json({ ok: true, source: "computed", advice });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

function formatRow(row: Record<string, unknown>) {
  let outcomes: string[] = [];
  try {
    const raw = row.outcomes;
    outcomes = typeof raw === "string" ? JSON.parse(raw) : (raw as string[]) ?? [];
  } catch { /* empty */ }

  const pModelYes = Number(row.p_model_yes);
  const pModelNo = 1 - pModelYes;

  return {
    conditionId: row.condition_id,
    question: row.question,
    slug: row.slug,
    eventSlug: row.event_slug,
    endDate: row.end_date,
    closed: row.closed,
    outcomes,
    pMktYes: Number(row.p_mkt_yes),
    pModelYes,
    pModelNo,
    confidence: Number(row.confidence),
    pLow: Number(row.p_low),
    pHigh: Number(row.p_high),
    edge: Number(row.edge) || 0,
    trend: row.trend != null ? Number(row.trend) : null,
    recommendedSide: pModelYes >= 0.5 ? "YES" : "NO",
    recommendedProb: Math.max(pModelYes, pModelNo),
    netYesShares: Number(row.net_yes_shares),
    netNoShares: Number(row.net_no_shares),
    flowYesCost: Number(row.flow_yes_cost),
    flowNoCost: Number(row.flow_no_cost),
    topDrivers: row.top_drivers ?? [],
    topWallets: row.top_wallets ?? [],
    updatedAt: row.updated_at,
  };
}
