import { fetchJson } from "./http";

const CLOB_HOST = "https://clob.polymarket.com";

interface ClobPriceResponse {
  price?: string;
  [key: string]: unknown;
}

/**
 * Fetch current price for a token_id from CLOB public API.
 * Returns price as number, or null if unavailable.
 */
export async function fetchTokenPrice(tokenId: string): Promise<number | null> {
  try {
    const url = `${CLOB_HOST}/price?token_id=${encodeURIComponent(tokenId)}&side=buy`;
    const data = await fetchJson<ClobPriceResponse>(url, undefined, 2, 5_000);
    if (data.price != null) {
      const p = parseFloat(String(data.price));
      return isNaN(p) ? null : p;
    }
    return null;
  } catch (err) {
    console.warn(
      `[prices] Error fetching price for ${tokenId}: ${
        err instanceof Error ? err.message : err
      }`
    );
    return null;
  }
}
