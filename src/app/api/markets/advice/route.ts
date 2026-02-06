import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const minConfidence = Math.max(0, Number(url.searchParams.get("minConfidence")) || 0);
  const onlyOpen = url.searchParams.get("onlyOpen") !== "false";

  const res = await query(
    `SELECT
       ma.condition_id,
       ma.p_mkt_yes,
       ma.p_model_yes,
       ma.confidence,
       ma.p_low,
       ma.p_high,
       ma.net_yes_shares,
       ma.net_no_shares,
       ma.flow_yes_cost,
       ma.flow_no_cost,
       ma.top_drivers,
       ma.top_wallets,
       ma.updated_at,
       m.question,
       m.slug,
       m.event_slug,
       m.end_date,
       m.closed,
       m.outcomes
     FROM market_advice ma
     JOIN markets m ON m.condition_id = ma.condition_id
     WHERE ma.confidence >= $1
       AND ($2 = false OR m.closed = false OR m.closed IS NULL)
     ORDER BY ma.confidence DESC, ma.updated_at DESC
     LIMIT $3`,
    [minConfidence, onlyOpen, limit]
  );

  const markets = (res.rows as Record<string, unknown>[]).map((row) => {
    let outcomes: string[] = [];
    try {
      const raw = row.outcomes;
      outcomes = typeof raw === "string" ? JSON.parse(raw) : (raw as string[]) ?? [];
    } catch { /* empty */ }

    const pModelYes = Number(row.p_model_yes);
    const pModelNo = 1 - pModelYes;

    // Extract main driver (strongest non-baseline)
    let mainDriver = "";
    try {
      const drivers = row.top_drivers as Array<{ name: string; effect: string; value: number }> | null;
      if (drivers) {
        const nonBaseline = drivers.filter((d) => d.name !== "Prezzo di mercato (baseline)" && d.effect !== "neutro");
        if (nonBaseline.length > 0) {
          mainDriver = `${nonBaseline[0].name}: ${nonBaseline[0].effect}`;
        }
      }
    } catch { /* empty */ }

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
      recommendedSide: pModelYes >= 0.5 ? "YES" : "NO",
      recommendedProb: Math.max(pModelYes, pModelNo),
      mainDriver,
      updatedAt: row.updated_at,
    };
  });

  return NextResponse.json({ ok: true, count: markets.length, markets });
}
