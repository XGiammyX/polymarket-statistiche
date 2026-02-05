import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCronSecret } from "./env";
import { tryAdvisoryLock, unlockAdvisoryLock } from "./locks";
import { query } from "./db";

export interface CronContext {
  requestId: string;
  startMs: number;
  elapsed: () => number;
}

export interface CronResult {
  summary: Record<string, unknown>;
  status?: "success" | "partial";
}

interface CronGuardOptions {
  jobName: string;
  lockKey: number;
  handler: (ctx: CronContext) => Promise<CronResult>;
}

function checkCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token === getCronSecret();
}

async function insertEtlRun(
  job: string,
  requestId: string
): Promise<string> {
  const res = await query(
    `INSERT INTO etl_runs (job, request_id, status, started_at)
     VALUES ($1, $2, 'running', now())
     RETURNING id::text`,
    [job, requestId]
  );
  return res.rows[0]?.id as string;
}

async function updateEtlRun(
  runId: string,
  status: string,
  summary?: Record<string, unknown>,
  error?: string
): Promise<void> {
  await query(
    `UPDATE etl_runs
     SET finished_at = now(),
         status = $2,
         summary = $3,
         error = $4
     WHERE id = $1::bigint`,
    [runId, status, summary ? JSON.stringify(summary) : null, error ?? null]
  );
}

export function withCronGuard(options: CronGuardOptions) {
  const { jobName, lockKey, handler } = options;

  return async function GET(req: NextRequest): Promise<NextResponse> {
    const requestId = randomUUID();
    const startMs = Date.now();

    if (!checkCronAuth(req)) {
      return NextResponse.json(
        { ok: false, requestId, error: "Unauthorized" },
        { status: 401 }
      );
    }

    let locked = false;
    let runId: string | null = null;

    try {
      locked = await tryAdvisoryLock(lockKey);

      if (!locked) {
        console.log(`[${jobName}] requestId=${requestId} skipped: lock held`);
        // Log skipped run
        try {
          const id = await insertEtlRun(jobName, requestId);
          await updateEtlRun(id, "skipped", { reason: "lock" });
        } catch { /* best effort */ }

        return NextResponse.json({
          ok: true,
          requestId,
          skipped: true,
          reason: "lock",
        });
      }

      runId = await insertEtlRun(jobName, requestId);

      const ctx: CronContext = {
        requestId,
        startMs,
        elapsed: () => Date.now() - startMs,
      };

      const result = await handler(ctx);
      const durationMs = Date.now() - startMs;
      const status = result.status ?? "success";

      await updateEtlRun(runId, status, {
        ...result.summary,
        durationMs,
      });

      const report = {
        ok: true,
        requestId,
        durationMs,
        status,
        ...result.summary,
      };

      console.log(`[/api/cron/${jobName}]`, JSON.stringify(report));
      return NextResponse.json(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[/api/cron/${jobName}] requestId=${requestId} error=${message}`
      );

      if (runId) {
        try {
          await updateEtlRun(runId, "error", undefined, message);
        } catch { /* best effort */ }
      }

      return NextResponse.json(
        { ok: false, requestId, error: message },
        { status: 500 }
      );
    } finally {
      if (locked) {
        try {
          await unlockAdvisoryLock(lockKey);
        } catch (err) {
          console.error(
            `[${jobName}] unlock error: ${
              err instanceof Error ? err.message : err
            }`
          );
        }
      }
    }
  };
}
