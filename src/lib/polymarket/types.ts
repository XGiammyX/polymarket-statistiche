/* ── Raw types from Polymarket APIs ── */

export interface GammaMarketRaw {
  condition_id: string;
  question: string;
  slug: string;
  end_date_iso: string;
  closed: boolean;
  outcomes: string; // JSON stringified e.g. '["Yes","No"]'
  clob_token_ids: string; // JSON stringified e.g. '["id1","id2"]'
  [key: string]: unknown;
}

export interface DataApiTradeRaw {
  id: string;
  market: string; // conditionId
  asset: string;
  side: string;
  price: string;
  size: string;
  timestamp: string; // unix seconds or ISO
  proxyWallet: string;
  outcome: string;
  outcomeIndex: string;
  transactionHash: string;
  [key: string]: unknown;
}

export interface ClobToken {
  token_id: string;
  outcome: string;
  winner: boolean;
  [key: string]: unknown;
}

export interface ClobMarketRaw {
  condition_id: string;
  tokens: ClobToken[];
  [key: string]: unknown;
}

/* ── Normalized types ── */

export interface MarketNormalized {
  condition_id: string;
  question: string;
  slug: string;
  end_date: string | null;
  closed: boolean;
  outcomes: string[];
  clob_token_ids: string[];
}

export interface TradeNormalized {
  pk: string;
  ts: string;
  wallet: string;
  condition_id: string;
  side: string;
  price: number | null;
  size: number | null;
  outcome: string | null;
  outcome_index: number | null;
  asset: string | null;
  tx_hash: string | null;
}

export interface ResolutionNormalized {
  condition_id: string;
  winning_token_id: string | null;
  winning_outcome_index: number | null;
}
