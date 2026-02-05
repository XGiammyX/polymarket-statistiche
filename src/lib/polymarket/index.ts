export { fetchMarketsPage } from "./gamma";
export type { FetchMarketsPageParams, FetchMarketsPageResult } from "./gamma";

export { fetchTradesPage, fetchUserTradesPage } from "./dataApi";
export type { FetchTradesPageParams, FetchTradesPageResult, FetchUserTradesParams } from "./dataApi";

export { fetchMarketFromClob, fetchMarketWinner } from "./clob";

export { fetchTokenPrice } from "./prices";

export { normalizeMarket, normalizeTrade, normalizeResolution } from "./normalize";

export type {
  GammaMarketRaw,
  DataApiTradeRaw,
  ClobMarketRaw,
  ClobToken,
  MarketNormalized,
  TradeNormalized,
  ResolutionNormalized,
} from "./types";
