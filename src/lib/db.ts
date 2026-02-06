import { Pool, QueryResult } from "pg";
import { getDatabaseUrl } from "./env";

/* ── Global Pool (reused across Vercel invocations) ── */
const globalForPg = globalThis as unknown as { _pgPool?: Pool };

function getPool(): Pool {
  if (!globalForPg._pgPool) {
    globalForPg._pgPool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 3,                       // Vercel serverless: keep low to avoid Neon connection limits
      idleTimeoutMillis: 10_000,    // Release idle connections fast (saves Neon compute)
      connectionTimeoutMillis: 5_000,
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
  event_slug?: string | null;
  group_item_title?: string | null;
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

/* ── Upsert Markets (batched multi-row for Vercel/Neon perf) ── */
export async function upsertMarkets(markets: MarketRow[]): Promise<number> {
  if (markets.length === 0) return 0;

  // Build multi-row VALUES clause: 9 params per row
  const COLS = 9;
  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    const off = i * COLS;
    placeholders.push(
      `($${off + 1},$${off + 2},$${off + 3},$${off + 4},$${off + 5},$${off + 6},$${off + 7},$${off + 8},$${off + 9}, now())`
    );
    values.push(
      m.condition_id,
      m.question,
      m.slug,
      m.event_slug ?? null,
      m.group_item_title ?? null,
      m.end_date,
      m.closed,
      JSON.stringify(m.outcomes),
      JSON.stringify(m.clob_token_ids)
    );
  }

  const res = await query(
    `INSERT INTO markets (condition_id, question, slug, event_slug, group_item_title, end_date, closed, outcomes, clob_token_ids, updated_at)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (condition_id) DO UPDATE SET
       question           = EXCLUDED.question,
       slug               = EXCLUDED.slug,
       event_slug         = COALESCE(EXCLUDED.event_slug, markets.event_slug),
       group_item_title   = COALESCE(EXCLUDED.group_item_title, markets.group_item_title),
       end_date           = EXCLUDED.end_date,
       closed             = EXCLUDED.closed,
       outcomes           = EXCLUDED.outcomes,
       clob_token_ids     = EXCLUDED.clob_token_ids,
       updated_at         = now()`,
    values
  );
  return res.rowCount ?? 0;
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

/* ── Insert Trades (batched multi-row, dedup via ON CONFLICT DO NOTHING) ── */
export async function insertTrades(trades: TradeRow[]): Promise<number> {
  if (trades.length === 0) return 0;

  const COLS = 11;
  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    const off = i * COLS;
    placeholders.push(
      `($${off+1},$${off+2},$${off+3},$${off+4},$${off+5},$${off+6},$${off+7},$${off+8},$${off+9},$${off+10},$${off+11})`
    );
    values.push(t.pk, t.ts, t.wallet, t.condition_id, t.side, t.price, t.size, t.outcome, t.outcome_index, t.asset, t.tx_hash);
  }

  const res = await query(
    `INSERT INTO trades (pk, ts, wallet, condition_id, side, price, size, outcome, outcome_index, asset, tx_hash)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (pk) DO NOTHING`,
    values
  );
  return res.rowCount ?? 0;
}

/* ── Insert Trades returning which rows were actually inserted ── */
export async function insertTradesReturningInserted(
  trades: TradeRow[]
): Promise<{ count: number; insertedRows: TradeRow[] }> {
  if (trades.length === 0) return { count: 0, insertedRows: [] };

  const COLS = 11;
  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    const off = i * COLS;
    placeholders.push(
      `($${off+1},$${off+2},$${off+3},$${off+4},$${off+5},$${off+6},$${off+7},$${off+8},$${off+9},$${off+10},$${off+11})`
    );
    values.push(t.pk, t.ts, t.wallet, t.condition_id, t.side, t.price, t.size, t.outcome, t.outcome_index, t.asset, t.tx_hash);
  }

  const res = await query(
    `INSERT INTO trades (pk, ts, wallet, condition_id, side, price, size, outcome, outcome_index, asset, tx_hash)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (pk) DO NOTHING
     RETURNING pk`,
    values
  );

  const insertedPks = new Set((res.rows as Array<{ pk: string }>).map((r) => r.pk));
  const insertedRows = trades.filter((t) => insertedPks.has(t.pk));
  return { count: insertedPks.size, insertedRows };
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
     WHERE r.winning_token_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM trade_backfill tb WHERE tb.condition_id = r.condition_id
       )
     LIMIT $1
     ON CONFLICT (condition_id) DO NOTHING`,
    [limit]
  );
  return res.rowCount ?? 0;
}

export async function ensureTradeBackfillRowsForActiveMarkets(
  limit: number
): Promise<number> {
  // Add open/active markets to backfill so we get their trades too
  const res = await query(
    `INSERT INTO trade_backfill (condition_id, next_offset, done)
     SELECT m.condition_id, 0, false
     FROM markets m
     WHERE (m.closed = false OR m.closed IS NULL)
       AND NOT EXISTS (
         SELECT 1 FROM trade_backfill tb WHERE tb.condition_id = m.condition_id
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
  // Prioritize OPEN markets (closed=false) over closed ones
  // Then sort by updated_at ASC so we process least-recently-touched first
  const res = await query(
    `SELECT tb.condition_id, tb.next_offset
     FROM trade_backfill tb
     LEFT JOIN markets m ON m.condition_id = tb.condition_id
     WHERE tb.done = false
       AND (tb.next_retry_at IS NULL OR tb.next_retry_at <= now())
     ORDER BY
       (CASE WHEN m.closed = false OR m.closed IS NULL THEN 0 ELSE 1 END) ASC,
       tb.updated_at ASC NULLS FIRST
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
