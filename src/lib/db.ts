import { Pool, QueryResult } from "pg";
import { getDatabaseUrl } from "./env";

/* ── Global Pool (reused across Vercel invocations) ── */
const globalForPg = globalThis as unknown as { _pgPool?: Pool };

function getPool(): Pool {
  if (!globalForPg._pgPool) {
    globalForPg._pgPool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: true,
    });
  }
  return globalForPg._pgPool;
}

export async function query(
  sql: string,
  params?: unknown[]
): Promise<QueryResult> {
  const pool = getPool();
  return pool.query(sql, params);
}

/* ── Types ── */
export interface MarketRow {
  condition_id: string;
  question: string | null;
  slug: string | null;
  end_date: string | null;
  closed: boolean;
  outcomes: unknown;
  clob_token_ids: unknown;
}

export interface ResolutionRow {
  condition_id: string;
  winning_token_id: string | null;
  winning_outcome_index: number | null;
}

export interface TradeRow {
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

/* ── Upsert Markets ── */
export async function upsertMarkets(markets: MarketRow[]): Promise<number> {
  if (markets.length === 0) return 0;
  let count = 0;
  for (const m of markets) {
    const res = await query(
      `INSERT INTO markets (condition_id, question, slug, end_date, closed, outcomes, clob_token_ids, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now())
       ON CONFLICT (condition_id) DO UPDATE SET
         question       = EXCLUDED.question,
         slug           = EXCLUDED.slug,
         end_date       = EXCLUDED.end_date,
         closed         = EXCLUDED.closed,
         outcomes       = EXCLUDED.outcomes,
         clob_token_ids = EXCLUDED.clob_token_ids,
         updated_at     = now()`,
      [
        m.condition_id,
        m.question,
        m.slug,
        m.end_date,
        m.closed,
        JSON.stringify(m.outcomes),
        JSON.stringify(m.clob_token_ids),
      ]
    );
    count += res.rowCount ?? 0;
  }
  return count;
}

/* ── Upsert Resolution ── */
export async function upsertResolution(r: ResolutionRow): Promise<number> {
  const res = await query(
    `INSERT INTO resolutions (condition_id, winning_token_id, winning_outcome_index, resolved_at)
     VALUES ($1,$2,$3, now())
     ON CONFLICT (condition_id) DO UPDATE SET
       winning_token_id      = EXCLUDED.winning_token_id,
       winning_outcome_index = EXCLUDED.winning_outcome_index,
       resolved_at           = now()`,
    [r.condition_id, r.winning_token_id, r.winning_outcome_index]
  );
  return res.rowCount ?? 0;
}

/* ── Insert Trades (dedup via ON CONFLICT DO NOTHING) ── */
export async function insertTrades(trades: TradeRow[]): Promise<number> {
  if (trades.length === 0) return 0;
  let count = 0;
  for (const t of trades) {
    const res = await query(
      `INSERT INTO trades (pk, ts, wallet, condition_id, side, price, size, outcome, outcome_index, asset, tx_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (pk) DO NOTHING`,
      [
        t.pk,
        t.ts,
        t.wallet,
        t.condition_id,
        t.side,
        t.price,
        t.size,
        t.outcome,
        t.outcome_index,
        t.asset,
        t.tx_hash,
      ]
    );
    count += res.rowCount ?? 0;
  }
  return count;
}

/* ── Insert Trades returning which rows were actually inserted ── */
export async function insertTradesReturningInserted(
  trades: TradeRow[]
): Promise<{ count: number; insertedRows: TradeRow[] }> {
  if (trades.length === 0) return { count: 0, insertedRows: [] };
  let count = 0;
  const insertedRows: TradeRow[] = [];
  for (const t of trades) {
    const res = await query(
      `INSERT INTO trades (pk, ts, wallet, condition_id, side, price, size, outcome, outcome_index, asset, tx_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (pk) DO NOTHING`,
      [
        t.pk, t.ts, t.wallet, t.condition_id, t.side,
        t.price, t.size, t.outcome, t.outcome_index, t.asset, t.tx_hash,
      ]
    );
    const inserted = res.rowCount ?? 0;
    if (inserted > 0) {
      count += inserted;
      insertedRows.push(t);
    }
  }
  return { count, insertedRows };
}

/* ── Ensure Market Placeholder (for live trades on unknown markets) ── */
export async function ensureMarketPlaceholder(conditionId: string): Promise<void> {
  await query(
    `INSERT INTO markets (condition_id, question, slug, closed, updated_at)
     VALUES ($1, NULL, NULL, false, now())
     ON CONFLICT (condition_id) DO NOTHING`,
    [conditionId]
  );
}

/* ══════════════════════════════════════════════════════
   ETL State helpers
   ══════════════════════════════════════════════════════ */

export async function getEtlState(key: string, defaultValue: string): Promise<string> {
  const res = await query(
    `SELECT value FROM etl_state WHERE key = $1`,
    [key]
  );
  if (res.rows.length === 0) return defaultValue;
  return res.rows[0].value as string;
}

export async function setEtlState(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO etl_state (key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value]
  );
}

/* ══════════════════════════════════════════════════════
   Trade Backfill helpers
   ══════════════════════════════════════════════════════ */

export async function ensureTradeBackfillRowsForResolvedMarkets(
  limit: number
): Promise<number> {
  const res = await query(
    `INSERT INTO trade_backfill (condition_id, next_offset, done)
     SELECT r.condition_id, 0, false
     FROM resolutions r
     WHERE NOT EXISTS (
       SELECT 1 FROM trade_backfill tb WHERE tb.condition_id = r.condition_id
     )
     LIMIT $1
     ON CONFLICT (condition_id) DO NOTHING`,
    [limit]
  );
  return res.rowCount ?? 0;
}

export interface BackfillItem {
  condition_id: string;
  next_offset: number;
}

export async function pickTradeBackfillBatch(
  limitMarkets: number
): Promise<BackfillItem[]> {
  const res = await query(
    `SELECT condition_id, next_offset
     FROM trade_backfill
     WHERE done = false
       AND (next_retry_at IS NULL OR next_retry_at <= now())
     ORDER BY updated_at ASC NULLS FIRST
     LIMIT $1`,
    [limitMarkets]
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    condition_id: r.condition_id as string,
    next_offset: r.next_offset as number,
  }));
}

export async function markTradeBackfillProgress(
  conditionId: string,
  nextOffset: number,
  done: boolean
): Promise<void> {
  await query(
    `UPDATE trade_backfill
     SET next_offset = $2, done = $3, updated_at = now(),
         fail_count = 0, last_error = NULL, next_retry_at = NULL
     WHERE condition_id = $1`,
    [conditionId, nextOffset, done]
  );
}

export async function markTradeBackfillError(
  conditionId: string,
  errorMessage: string
): Promise<void> {
  await query(
    `UPDATE trade_backfill
     SET fail_count = fail_count + 1,
         last_error = $2,
         next_retry_at = now() + (interval '30 minutes' * (fail_count + 1)),
         updated_at = now()
     WHERE condition_id = $1`,
    [conditionId, errorMessage]
  );
}
