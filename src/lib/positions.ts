import { query } from "./db";
import type { TradeRow } from "./db";

/**
 * Apply only newly-inserted trades to wallet_positions.
 * delta_shares = +size for BUY, -size for SELL.
 * Clamps near-zero values afterwards.
 */
export async function applyInsertedTradesToPositions(
  trades: TradeRow[]
): Promise<number> {
  if (trades.length === 0) return 0;

  let updated = 0;

  for (const t of trades) {
    if (t.outcome_index == null || t.size == null) continue;

    const delta = t.side === "BUY" ? t.size : -t.size;

    const res = await query(
      `INSERT INTO wallet_positions (wallet, condition_id, outcome_index, net_shares, last_trade_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (wallet, condition_id, outcome_index)
       DO UPDATE SET
         net_shares = wallet_positions.net_shares + EXCLUDED.net_shares,
         last_trade_at = GREATEST(wallet_positions.last_trade_at, EXCLUDED.last_trade_at),
         updated_at = now()`,
      [t.wallet, t.condition_id, t.outcome_index, delta, t.ts]
    );
    updated += res.rowCount ?? 0;
  }

  // Clamp near-zero floating point residuals
  await query(
    `UPDATE wallet_positions SET net_shares = 0 WHERE abs(net_shares) < 1e-9 AND net_shares != 0`
  );

  return updated;
}
