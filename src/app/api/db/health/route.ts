import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  const start = Date.now();

  try {
    await query("SELECT 1");
    const durationMs = Date.now() - start;

    console.log(`[/api/db/health] requestId=${requestId} ok durationMs=${durationMs}`);

    return NextResponse.json({
      ok: true,
      requestId,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/db/health] requestId=${requestId} error=${message}`);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
