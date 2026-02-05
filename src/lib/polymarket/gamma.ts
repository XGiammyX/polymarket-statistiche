import { fetchJson } from "./http";
import { normalizeMarket } from "./normalize";
import type { GammaMarketRaw, MarketNormalized } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

export interface FetchMarketsPageParams {
  limit?: number;
  offset?: number;
  closed?: boolean;
}

export interface FetchMarketsPageResult {
  raw: GammaMarketRaw[];
  normalized: MarketNormalized[];
}

export async function fetchMarketsPage(
  params: FetchMarketsPageParams = {}
): Promise<FetchMarketsPageResult> {
  const { limit = 50, offset = 0, closed } = params;

  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (closed !== undefined) {
    url.searchParams.set("closed", String(closed));
  }

  const raw = await fetchJson<GammaMarketRaw[]>(url.toString());

  const normalized: MarketNormalized[] = [];
  for (const r of raw) {
    const n = normalizeMarket(r);
    if (n) normalized.push(n);
  }

  return { raw, normalized };
}
