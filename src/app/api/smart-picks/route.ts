import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, getEtlState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Smart Picks Engine — Automates the entire analysis workflow:
 *
 * 1. Find wallets with ROBUST edge (αZ > 0 at multiple thresholds, low hedge, low late)
 * 2. Find their recent BUY trades on OPEN markets (not yet resolved)
 * 3. Group by market+outcome to detect CONVERGENCE (multiple smart wallets → same bet)
 * 4. Calculate Expected Value and confidence score
 * 5. Suggest bankroll allocation based on Kelly-inspired sizing
 * 6. Detect position exits (wallets that sold = exit signal)
 */
export async function GET() {
  const requestId = randomUUID();
  const start = Date.now();

  try {
    // ═══ STEP 1: Find wallets with robust edge ═══
    // Must have αZ > 0 at threshold 0.02 AND at least one other threshold
    // Must have hedge_rate ≤ 0.25, late ≤ 0.60
    const smartWalletsRes = await query(
      `WITH multi_threshold AS (
         SELECT
           ws.wallet,
           COUNT(*) FILTER (WHERE ws.alphaz > 0) as positive_thresholds,
           COUNT(*) as total_thresholds,
           MAX(ws.n) as max_n,
           MAX(ws.alphaz) as best_alphaz,
           json_agg(json_build_object(
             'threshold', ws.threshold,
             'n', ws.n,
             'wins', ws.wins,
             'expected_wins', ws.expected_wins,
             'alphaz', ws.alphaz
           ) ORDER BY ws.threshold) as stats
         FROM wallet_stats ws
         WHERE ws.n >= 3
         GROUP BY ws.wallet
         HAVING COUNT(*) FILTER (WHERE ws.alphaz > 0) >= 1
       )
       SELECT
         wp.wallet,
         wp.follow_score,
         wp.is_followable,
         wp.n_02,
         COALESCE(wp.alphaz_02, mt.best_alphaz) as alphaz_02,
         wp.hedge_rate,
         wp.late_sniping_rate,
         wp.last_trade_at,
         mt.positive_thresholds,
         mt.total_thresholds,
         mt.max_n,
         mt.best_alphaz,
         mt.stats
       FROM wallet_profiles wp
       JOIN multi_threshold mt ON mt.wallet = wp.wallet
       WHERE wp.hedge_rate <= 0.50
         AND wp.late_sniping_rate <= 0.80
       ORDER BY mt.best_alphaz DESC, mt.positive_thresholds DESC
       LIMIT 50`
    );

    const smartWallets = smartWalletsRes.rows.map((r: Record<string, unknown>) => ({
      wallet: r.wallet as string,
      followScore: Number(r.follow_score),
      isFollowable: r.is_followable as boolean,
      n: Number(r.n_02),
      alphaz: Number(r.alphaz_02),
      hedgeRate: Number(r.hedge_rate),
      lateRate: Number(r.late_sniping_rate),
      lastTradeAt: r.last_trade_at as string | null,
      positiveThresholds: Number(r.positive_thresholds),
      totalThresholds: Number(r.total_thresholds),
      maxN: Number(r.max_n),
      stats: r.stats as Array<{ threshold: number; n: number; wins: number; expected_wins: number; alphaz: number }>,
    }));

    const smartWalletAddrs = smartWallets.map((w) => w.wallet);

    // ═══ STEP 2: Find recent trades on OPEN markets ═══
    const tradesRes = smartWalletAddrs.length > 0
      ? await query(
          `SELECT
             t.wallet,
             t.ts,
             t.condition_id,
             t.price,
             t.size,
             t.outcome_index,
             m.question,
             m.slug,
             m.event_slug,
             m.group_item_title,
             m.end_date,
             m.closed,
             m.outcomes
           FROM trades t
           JOIN markets m ON m.condition_id = t.condition_id
           WHERE t.wallet = ANY($1)
             AND t.side = 'BUY'
             AND t.price <= 0.15
             AND t.price > 0
             AND t.ts >= NOW() - interval '30 days'
             AND (m.closed = false OR m.closed IS NULL)
             AND m.question IS NOT NULL AND m.question != ''
             AND (m.event_slug IS NOT NULL OR m.slug IS NOT NULL)
           ORDER BY t.ts DESC`,
          [smartWalletAddrs]
        )
      : { rows: [] };

    // ═══ STEP 3: Group by market+outcome → detect CONVERGENCE ═══
    const walletMap = new Map(smartWallets.map((w) => [w.wallet, w]));

    interface TradeEntry {
      wallet: string;
      ts: string;
      price: number;
      size: number;
      followScore: number;
      alphaz: number;
      isFollowable: boolean;
      positiveThresholds: number;
    }

    interface MarketPick {
      conditionId: string;
      outcomeIndex: number;
      question: string;
      slug: string;
      eventSlug: string | null;
      groupItemTitle: string | null;
      endDate: string | null;
      outcomes: string[] | null;
      trades: TradeEntry[];
      // Computed
      walletCount: number;
      followableCount: number;
      avgAlphaZ: number;
      maxAlphaZ: number;
      bestFollowScore: number;
      avgEntryPrice: number;
      totalVolume: number;
      latestTrade: string;
      convergenceScore: number;
      expectedValue: number;
      confidence: "ALTA" | "MEDIA" | "BASSA";
      suggestedSizePercent: number;
      potentialReturn: number;
      outcomeName: string;
    }

    const pickMap = new Map<string, MarketPick>();

    for (const row of tradesRes.rows as Record<string, unknown>[]) {
      const key = `${row.condition_id}-${row.outcome_index}`;
      const w = walletMap.get(row.wallet as string);
      if (!w) continue;

      const trade: TradeEntry = {
        wallet: row.wallet as string,
        ts: row.ts as string,
        price: Number(row.price),
        size: Number(row.size),
        followScore: w.followScore,
        alphaz: w.alphaz,
        isFollowable: w.isFollowable,
        positiveThresholds: w.positiveThresholds,
      };

      if (!pickMap.has(key)) {
        let outcomes: string[] | null = null;
        try {
          outcomes = typeof row.outcomes === "string" ? JSON.parse(row.outcomes) : row.outcomes as string[];
        } catch { /* ignore */ }

        const outIdx = Number(row.outcome_index);
        const outcomeName = outcomes && outcomes[outIdx] ? outcomes[outIdx] : `Outcome #${outIdx}`;

        pickMap.set(key, {
          conditionId: row.condition_id as string,
          outcomeIndex: outIdx,
          question: (row.question as string) || "",
          slug: (row.slug as string) || "",
          eventSlug: (row.event_slug as string) || null,
          groupItemTitle: (row.group_item_title as string) || null,
          endDate: row.end_date as string | null,
          outcomes,
          trades: [],
          walletCount: 0,
          followableCount: 0,
          avgAlphaZ: 0,
          maxAlphaZ: 0,
          bestFollowScore: 0,
          avgEntryPrice: 0,
          totalVolume: 0,
          latestTrade: "",
          convergenceScore: 0,
          expectedValue: 0,
          confidence: "BASSA",
          suggestedSizePercent: 0,
          potentialReturn: 0,
          outcomeName,
        });
      }

      pickMap.get(key)!.trades.push(trade);
    }

    // ═══ STEP 4: Score each pick ═══
    const picks: MarketPick[] = [];
    for (const pick of pickMap.values()) {
      const uniqueWallets = new Set(pick.trades.map((t) => t.wallet));
      pick.walletCount = uniqueWallets.size;
      pick.followableCount = new Set(pick.trades.filter((t) => t.isFollowable).map((t) => t.wallet)).size;

      const alphas = pick.trades.map((t) => t.alphaz);
      pick.avgAlphaZ = alphas.reduce((a, b) => a + b, 0) / alphas.length;
      pick.maxAlphaZ = Math.max(...alphas);
      pick.bestFollowScore = Math.max(...pick.trades.map((t) => t.followScore));

      const prices = pick.trades.map((t) => t.price);
      pick.avgEntryPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      pick.totalVolume = pick.trades.reduce((sum, t) => sum + t.size, 0);
      pick.latestTrade = pick.trades.reduce((latest, t) => (t.ts > latest ? t.ts : latest), "");

      pick.potentialReturn = pick.avgEntryPrice > 0 ? (1 / pick.avgEntryPrice - 1) * 100 : 0;

      // Convergence: more unique wallets on same bet = stronger signal
      const avgPosThresholds = pick.trades.reduce((s, t) => s + t.positiveThresholds, 0) / pick.trades.length;
      pick.convergenceScore = pick.walletCount * avgPosThresholds * Math.max(pick.avgAlphaZ, 0.1);

      // Expected Value: estimated real probability based on wallet edge
      const impliedProb = pick.avgEntryPrice;
      const edgeMultiplier = 1 + Math.max(pick.avgAlphaZ * 0.3, 0);
      const estimatedProb = Math.min(impliedProb * edgeMultiplier, 0.5);
      pick.expectedValue = estimatedProb * (1 - pick.avgEntryPrice) - (1 - estimatedProb) * pick.avgEntryPrice;

      // Confidence: multi-factor scoring
      // Points: walletCount (0-3), maxAlphaZ (0-3), followable (0-2), volume (0-1), freshness (0-1)
      let confPoints = 0;
      confPoints += Math.min(pick.walletCount, 3);                          // up to 3 pts for convergence
      confPoints += Math.min(pick.maxAlphaZ, 3);                            // up to 3 pts for best αZ
      confPoints += pick.followableCount > 0 ? 2 : 0;                      // 2 pts for verified wallet
      confPoints += pick.totalVolume > 100 ? 1 : 0;                        // 1 pt for significant volume
      const tradeAge = (Date.now() - new Date(pick.latestTrade).getTime()) / (1000 * 60 * 60 * 24);
      confPoints += tradeAge < 7 ? 1 : 0;                                  // 1 pt for fresh (< 7 days)

      if (confPoints >= 6) {
        pick.confidence = "ALTA";
      } else if (confPoints >= 3.5) {
        pick.confidence = "MEDIA";
      } else {
        pick.confidence = "BASSA";
      }

      // Suggested size: Kelly-inspired, very conservative (1/4 Kelly)
      const odds = 1 / pick.avgEntryPrice - 1;
      const edge = estimatedProb - impliedProb;
      const kellyFraction = edge > 0 && odds > 0 ? (edge / (1 / odds)) : 0;
      pick.suggestedSizePercent = Math.min(Math.max(kellyFraction * 25, 0.5), 3);

      picks.push(pick);
    }

    // Sort: ALTA first, then by convergence score
    picks.sort((a, b) => {
      const confOrder = { ALTA: 0, MEDIA: 1, BASSA: 2 };
      if (confOrder[a.confidence] !== confOrder[b.confidence]) return confOrder[a.confidence] - confOrder[b.confidence];
      return b.convergenceScore - a.convergenceScore;
    });

    // Filter out picks with missing data
    const cleanPicks = picks.filter((p) => p.question && p.slug);

    // ═══ STEP 5: Detect position exits (wallet sold recently) ═══
    // Find trades where smart wallets SOLD in last 7 days
    const exitsRes = smartWalletAddrs.length > 0
      ? await query(
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
           JOIN wallet_profiles wp ON wp.wallet = t.wallet
           LEFT JOIN markets m ON m.condition_id = t.condition_id
           WHERE t.wallet = ANY($1)
             AND t.side = 'SELL'
             AND t.ts >= NOW() - interval '7 days'
           ORDER BY t.ts DESC
           LIMIT 20`,
          [smartWalletAddrs]
        )
      : { rows: [] };

    const exitAlerts = (exitsRes.rows as Record<string, unknown>[]).map((r) => ({
      wallet: r.wallet as string,
      ts: r.ts as string,
      conditionId: r.condition_id as string,
      price: Number(r.price),
      size: Number(r.size),
      outcomeIndex: Number(r.outcome_index),
      question: r.question as string | null,
      slug: r.slug as string | null,
      followScore: Number(r.follow_score),
      alphaz: Number(r.alphaz_02),
    }));

    // ═══ STEP 6: Portfolio summary ═══
    const highConf = cleanPicks.filter((p) => p.confidence === "ALTA");
    const medConf = cleanPicks.filter((p) => p.confidence === "MEDIA");
    const totalSuggested = cleanPicks.reduce((s, p) => s + p.suggestedSizePercent, 0);

    const portfolio = {
      totalPicks: cleanPicks.length,
      highConfidence: highConf.length,
      mediumConfidence: medConf.length,
      lowConfidence: cleanPicks.length - highConf.length - medConf.length,
      totalSuggestedAllocation: Math.min(totalSuggested, 20),
      uniqueMarkets: new Set(cleanPicks.map((p) => p.conditionId)).size,
      avgPotentialReturn: cleanPicks.length > 0 ? cleanPicks.reduce((s, p) => s + p.potentialReturn, 0) / cleanPicks.length : 0,
      avgExpectedValue: cleanPicks.length > 0 ? cleanPicks.reduce((s, p) => s + p.expectedValue, 0) / cleanPicks.length : 0,
    };

    const lastComputeAt = await getEtlState("last_compute_at", "");
    const lastSyncAt = await getEtlState("last_sync_at", "");

    const durationMs = Date.now() - start;
    console.log(`[/api/smart-picks] requestId=${requestId} wallets=${smartWallets.length} picks=${cleanPicks.length} exits=${exitAlerts.length} durationMs=${durationMs}`);

    return NextResponse.json({
      ok: true,
      requestId,
      durationMs,
      lastComputeAt: lastComputeAt || null,
      lastSyncAt: lastSyncAt || null,
      smartWallets,
      picks: cleanPicks.slice(0, 20),
      exitAlerts: exitAlerts.filter((e) => e.question),
      portfolio,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/smart-picks] requestId=${requestId} error=${message}`);
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: 500 }
    );
  }
}
