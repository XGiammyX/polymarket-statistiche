import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, getEtlState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_THRESHOLDS = new Set([0.05, 0.02, 0.01]);
const VALID_SORTS: Record<string, string> = {
  followScore: "wp.follow_score DESC",
  alphaz: "ws.alphaz DESC NULLS LAST",
  wins: "ws.wins DESC NULLS LAST",
  n: "ws.n DESC NULLS LAST",
};
const MAX_LIMIT = 200;
const MAX_MIN_N = 1000;

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  const start = Date.now();

  try {
    const url = req.nextUrl;

    const rawThreshold = parseFloat(url.searchParams.get("threshold") ?? "0.02");
    const threshold = VALID_THRESHOLDS.has(rawThreshold) ? rawThreshold : 0.02;

    const rawMinN = parseInt(url.searchParams.get("minN") ?? "20", 10);
    const minN = Math.max(0, Math.min(isNaN(rawMinN) ? 20 : rawMinN, MAX_MIN_N));

    const onlyFollowable = url.searchParams.get("onlyFollowable") === "true";

    const rawLimit = parseInt(url.searchParams.get("limit") ?? "100", 10);
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 100 : rawLimit, MAX_LIMIT));

    const sortKey = url.searchParams.get("sort") ?? "followScore";
    const orderBy = VALID_SORTS[sortKey] ?? VALID_SORTS.followScore;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    params.push(threshold);
    const thresholdParam = paramIdx++;

    conditions.push(`COALESCE(ws.n, 0) >= $${paramIdx}`);
    params.push(minN);
    paramIdx++;

    if (onlyFollowable) {
      conditions.push(`wp.is_followable = true`);
    }

    params.push(limit);
    const limitParam = paramIdx++;

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        wp.wallet,
        wp.follow_score,
        wp.is_followable,
        COALESCE(ws.n, 0)::int             AS n,
        COALESCE(ws.wins, 0)::int           AS wins,
        COALESCE(ws.expected_wins, 0)       AS expected_wins,
        COALESCE(ws.variance, 0)            AS variance,
        COALESCE(ws.alphaz, 0)              AS alphaz,
        wp.hedge_rate,
        wp.late_sniping_rate,
        wp.last_trade_at
      FROM wallet_profiles wp
      LEFT JOIN wallet_stats ws
        ON ws.wallet = wp.wallet AND ws.threshold = $${thresholdParam}
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${limitParam}
    `;

    const result = await query(sql, params);

    const items = result.rows.map((r: Record<string, unknown>) => ({
      wallet: r.wallet,
      followScore: r.follow_score,
      isFollowable: r.is_followable,
      n: r.n,
      wins: r.wins,
      expectedWins: r.expected_wins,
      variance: r.variance,
      alphaz: r.alphaz,
      hedgeRate: r.hedge_rate,
      lateSnipingRate: r.late_sniping_rate,
      lastTradeAt: r.last_trade_at,
    }));

    const updatedAt = await getEtlState("last_compute_at", "");

    const durationMs = Date.now() - start;
    console.log(
      `[/api/leaderboard] requestId=${requestId} threshold=${threshold} sort=${sortKey} items=${items.length} durationMs=${durationMs}`
    );

    return NextResponse.json({
      ok: true,
      updatedAt: updatedAt || null,
      threshold,
      count: items.length,
      items,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/leaderboard] requestId=${requestId} error=${message}`);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
