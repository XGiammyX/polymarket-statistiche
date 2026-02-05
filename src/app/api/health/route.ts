import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, getEtlState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  const start = Date.now();

  try {
    const [
      marketsRes,
      resolutionsRes,
      tradesRes,
      backlogRes,
      coolingRes,
      recentRunsRes,
    ] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM markets"),
      query("SELECT COUNT(*)::int AS count FROM resolutions"),
      query("SELECT COUNT(*)::int AS count FROM trades"),
      query(
        "SELECT COUNT(*)::int AS count FROM trade_backfill WHERE done = false"
      ),
      query(
        `SELECT COUNT(*)::int AS count FROM trade_backfill
         WHERE done = false AND next_retry_at IS NOT NULL AND next_retry_at > now()`
      ),
      query(
        `SELECT id, job, started_at, finished_at, status, request_id,
                EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - started_at))::int AS duration_sec,
                LEFT(error, 200) AS error_preview
         FROM etl_runs
         WHERE job IN ('sync','compute')
         ORDER BY started_at DESC
         LIMIT 10`
      ),
    ]);

    const [lastSyncAt, lastComputeAt] = await Promise.all([
      getEtlState("last_sync_at", ""),
      getEtlState("last_compute_at", ""),
    ]);

    const durationMs = Date.now() - start;

    return NextResponse.json({
      ok: true,
      requestId,
      durationMs,
      counts: {
        markets: marketsRes.rows[0]?.count ?? 0,
        resolutions: resolutionsRes.rows[0]?.count ?? 0,
        trades: tradesRes.rows[0]?.count ?? 0,
      },
      backlog: {
        pending: backlogRes.rows[0]?.count ?? 0,
        coolingDown: coolingRes.rows[0]?.count ?? 0,
      },
      lastSyncAt: lastSyncAt || null,
      lastComputeAt: lastComputeAt || null,
      recentRuns: recentRunsRes.rows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/health] requestId=${requestId} error=${message}`);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
