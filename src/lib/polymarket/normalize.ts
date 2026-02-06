import { sha256 } from "../crypto";
import type {
  GammaMarketRaw,
  MarketNormalized,
  DataApiTradeRaw,
  TradeNormalized,
  ClobMarketRaw,
  ResolutionNormalized,
} from "./types";

/* ── Normalize Market ── */
export function normalizeMarket(raw: GammaMarketRaw): MarketNormalized | null {
  const conditionId = raw.conditionId ?? raw.condition_id ?? "";
  if (!conditionId) return null;

  const rawOutcomes = raw.outcomes;
  const rawClobTokenIds = raw.clobTokenIds ?? raw.clob_token_ids;
  const endDate = raw.endDateIso ?? raw.end_date_iso ?? null;

  let outcomes: string[];
  let clobTokenIds: string[];

  try {
    outcomes =
      typeof rawOutcomes === "string"
        ? JSON.parse(rawOutcomes)
        : rawOutcomes;
    clobTokenIds =
      typeof rawClobTokenIds === "string"
        ? JSON.parse(rawClobTokenIds)
        : Array.isArray(rawClobTokenIds)
        ? rawClobTokenIds
        : [];
  } catch {
    return null;
  }

  if (
    !Array.isArray(outcomes) ||
    outcomes.length !== 2 ||
    !Array.isArray(clobTokenIds) ||
    clobTokenIds.length !== 2
  ) {
    return null;
  }

  // Extract event slug from raw.events[0].slug if available
  let eventSlug: string | null = null;
  try {
    const events = raw.events as Array<{ slug?: string }> | undefined;
    if (Array.isArray(events) && events.length > 0 && events[0]?.slug) {
      eventSlug = events[0].slug;
    }
  } catch { /* best effort */ }

  // Extract groupItemTitle (e.g. "Tyler Shough", "Mike Macdonald")
  const groupItemTitle = (raw.groupItemTitle as string) || null;

  return {
    condition_id: conditionId,
    question: raw.question ?? "",
    slug: raw.slug ?? "",
    event_slug: eventSlug,
    group_item_title: groupItemTitle,
    end_date: endDate,
    closed: !!raw.closed,
    outcomes,
    clob_token_ids: clobTokenIds,
  };
}

/* ── Normalize Trade ── */
export function normalizeTrade(raw: DataApiTradeRaw): TradeNormalized {
  const conditionId = raw.conditionId ?? raw.market ?? "";
  const wallet = raw.proxyWallet ?? "";
  // timestamp can be unix seconds (number) or ISO string
  const rawTs = raw.timestamp ?? "";
  const ts = /^\d+$/.test(String(rawTs))
    ? new Date(Number(rawTs) * 1000).toISOString()
    : String(rawTs);
  const side = raw.side ?? "";
  const price = raw.price != null ? parseFloat(String(raw.price)) : null;
  const size = raw.size != null ? parseFloat(String(raw.size)) : null;
  const outcomeIndex =
    raw.outcomeIndex != null ? parseInt(String(raw.outcomeIndex), 10) : null;
  const outcome = raw.outcome ?? null;
  const asset = raw.asset ?? null;
  const txHash = raw.transactionHash ?? null;

  const pk = sha256(
    txHash ?? "",
    conditionId,
    ts,
    wallet,
    side,
    String(price ?? ""),
    String(size ?? ""),
    String(outcomeIndex ?? "")
  );

  return {
    pk,
    ts,
    wallet,
    condition_id: conditionId,
    side,
    price,
    size,
    outcome,
    outcome_index: outcomeIndex,
    asset,
    tx_hash: txHash,
  };
}

/* ── Normalize Resolution ── */
export function normalizeResolution(
  conditionId: string,
  clobMarket: ClobMarketRaw,
  marketClobTokenIds: string[]
): ResolutionNormalized | null {
  const tokens = clobMarket.tokens ?? [];
  const winner = tokens.find((t) => t.winner === true);

  if (!winner) return null;

  const winningTokenId = winner.token_id;
  const winningOutcomeIndex = marketClobTokenIds.indexOf(winningTokenId);

  return {
    condition_id: conditionId,
    winning_token_id: winningTokenId,
    winning_outcome_index: winningOutcomeIndex >= 0 ? winningOutcomeIndex : null,
  };
}
