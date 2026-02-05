import { NextRequest, NextResponse } from "next/server";
import { fetchMarketsPage } from "@/lib/polymarket";
import { randomUUID } from "crypto";
import { IS_PROD } from "@/lib/env";
import { checkAdminAuth } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  const start = Date.now();

  if (IS_PROD && !checkAdminAuth(req)) {
    return NextResponse.json(
      { ok: false, requestId, error: "Debug endpoints require ADMIN_SECRET in production" },
      { status: 403 }
    );
  }

  try {
    const url = req.nextUrl;
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const closedParam = url.searchParams.get("closed");
    const closed =
      closedParam === "true" ? true : closedParam === "false" ? false : undefined;

    const result = await fetchMarketsPage({ limit, offset, closed });

    const summary = {
      requestId,
      rawCount: result.raw.length,
      normalizedCount: result.normalized.length,
      durationMs: Date.now() - start,
    };

    console.log("[/api/debug/markets]", JSON.stringify(summary));

    return NextResponse.json({
      ok: true,
      ...summary,
      sample: result.normalized.slice(0, 5),
      normalized: result.normalized,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/debug/markets] requestId=${requestId} error=${message}`);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
