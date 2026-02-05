import { fetchJson } from "./http";
import { normalizeTrade } from "./normalize";
import type { DataApiTradeRaw, TradeNormalized } from "./types";

const DATA_API_BASE = "https://data-api.polymarket.com";

export interface FetchTradesPageParams {
  conditionId: string;
  limit?: number;
  offset?: number;
  side?: string;
}

export interface FetchTradesPageResult {
  raw: DataApiTradeRaw[];
  normalized: TradeNormalized[];
}

export async function fetchTradesPage(
  params: FetchTradesPageParams
): Promise<FetchTradesPageResult> {
  const { conditionId, limit = 100, offset = 0, side = "BUY" } = params;

  const url = new URL(`${DATA_API_BASE}/trades`);
  url.searchParams.set("market", conditionId);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (side) url.searchParams.set("side", side);

  const raw = await fetchJson<DataApiTradeRaw[]>(url.toString());

  const normalized: TradeNormalized[] = [];
  for (const r of raw) {
    normalized.push(normalizeTrade(r));
  }

  return { raw, normalized };
}

export interface FetchUserTradesParams {
  wallet: string;
  limit?: number;
  offset?: number;
  side?: string;
}

export async function fetchUserTradesPage(
  params: FetchUserTradesParams
): Promise<FetchTradesPageResult> {
  const { wallet, limit = 200, offset = 0, side = "BUY" } = params;

  const url = new URL(`${DATA_API_BASE}/trades`);
  url.searchParams.set("user", wallet);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (side) url.searchParams.set("side", side);

  const raw = await fetchJson<DataApiTradeRaw[]>(url.toString());

  const normalized: TradeNormalized[] = [];
  for (const r of raw) {
    normalized.push(normalizeTrade(r));
  }

  return { raw, normalized };
}
