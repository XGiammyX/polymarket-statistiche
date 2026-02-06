import { query } from "@/lib/db";
import {
  K_POS,
  K_FLOW,
  HALF_LIFE_HOURS,
  WINDOW_HOURS,
  EPS,
  DEFAULT_CONFIDENCE_NO_DATA,
} from "./config";

/* ── Math helpers ── */
export function logit(p: number): number {
  const clamped = Math.max(1e-6, Math.min(1 - 1e-6, p));
  return Math.log(clamped / (1 - clamped));
}

export function sigmoid(x: number): number {
  if (x > 20) return 1;
  if (x < -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

/* ── Types ── */
export interface Driver {
  name: string;
  value: number;
  effect: string;
  note: string;
}

export interface TopWallet {
  wallet: string;
  followScore: number;
  alphaz: number;
  weight: number;
  side: string;
  netShares: number;
  flowCost72h: number;
  lastTradeAt: string | null;
}

export interface MarketAdvice {
  conditionId: string;
  question: string | null;
  slug: string | null;
  eventSlug: string | null;
  endDate: string | null;
  closed: boolean;
  outcomes: string[];
  pMktYes: number;
  pModelYes: number;
  pModelNo: number;
  confidence: number;
  pLow: number;
  pHigh: number;
  recommendedSide: string;
  recommendedProb: number;
  netYesShares: number;
  netNoShares: number;
  flowYesCost: number;
  flowNoCost: number;
  topDrivers: Driver[];
  topWallets: TopWallet[];
}

/* ── Weight function (used in SQL and JS) ── */
// w(wallet) = clamp(follow_score/100, 0.01, 1) * clamp((alphaz+1)/6, 0.01, 1)
// Minimum weight 0.01 so ALL wallets contribute something

/* ── Compute advice for a single market — optimized: 2 queries ── */
export async function computeAdviceForMarket(
  conditionId: string
): Promise<MarketAdvice | null> {
  // ── QUERY 1: Market + positions + flows + hedge in one query ──
  const aggRes = await query(
    `SELECT
       m.condition_id, m.question, m.slug, m.event_slug, m.end_date,
       m.closed, m.outcomes, m.outcome_prices,
       pos.positions_json,
       hedge.hedged, hedge.total AS hedge_total,
       flow.flows_json
     FROM markets m
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'oi', sub.outcome_index, 'ws', sub.ws, 'rs', sub.rs, 'wc', sub.wc
       )) AS positions_json
       FROM (
         SELECT wp.outcome_index,
           SUM(wp.net_shares *
             LEAST(GREATEST(COALESCE(pr.follow_score,0)/100.0, 0.01), 1) *
             LEAST(GREATEST((COALESCE(pr.alphaz_02,0)+1.0)/6.0, 0.01), 1)
           ) AS ws,
           SUM(ABS(wp.net_shares)) AS rs,
           COUNT(DISTINCT wp.wallet) AS wc
         FROM wallet_positions wp
         LEFT JOIN wallet_profiles pr ON pr.wallet = wp.wallet
         WHERE wp.condition_id = $1 AND wp.net_shares != 0
         GROUP BY wp.outcome_index
       ) sub
     ) pos ON true
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE x.cnt >= 2) AS hedged,
         COUNT(*) AS total
       FROM (
         SELECT wallet, COUNT(DISTINCT outcome_index) AS cnt
         FROM wallet_positions WHERE condition_id = $1 AND net_shares != 0
         GROUP BY wallet
       ) x
     ) hedge ON true
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'oi', sub.outcome_index, 'bc', sub.bc, 'sc', sub.sc, 'fw', sub.fw
       )) AS flows_json
       FROM (
         SELECT t.outcome_index,
           SUM(CASE WHEN t.side='BUY' THEN t.size*t.price ELSE 0 END
             * EXP(-LN(2.0)*EXTRACT(EPOCH FROM (now()-t.ts))/3600.0/$2)
             * LEAST(GREATEST(COALESCE(pr.follow_score,0)/100.0,0.01),1)
             * LEAST(GREATEST((COALESCE(pr.alphaz_02,0)+1.0)/6.0,0.01),1)
           ) AS bc,
           SUM(CASE WHEN t.side='SELL' THEN t.size*t.price ELSE 0 END
             * EXP(-LN(2.0)*EXTRACT(EPOCH FROM (now()-t.ts))/3600.0/$2)
             * LEAST(GREATEST(COALESCE(pr.follow_score,0)/100.0,0.01),1)
             * LEAST(GREATEST((COALESCE(pr.alphaz_02,0)+1.0)/6.0,0.01),1)
           ) AS sc,
           COUNT(DISTINCT t.wallet) AS fw
         FROM trades t
         LEFT JOIN wallet_profiles pr ON pr.wallet = t.wallet
         WHERE t.condition_id = $1 AND t.ts >= now() - make_interval(hours => $3)
         GROUP BY t.outcome_index
       ) sub
     ) flow ON true
     WHERE m.condition_id = $1`,
    [conditionId, HALF_LIFE_HOURS, WINDOW_HOURS]
  );

  if (aggRes.rows.length === 0) return null;
  const r = aggRes.rows[0] as Record<string, unknown>;

  // Parse outcomes
  let outcomes: string[] = [];
  try {
    const raw = r.outcomes;
    outcomes = typeof raw === "string" ? JSON.parse(raw) : (raw as string[]) ?? [];
  } catch { /* empty */ }
  if (outcomes.length !== 2) return null;

  const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === "yes");
  const noIdx = outcomes.findIndex((o) => o.toLowerCase() === "no");
  const outcomeYesIdx = yesIdx >= 0 ? yesIdx : 0;
  const outcomeNoIdx = noIdx >= 0 ? noIdx : 1;

  // p_mkt_yes from outcome_prices
  let pMktYes = 0.5;
  try {
    const rawPrices = r.outcome_prices;
    const prices = typeof rawPrices === "string" ? JSON.parse(rawPrices) : rawPrices;
    if (Array.isArray(prices) && prices.length > outcomeYesIdx) {
      const p = Number(prices[outcomeYesIdx]);
      if (p > 0 && p < 1) pMktYes = p;
    }
  } catch { /* keep 0.5 */ }

  // ── Parse positions ──
  const positions = (typeof r.positions_json === "string" ? JSON.parse(r.positions_json) : r.positions_json) as Array<Record<string, unknown>> | null ?? [];
  let netYesShares = 0, netNoShares = 0;
  let rawYesShares = 0, rawNoShares = 0;
  let posWalletCount = 0;
  for (const p of positions ?? []) {
    const idx = Number(p.oi);
    if (idx === outcomeYesIdx) { netYesShares = Number(p.ws) || 0; rawYesShares = Number(p.rs) || 0; }
    else if (idx === outcomeNoIdx) { netNoShares = Number(p.ws) || 0; rawNoShares = Number(p.rs) || 0; }
    posWalletCount += Number(p.wc) || 0;
  }

  const posDenom = Math.abs(netYesShares) + Math.abs(netNoShares) + EPS;
  const posPressure = (netYesShares - netNoShares) / posDenom;

  // ── Parse flows ──
  const flows = (typeof r.flows_json === "string" ? JSON.parse(r.flows_json) : r.flows_json) as Array<Record<string, unknown>> | null ?? [];
  let flowYesCost = 0, flowNoCost = 0;
  let flowWallets = 0;
  for (const f of flows ?? []) {
    const idx = Number(f.oi);
    const net = (Number(f.bc) || 0) - (Number(f.sc) || 0);
    flowWallets += Number(f.fw) || 0;
    if (idx === outcomeYesIdx) flowYesCost = net;
    else if (idx === outcomeNoIdx) flowNoCost = net;
  }

  const flowDenom = Math.abs(flowYesCost) + Math.abs(flowNoCost) + EPS;
  const flowPressure = (flowYesCost - flowNoCost) / flowDenom;

  // ── Hedge ──
  const hedged = Number(r.hedged) || 0;
  const totalW = Math.max(Number(r.hedge_total) || 1, 1);
  const hedgeRatio = hedged / totalW;
  const agreement = 1 - Math.min(1, hedgeRatio);

  // ── Delta logit + model probability ──
  const deltaLogit = K_POS * posPressure + K_FLOW * flowPressure;
  const pModelYes = sigmoid(logit(pMktYes) + deltaLogit);
  const pModelNo = 1 - pModelYes;

  // ── Confidence (0-100): combines flow strength + position strength + agreement ──
  const totalWeightedCost = Math.abs(flowYesCost) + Math.abs(flowNoCost);
  const totalWeightedShares = Math.abs(netYesShares) + Math.abs(netNoShares);
  const flowEvidence = Math.min(1, Math.log(1 + totalWeightedCost) / Math.log(1 + 1000));
  const posEvidence = Math.min(1, Math.log(1 + totalWeightedShares) / Math.log(1 + 500));
  const evidenceStrength = Math.max(flowEvidence, posEvidence);
  const walletDiversity = Math.min(1, (posWalletCount + flowWallets) / 20);

  let confidence: number;
  if (totalWeightedCost < 0.001 && totalWeightedShares < 0.001) {
    confidence = DEFAULT_CONFIDENCE_NO_DATA;
  } else {
    confidence = Math.round(100 * evidenceStrength * agreement * (0.5 + 0.5 * walletDiversity));
    confidence = Math.max(confidence, 5);
  }

  // ── Range/uncertainty ──
  const range = Math.max(0.02, (1 - confidence / 100) * 0.15);
  const pLow = Math.max(0, pModelYes - range);
  const pHigh = Math.min(1, pModelYes + range);

  // ── Drivers (perché) ──
  const topDrivers: Driver[] = [
    {
      name: "Prezzo di mercato (baseline)",
      value: pMktYes,
      effect: "neutro",
      note: `Il prezzo attuale YES è ${(pMktYes * 100).toFixed(1)}%`,
    },
    {
      name: "Pressione posizioni nette",
      value: posPressure,
      effect: posPressure > 0.05 ? "spinge YES" : posPressure < -0.05 ? "spinge NO" : "neutro",
      note: `${posWalletCount} wallet — YES=${netYesShares.toFixed(1)} / NO=${netNoShares.toFixed(1)} shares pesate (raw: ${rawYesShares.toFixed(0)}/${rawNoShares.toFixed(0)})`,
    },
    {
      name: "Flusso recente (72h)",
      value: flowPressure,
      effect: flowPressure > 0.05 ? "spinge YES" : flowPressure < -0.05 ? "spinge NO" : "neutro",
      note: `${flowWallets} wallet attivi — YES=$${flowYesCost.toFixed(2)} / NO=$${flowNoCost.toFixed(2)} costi netti`,
    },
    {
      name: "Accordo tra wallet",
      value: agreement,
      effect: agreement > 0.7 ? "alta coerenza" : agreement > 0.4 ? "coerenza media" : "bassa coerenza",
      note: `${hedged}/${totalW} wallet fanno hedging (${(hedgeRatio * 100).toFixed(0)}%)`,
    },
    {
      name: "Forza evidenza",
      value: evidenceStrength,
      effect: evidenceStrength > 0.5 ? "buona base dati" : evidenceStrength > 0.2 ? "base dati moderata" : "pochi dati",
      note: `Flow pesato: $${totalWeightedCost.toFixed(2)} — Pos. pesate: ${totalWeightedShares.toFixed(1)} — Diversità: ${(walletDiversity * 100).toFixed(0)}%`,
    },
  ];

  // ── QUERY 2: Top wallets ──
  const twRes = await query(
    `SELECT
       wp.wallet,
       COALESCE(pr.follow_score, 0) AS follow_score,
       COALESCE(pr.alphaz_02, 0) AS alphaz_02,
       wp.outcome_index,
       wp.net_shares,
       wp.last_trade_at,
       COALESCE(flow.flow_cost, 0) AS flow_cost
     FROM wallet_positions wp
     LEFT JOIN wallet_profiles pr ON pr.wallet = wp.wallet
     LEFT JOIN (
       SELECT wallet, outcome_index,
         SUM(CASE WHEN side = 'BUY' THEN size*price ELSE -size*price END) AS flow_cost
       FROM trades
       WHERE condition_id = $1 AND ts >= now() - make_interval(hours => $2)
       GROUP BY wallet, outcome_index
     ) flow ON flow.wallet = wp.wallet AND flow.outcome_index = wp.outcome_index
     WHERE wp.condition_id = $1 AND wp.net_shares != 0
     ORDER BY ABS(wp.net_shares) *
       LEAST(GREATEST(COALESCE(pr.follow_score, 0) / 100.0, 0.01), 1) *
       LEAST(GREATEST((COALESCE(pr.alphaz_02, 0) + 1.0) / 6.0, 0.01), 1) DESC
     LIMIT 10`,
    [conditionId, WINDOW_HOURS]
  );

  const topWallets: TopWallet[] = (twRes.rows as Record<string, unknown>[]).map((r) => {
    const fs = Number(r.follow_score) || 0;
    const az = Number(r.alphaz_02) || 0;
    const weight = Math.min(1, Math.max(0.01, fs / 100)) * Math.min(1, Math.max(0.01, (az + 1) / 6));
    const idx = Number(r.outcome_index);
    return {
      wallet: r.wallet as string,
      followScore: fs,
      alphaz: az,
      weight: Math.round(weight * 1000) / 1000,
      side: idx === outcomeYesIdx ? "YES" : "NO",
      netShares: Number(r.net_shares) || 0,
      flowCost72h: Number(r.flow_cost) || 0,
      lastTradeAt: r.last_trade_at ? String(r.last_trade_at) : null,
    };
  });

  const recommendedSide = pModelYes >= 0.5 ? "YES" : "NO";
  const recommendedProb = Math.max(pModelYes, pModelNo);

  return {
    conditionId,
    question: (r.question as string) || null,
    slug: (r.slug as string) || null,
    eventSlug: (r.event_slug as string) || null,
    endDate: r.end_date ? String(r.end_date) : null,
    closed: Boolean(r.closed),
    outcomes,
    pMktYes,
    pModelYes,
    pModelNo,
    confidence,
    pLow,
    pHigh,
    recommendedSide,
    recommendedProb,
    netYesShares,
    netNoShares,
    flowYesCost,
    flowNoCost,
    topDrivers,
    topWallets,
  };
}

/* ── Upsert advice cache — tracks trend via prev_p_model_yes ── */
export async function upsertMarketAdvice(a: MarketAdvice): Promise<void> {
  await query(
    `INSERT INTO market_advice
       (condition_id, p_mkt_yes, p_model_yes, confidence, p_low, p_high,
        net_yes_shares, net_no_shares, net_yes_cost, net_no_cost,
        flow_yes_cost, flow_no_cost, top_drivers, top_wallets,
        prev_p_model_yes, trend, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
             NULL, NULL, now())
     ON CONFLICT (condition_id) DO UPDATE SET
       prev_p_model_yes = market_advice.p_model_yes,
       trend            = EXCLUDED.p_model_yes - market_advice.p_model_yes,
       p_mkt_yes        = EXCLUDED.p_mkt_yes,
       p_model_yes      = EXCLUDED.p_model_yes,
       confidence       = EXCLUDED.confidence,
       p_low            = EXCLUDED.p_low,
       p_high           = EXCLUDED.p_high,
       net_yes_shares   = EXCLUDED.net_yes_shares,
       net_no_shares    = EXCLUDED.net_no_shares,
       net_yes_cost     = EXCLUDED.net_yes_cost,
       net_no_cost      = EXCLUDED.net_no_cost,
       flow_yes_cost    = EXCLUDED.flow_yes_cost,
       flow_no_cost     = EXCLUDED.flow_no_cost,
       top_drivers      = EXCLUDED.top_drivers,
       top_wallets      = EXCLUDED.top_wallets,
       updated_at       = now()`,
    [
      a.conditionId,
      a.pMktYes,
      a.pModelYes,
      a.confidence,
      a.pLow,
      a.pHigh,
      a.netYesShares,
      a.netNoShares,
      a.flowYesCost,
      a.flowNoCost,
      a.flowYesCost,
      a.flowNoCost,
      JSON.stringify(a.topDrivers),
      JSON.stringify(a.topWallets),
    ]
  );
}
