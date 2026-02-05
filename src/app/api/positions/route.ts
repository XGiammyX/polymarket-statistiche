import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 500;

function isValidAddress(addr: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(addr);
}

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  const start = Date.now();

  try {
    const url = req.nextUrl;

    const onlyFollowable = url.searchParams.get("onlyFollowable") !== "false";
    const rawLimit = parseInt(url.searchParams.get("limit") ?? "200", 10);
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 200 : rawLimit, MAX_LIMIT));
    const rawMinShares = parseFloat(url.searchParams.get("minNetShares") ?? "0.000001");
    const minNetShares = isNaN(rawMinShares) ? 0.000001 : Math.max(0, rawMinShares);

    const walletParam = url.searchParams.get("wallet") ?? "";
    const walletFilter = walletParam && isValidAddress(walletParam.toLowerCase())
      ? walletParam.toLowerCase()
      : null;

    const conditions: string[] = [`wp.net_shares > $1`];
    const params: unknown[] = [minNetShares];
    let paramIdx = 2;

    if (walletFilter) {
      conditions.push(`wp.wallet = $${paramIdx}`);
      params.push(walletFilter);
      paramIdx++;
    }

    if (onlyFollowable) {
      conditions.push(
        `wp.wallet IN (SELECT wallet FROM wallet_profiles WHERE is_followable = true)`
      );
    }

    params.push(limit);
    const limitParam = paramIdx++;

    const sql = `
      SELECT
        wp.wallet,
        wp.condition_id,
        wp.outcome_index,
        wp.net_shares,
        wp.last_trade_at,
        m.question,
        m.slug,
        m.end_date,
        m.closed,
        (m.clob_token_ids->>wp.outcome_index::int) AS token_id,
        tp.price AS current_price
      FROM wallet_positions wp
      LEFT JOIN markets m ON m.condition_id = wp.condition_id
      LEFT JOIN token_prices tp ON tp.token_id = (m.clob_token_ids->>wp.outcome_index::int)
      WHERE ${conditions.join(" AND ")}
      ORDER BY wp.last_trade_at DESC
      LIMIT $${limitParam}
    `;

    const result = await query(sql, params);

    const positions = result.rows.map((r: Record<string, unknown>) => ({
      wallet: r.wallet,
      conditionId: r.condition_id,
      outcomeIndex: r.outcome_index,
      netShares: r.net_shares,
      lastTradeAt: r.last_trade_at,
      question: r.question,
      slug: r.slug,
      endDate: r.end_date,
      closed: r.closed,
      tokenId: r.token_id ?? null,
      currentPrice: r.current_price ?? null,
    }));

    const durationMs = Date.now() - start;
    console.log(
      `[/api/positions] requestId=${requestId} count=${positions.length} durationMs=${durationMs}`
    );

    return NextResponse.json({
      ok: true,
      count: positions.length,
      positions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/positions] requestId=${requestId} error=${message}`);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
