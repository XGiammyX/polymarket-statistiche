import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, getEtlState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  const start = Date.now();

  try {
    // 1) Top wallets with profile data
    const walletsRes = await query(
      `SELECT
         wp.wallet,
         wp.follow_score,
         wp.is_followable,
         wp.n_02,
         wp.alphaz_02,
         wp.hedge_rate,
         wp.late_sniping_rate,
         wp.last_trade_at
       FROM wallet_profiles wp
       WHERE wp.follow_score > 0
       ORDER BY wp.follow_score DESC
       LIMIT 20`
    );

    // 1b) Stats for those wallets
    const walletAddrs = walletsRes.rows.map((r: Record<string, unknown>) => r.wallet as string);
    const statsRes = walletAddrs.length > 0
      ? await query(
          `SELECT wallet, threshold, n, wins, expected_wins, alphaz
           FROM wallet_stats
           WHERE wallet = ANY($1)
           ORDER BY wallet, threshold`,
          [walletAddrs]
        )
      : { rows: [] };

    // 2) Recent low-prob BUY trades from TOP wallets (last 14 days) — actionable signals
    const signalsRes = await query(
      `SELECT
         t.wallet,
         t.ts,
         t.condition_id,
         t.price,
         t.size,
         t.outcome_index,
         t.side,
         m.question,
         m.slug,
         m.end_date,
         m.closed,
         wp.follow_score,
         wp.alphaz_02,
         wp.is_followable,
         wpos.net_shares
       FROM trades t
       JOIN wallet_profiles wp ON wp.wallet = t.wallet
       LEFT JOIN markets m ON m.condition_id = t.condition_id
       LEFT JOIN wallet_positions wpos ON wpos.wallet = t.wallet AND wpos.condition_id = t.condition_id AND wpos.outcome_index = t.outcome_index
       WHERE t.side = 'BUY'
         AND t.price <= 0.05
         AND t.price > 0
         AND t.ts >= NOW() - interval '14 days'
         AND wp.follow_score > 0
       ORDER BY wp.follow_score DESC, t.ts DESC
       LIMIT 50`
    );

    // 3) Open positions from top wallets — what they're still holding
    const positionsRes = await query(
      `SELECT
         wpos.wallet,
         wpos.condition_id,
         wpos.outcome_index,
         wpos.net_shares,
         wpos.last_trade_at,
         m.question,
         m.slug,
         m.end_date,
         m.closed,
         wp.follow_score,
         wp.alphaz_02,
         wp.is_followable
       FROM wallet_positions wpos
       JOIN wallet_profiles wp ON wp.wallet = wpos.wallet
       LEFT JOIN markets m ON m.condition_id = wpos.condition_id
       WHERE wpos.net_shares > 0.5
         AND wp.follow_score > 0
       ORDER BY wp.follow_score DESC, wpos.last_trade_at DESC
       LIMIT 30`
    );

    // 4) Recent "upset wins" — proof these wallets actually win longshots
    const upsetWinsRes = await query(
      `SELECT
         t.wallet,
         t.ts,
         t.condition_id,
         t.price,
         t.size,
         t.outcome_index,
         m.question,
         m.slug,
         wp.follow_score,
         wp.alphaz_02
       FROM trades t
       JOIN resolutions r ON r.condition_id = t.condition_id
       JOIN wallet_profiles wp ON wp.wallet = t.wallet
       LEFT JOIN markets m ON m.condition_id = t.condition_id
       WHERE t.side = 'BUY'
         AND t.price <= 0.05
         AND t.price > 0
         AND t.outcome_index = r.winning_outcome_index
         AND wp.follow_score > 0
       ORDER BY t.ts DESC
       LIMIT 20`
    );

    const lastComputeAt = await getEtlState("last_compute_at", "");
    const lastSyncAt = await getEtlState("last_sync_at", "");
    const lastLiveSyncAt = await getEtlState("last_live_sync_at", "");

    // Build stats map: wallet -> stats[]
    const statsMap = new Map<string, Array<Record<string, unknown>>>();
    for (const r of statsRes.rows as Record<string, unknown>[]) {
      const w = r.wallet as string;
      if (!statsMap.has(w)) statsMap.set(w, []);
      statsMap.get(w)!.push({ threshold: r.threshold, n: r.n, wins: r.wins, expected_wins: r.expected_wins, alphaz: r.alphaz });
    }

    // Transform data
    const topWallets = walletsRes.rows.map((r: Record<string, unknown>) => ({
      wallet: r.wallet,
      followScore: r.follow_score,
      isFollowable: r.is_followable,
      n: r.n_02,
      alphaz: r.alphaz_02,
      hedgeRate: r.hedge_rate,
      lateRate: r.late_sniping_rate,
      lastTradeAt: r.last_trade_at,
      stats: statsMap.get(r.wallet as string) ?? [],
    }));

    const recentSignals = signalsRes.rows.map((r: Record<string, unknown>) => ({
      wallet: r.wallet,
      ts: r.ts,
      conditionId: r.condition_id,
      price: r.price,
      size: r.size,
      outcomeIndex: r.outcome_index,
      question: r.question,
      slug: r.slug,
      endDate: r.end_date,
      closed: r.closed,
      followScore: r.follow_score,
      alphaz: r.alphaz_02,
      isFollowable: r.is_followable,
      currentPrice: null,
      netShares: r.net_shares,
    }));

    const openPositions = positionsRes.rows.map((r: Record<string, unknown>) => ({
      wallet: r.wallet,
      conditionId: r.condition_id,
      outcomeIndex: r.outcome_index,
      netShares: r.net_shares,
      lastTradeAt: r.last_trade_at,
      question: r.question,
      slug: r.slug,
      endDate: r.end_date,
      closed: r.closed,
      currentPrice: null,
      followScore: r.follow_score,
      alphaz: r.alphaz_02,
      isFollowable: r.is_followable,
    }));

    const provenWins = upsetWinsRes.rows.map((r: Record<string, unknown>) => ({
      wallet: r.wallet,
      ts: r.ts,
      conditionId: r.condition_id,
      price: r.price,
      size: r.size,
      outcomeIndex: r.outcome_index,
      question: r.question,
      slug: r.slug,
      followScore: r.follow_score,
      alphaz: r.alphaz_02,
      payout: Number(r.size) * (1 / Number(r.price)),
    }));

    const durationMs = Date.now() - start;
    console.log(`[/api/recommendations] requestId=${requestId} wallets=${topWallets.length} signals=${recentSignals.length} positions=${openPositions.length} durationMs=${durationMs}`);

    return NextResponse.json({
      ok: true,
      requestId,
      durationMs,
      lastComputeAt: lastComputeAt || null,
      lastSyncAt: lastSyncAt || null,
      lastLiveSyncAt: lastLiveSyncAt || null,
      topWallets,
      recentSignals,
      openPositions,
      provenWins,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/recommendations] requestId=${requestId} error=${message}`);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
