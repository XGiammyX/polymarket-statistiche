import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { checkAdminAuth } from "@/lib/adminAuth";
import { query, getEtlState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = randomUUID();

  if (!checkAdminAuth(req)) {
    return NextResponse.json(
      { ok: false, requestId, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const [
      marketsRes,
      resolutionsRes,
      tradesRes,
      backlogRes,
      coolingRes,
      recentRunsRes,
      failedBackfillRes,
    ] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM markets"),
      query("SELECT COUNT(*)::int AS count FROM resolutions"),
      query("SELECT COUNT(*)::int AS count FROM trades"),
      query("SELECT COUNT(*)::int AS count FROM trade_backfill WHERE done = false"),
      query(
        `SELECT COUNT(*)::int AS count FROM trade_backfill
         WHERE done = false AND next_retry_at IS NOT NULL AND next_retry_at > now()`
      ),
      query(
        `SELECT id, job, started_at, finished_at, status, request_id,
                EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - started_at))::int AS duration_sec,
                LEFT(error, 300) AS error_preview
         FROM etl_runs
         ORDER BY started_at DESC
         LIMIT 20`
      ),
      query(
        `SELECT condition_id, next_offset, fail_count, LEFT(last_error, 200) AS last_error, next_retry_at, updated_at
         FROM trade_backfill
         WHERE fail_count > 0
         ORDER BY fail_count DESC
         LIMIT 20`
      ),
    ]);

    const [lastSyncAt, lastComputeAt, marketsOffset] = await Promise.all([
      getEtlState("last_sync_at", ""),
      getEtlState("last_compute_at", ""),
      getEtlState("markets_offset", "0"),
    ]);

    return NextResponse.json({
      ok: true,
      requestId,
      counts: {
        markets: marketsRes.rows[0]?.count ?? 0,
        resolutions: resolutionsRes.rows[0]?.count ?? 0,
        trades: tradesRes.rows[0]?.count ?? 0,
      },
      backlog: {
        pending: backlogRes.rows[0]?.count ?? 0,
        coolingDown: coolingRes.rows[0]?.count ?? 0,
      },
      etl: {
        lastSyncAt: lastSyncAt || null,
        lastComputeAt: lastComputeAt || null,
        marketsOffset,
      },
      recentRuns: recentRunsRes.rows,
      failedBackfill: failedBackfillRes.rows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
