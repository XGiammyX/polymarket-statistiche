/* ── Raw types from Polymarket APIs ── */

export interface GammaMarketRaw {
  conditionId?: string;
  condition_id?: string;
  question: string;
  slug: string;
  endDateIso?: string;
  end_date_iso?: string;
  closed: boolean;
  outcomes: string; // JSON stringified e.g. '["Yes","No"]'
  clobTokenIds?: string; // JSON stringified e.g. '["id1","id2"]'
  clob_token_ids?: string;
  [key: string]: unknown;
}

export interface DataApiTradeRaw {
  id?: string;
  conditionId?: string; // camelCase from API
  market?: string; // legacy alias
  asset?: string;
  side?: string;
  price?: string | number;
  size?: string | number;
  timestamp?: string | number; // unix seconds (number) or ISO string
  proxyWallet?: string;
  outcome?: string;
  outcomeIndex?: string | number;
  transactionHash?: string;
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
  event_slug: string | null;
  group_item_title: string | null;
  end_date: string | null;
  closed: boolean;
  outcomes: string[];
  clob_token_ids: string[];
  outcome_prices: number[] | null;
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
