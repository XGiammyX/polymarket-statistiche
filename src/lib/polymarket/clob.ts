import { ClobClient } from "@polymarket/clob-client";
import { normalizeResolution } from "./normalize";
import type { ClobMarketRaw, ResolutionNormalized } from "./types";

const CLOB_HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137;

function getClobClient(): ClobClient {
  return new ClobClient(CLOB_HOST, CHAIN_ID);
}

export async function fetchMarketFromClob(
  conditionId: string
): Promise<ClobMarketRaw | null> {
  try {
    const client = getClobClient();
    const market = await client.getMarket(conditionId);
    return market as unknown as ClobMarketRaw;
  } catch (err) {
    console.error(
      `[clob] Error fetching market ${conditionId}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function fetchMarketWinner(
  conditionId: string,
  marketClobTokenIds: string[]
): Promise<ResolutionNormalized | null> {
  const clobMarket = await fetchMarketFromClob(conditionId);
  if (!clobMarket) return null;
  return normalizeResolution(conditionId, clobMarket, marketClobTokenIds);
}
