import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { checkAdminAuth } from "@/lib/adminAuth";
import { setEtlState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  if (!checkAdminAuth(req)) {
    return NextResponse.json(
      { ok: false, requestId, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await setEtlState("markets_offset", "0");
    return NextResponse.json({
      ok: true,
      requestId,
      message: "markets_offset reset to 0",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
