import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_THRESHOLDS = new Set([0.05, 0.02, 0.01]);
const MAX_UPSET_WINS = 100;

function isValidAddress(addr: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(addr);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const requestId = randomUUID();
  const start = Date.now();
  const { address } = await params;
  const wallet = address.toLowerCase();

  if (!isValidAddress(wallet)) {
    return NextResponse.json(
      { ok: false, requestId, error: "Invalid wallet address. Expected 0x + 40 hex chars." },
      { status: 400 }
    );
  }

  try {
    const url = req.nextUrl;
    const rawThreshold = parseFloat(url.searchParams.get("threshold") ?? "0.02");
    const threshold = VALID_THRESHOLDS.has(rawThreshold) ? rawThreshold : 0.02;
    const rawLimit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const upsetLimit = Math.max(1, Math.min(isNaN(rawLimit) ? 50 : rawLimit, MAX_UPSET_WINS));

    // 1) wallet_profiles
    const profileRes = await query(
      `SELECT * FROM wallet_profiles WHERE wallet = $1`,
      [wallet]
    );
    const profile = profileRes.rows[0] ?? null;

    // 2) wallet_stats (all 3 thresholds)
    const statsRes = await query(
      `SELECT threshold, n, wins, expected_wins, variance, alphaz, updated_at
       FROM wallet_stats
       WHERE wallet = $1
       ORDER BY threshold DESC`,
      [wallet]
    );
    const stats = statsRes.rows.map((r: Record<string, unknown>) => ({
      threshold: r.threshold,
      n: r.n,
      wins: r.wins,
      expectedWins: r.expected_wins,
      variance: r.variance,
      alphaz: r.alphaz,
    }));

    // 3) Upset wins for selected threshold
    const upsetRes = await query(
      `SELECT
         t.condition_id,
         t.ts,
         t.price,
         t.size,
         t.outcome_index,
         m.question
       FROM trades t
       JOIN resolutions r ON r.condition_id = t.condition_id
       JOIN markets m ON m.condition_id = t.condition_id
       WHERE t.wallet = $1
         AND t.side = 'BUY'
         AND t.price <= $2
         AND t.price >= 0
         AND t.outcome_index = r.winning_outcome_index
       ORDER BY t.ts DESC
       LIMIT $3`,
      [wallet, threshold, upsetLimit]
    );
    const upsetWins = upsetRes.rows.map((r: Record<string, unknown>) => ({
      conditionId: r.condition_id,
      ts: r.ts,
      price: r.price,
      size: r.size,
      outcomeIndex: r.outcome_index,
      question: r.question,
    }));

    // 4) Recent low-prob BUY bets (including unresolved markets, last 7 days)
    const recentBetsRes = await query(
      `SELECT
         t.condition_id,
         t.ts,
         t.price,
         t.size,
         t.outcome_index,
         m.question,
         m.slug,
         m.closed
       FROM trades t
       LEFT JOIN markets m ON m.condition_id = t.condition_id
       WHERE t.wallet = $1
         AND t.side = 'BUY'
         AND t.price <= 0.05
         AND t.price >= 0
         AND t.ts >= NOW() - interval '7 days'
       ORDER BY t.ts DESC
       LIMIT 50`,
      [wallet]
    );
    const recentBets = recentBetsRes.rows.map((r: Record<string, unknown>) => ({
      conditionId: r.condition_id,
      ts: r.ts,
      price: r.price,
      size: r.size,
      outcomeIndex: r.outcome_index,
      question: r.question,
      slug: r.slug,
      closed: r.closed,
    }));

    const durationMs = Date.now() - start;
    console.log(
      `[/api/wallet] requestId=${requestId} wallet=${wallet} durationMs=${durationMs}`
    );

    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    };

    if (!profile) {
      return NextResponse.json({
        ok: true,
        wallet,
        profile: null,
        stats,
        upsetWins,
        recentBets,
        threshold,
        message: "No profile found. Wallet may not have enough low-prob trades.",
      }, { headers: cacheHeaders });
    }

    return NextResponse.json({
      ok: true,
      wallet,
      profile: {
        followScore: profile.follow_score,
        isFollowable: profile.is_followable,
        n02: profile.n_02,
        alphaz02: profile.alphaz_02,
        hedgeRate: profile.hedge_rate,
        lateSnipingRate: profile.late_sniping_rate,
        lastTradeAt: profile.last_trade_at,
        updatedAt: profile.updated_at,
      },
      stats,
      upsetWins,
      recentBets,
      threshold,
    }, { headers: cacheHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/wallet] requestId=${requestId} error=${message}`);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
