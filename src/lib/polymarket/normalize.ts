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
  let outcomes: string[];
  let clobTokenIds: string[];

  try {
    outcomes =
      typeof raw.outcomes === "string"
        ? JSON.parse(raw.outcomes)
        : raw.outcomes;
    clobTokenIds =
      typeof raw.clob_token_ids === "string"
        ? JSON.parse(raw.clob_token_ids)
        : raw.clob_token_ids;
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

  return {
    condition_id: raw.condition_id,
    question: raw.question ?? "",
    slug: raw.slug ?? "",
    end_date: raw.end_date_iso ?? null,
    closed: !!raw.closed,
    outcomes,
    clob_token_ids: clobTokenIds,
  };
}

/* ── Normalize Trade ── */
export function normalizeTrade(raw: DataApiTradeRaw): TradeNormalized {
  const conditionId = raw.market ?? "";
  const wallet = raw.proxyWallet ?? "";
  const ts = raw.timestamp ?? "";
  const side = raw.side ?? "";
  const price = raw.price != null ? parseFloat(raw.price) : null;
  const size = raw.size != null ? parseFloat(raw.size) : null;
  const outcomeIndex =
    raw.outcomeIndex != null ? parseInt(raw.outcomeIndex, 10) : null;
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
