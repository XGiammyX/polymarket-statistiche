import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getCronSecret } from "@/lib/env";

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
    const origin = req.nextUrl.origin;
    const res = await fetch(`${origin}/api/cron/compute-markets`, {
      method: "GET",
      headers: { Authorization: `Bearer ${getCronSecret()}` },
    });
    const json = await res.json();
    return NextResponse.json({ ok: true, requestId, result: json });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
