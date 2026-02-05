import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { checkAdminAuth } from "@/lib/adminAuth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidAddress(addr: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(addr);
}

export async function GET(req: NextRequest) {
  const requestId = randomUUID();

  if (!checkAdminAuth(req)) {
    return NextResponse.json(
      { ok: false, requestId, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const res = await query(
      `SELECT wallet, created_at FROM wallet_watchlist ORDER BY created_at DESC`
    );
    return NextResponse.json({
      ok: true,
      requestId,
      count: res.rows.length,
      wallets: res.rows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  if (!checkAdminAuth(req)) {
    return NextResponse.json(
      { ok: false, requestId, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const wallet = (body.wallet ?? "").toLowerCase();

    if (!isValidAddress(wallet)) {
      return NextResponse.json(
        { ok: false, requestId, error: "Invalid address. Expected 0x + 40 hex chars." },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO wallet_watchlist (wallet, created_at)
       VALUES ($1, now())
       ON CONFLICT (wallet) DO NOTHING`,
      [wallet]
    );

    return NextResponse.json({ ok: true, requestId, wallet, action: "added" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = randomUUID();

  if (!checkAdminAuth(req)) {
    return NextResponse.json(
      { ok: false, requestId, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const wallet = (body.wallet ?? "").toLowerCase();

    if (!isValidAddress(wallet)) {
      return NextResponse.json(
        { ok: false, requestId, error: "Invalid address." },
        { status: 400 }
      );
    }

    await query(`DELETE FROM wallet_watchlist WHERE wallet = $1`, [wallet]);

    return NextResponse.json({ ok: true, requestId, wallet, action: "removed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
