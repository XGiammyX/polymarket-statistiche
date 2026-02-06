import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, getEtlState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_THRESHOLDS = new Set([0.05, 0.02, 0.01]);
const MAX_LIMIT = 300;
const MAX_HOURS = 168;

function isValidAddress(addr: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(addr);
}

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  const start = Date.now();

  try {
    const url = req.nextUrl;

    const rawThreshold = parseFloat(url.searchParams.get("threshold") ?? "0.02");
    const threshold = VALID_THRESHOLDS.has(rawThreshold) ? rawThreshold : 0.02;

    const rawHours = parseInt(url.searchParams.get("hours") ?? "72", 10);
    const hours = Math.max(1, Math.min(isNaN(rawHours) ? 72 : rawHours, MAX_HOURS));

    const onlyFollowable = url.searchParams.get("onlyFollowable") !== "false";
    const activeOnly = url.searchParams.get("activeOnly") !== "false";

    const rawLimit = parseInt(url.searchParams.get("limit") ?? "100", 10);
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 100 : rawLimit, MAX_LIMIT));

    const walletParam = url.searchParams.get("wallet") ?? "";
    const walletFilter = walletParam && isValidAddress(walletParam.toLowerCase())
      ? walletParam.toLowerCase()
      : null;

    const conditions: string[] = [
      `t.side = 'BUY'`,
      `t.price <= $1`,
      `t.price >= 0`,
      `t.ts >= NOW() - ($2 || ' hours')::interval`,
    ];
    const params: unknown[] = [threshold, String(hours)];
    let paramIdx = 3;

    if (walletFilter) {
      conditions.push(`t.wallet = $${paramIdx}`);
      params.push(walletFilter);
      paramIdx++;
    }

    if (onlyFollowable) {
      conditions.push(
        `t.wallet IN (SELECT wallet FROM wallet_profiles WHERE is_followable = true)`
      );
    }

    if (activeOnly) {
      conditions.push(`wp.net_shares > 0`);
    }

    params.push(limit);
    const limitParam = paramIdx++;

    const joinWp = activeOnly
      ? `JOIN wallet_positions wp ON wp.wallet = t.wallet AND wp.condition_id = t.condition_id AND wp.outcome_index = t.outcome_index`
      : `LEFT JOIN wallet_positions wp ON wp.wallet = t.wallet AND wp.condition_id = t.condition_id AND wp.outcome_index = t.outcome_index`;

    const sql = `
      SELECT
        t.wallet,
        t.ts,
        t.condition_id,
        t.price AS entry_price,
        t.size,
        t.outcome_index,
        m.question,
        m.slug,
        m.end_date,
        m.closed,
        (m.clob_token_ids->>t.outcome_index::int) AS token_id,
        tp.price AS current_price,
        wp.net_shares
      FROM trades t
      ${joinWp}
      LEFT JOIN markets m ON m.condition_id = t.condition_id
      LEFT JOIN token_prices tp ON tp.token_id = (m.clob_token_ids->>t.outcome_index::int)
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.ts DESC
      LIMIT $${limitParam}
    `;

    const result = await query(sql, params);

    const signals = result.rows.map((r: Record<string, unknown>) => ({
      wallet: r.wallet,
      ts: r.ts,
      conditionId: r.condition_id,
      entryPrice: r.entry_price,
      currentPrice: r.current_price ?? null,
      size: r.size,
      outcomeIndex: r.outcome_index,
      netShares: r.net_shares ?? null,
      question: r.question,
      slug: r.slug,
      endDate: r.end_date,
      closed: r.closed,
    }));

    const lastLiveSyncAt = await getEtlState("last_live_sync_at", "");

    const durationMs = Date.now() - start;
    console.log(
      `[/api/signals] requestId=${requestId} threshold=${threshold} hours=${hours} activeOnly=${activeOnly} count=${signals.length} durationMs=${durationMs}`
    );

    return NextResponse.json({
      ok: true,
      threshold,
      hours,
      activeOnly,
      count: signals.length,
      lastLiveSyncAt: lastLiveSyncAt || null,
      signals,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/signals] requestId=${requestId} error=${message}`);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
