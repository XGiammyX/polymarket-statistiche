import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SORTS = ["confidence", "edge", "trend", "updated"] as const;
type SortKey = (typeof VALID_SORTS)[number];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const minConfidence = Math.max(0, Number(url.searchParams.get("minConfidence")) || 0);
  const onlyOpen = url.searchParams.get("onlyOpen") !== "false";
  const sortRaw = (url.searchParams.get("sort") || "confidence") as string;
  const sort: SortKey = VALID_SORTS.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : "confidence";

  const orderClause = {
    confidence: "ma.confidence DESC, ABS(ma.edge) DESC",
    edge: "ABS(ma.edge) DESC, ma.confidence DESC",
    trend: "ABS(ma.trend) DESC NULLS LAST, ma.confidence DESC",
    updated: "ma.updated_at DESC",
  }[sort];

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
       ma.edge,
       ma.trend,
       ma.prev_p_model_yes,
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
     ORDER BY ${orderClause}
     LIMIT $3`,
    [minConfidence, onlyOpen, limit]
  );

  // Summary stats
  const statsRes = await query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN ma.confidence >= 60 THEN 1 ELSE 0 END) AS high_conf,
       SUM(CASE WHEN ABS(ma.edge) > 0.05 THEN 1 ELSE 0 END) AS strong_edge,
       SUM(CASE WHEN ma.trend > 0.01 THEN 1 ELSE 0 END) AS trending_yes,
       SUM(CASE WHEN ma.trend < -0.01 THEN 1 ELSE 0 END) AS trending_no,
       ROUND(AVG(ma.confidence))::int AS avg_confidence,
       ROUND(AVG(ABS(ma.edge))::numeric, 4) AS avg_abs_edge
     FROM market_advice ma
     JOIN markets m ON m.condition_id = ma.condition_id
     WHERE ($1 = false OR m.closed = false OR m.closed IS NULL)`,
    [onlyOpen]
  );
  const stats = statsRes.rows[0] as Record<string, unknown>;

  const markets = (res.rows as Record<string, unknown>[]).map((row) => {
    let outcomes: string[] = [];
    try {
      const raw = row.outcomes;
      outcomes = typeof raw === "string" ? JSON.parse(raw) : (raw as string[]) ?? [];
    } catch { /* empty */ }

    const pModelYes = Number(row.p_model_yes);
    const pModelNo = 1 - pModelYes;
    const edge = Number(row.edge) || 0;
    const trend = row.trend != null ? Number(row.trend) : null;

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
      edge,
      trend,
      recommendedSide: pModelYes >= 0.5 ? "YES" : "NO",
      recommendedProb: Math.max(pModelYes, pModelNo),
      mainDriver,
      updatedAt: row.updated_at,
    };
  });

  return NextResponse.json({
    ok: true,
    count: markets.length,
    sort,
    stats: {
      total: Number(stats.total) || 0,
      highConf: Number(stats.high_conf) || 0,
      strongEdge: Number(stats.strong_edge) || 0,
      trendingYes: Number(stats.trending_yes) || 0,
      trendingNo: Number(stats.trending_no) || 0,
      avgConfidence: Number(stats.avg_confidence) || 0,
      avgAbsEdge: Number(stats.avg_abs_edge) || 0,
    },
    markets,
  });
}
