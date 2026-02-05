-- Polymarket Statistiche — Schema (idempotent)

CREATE TABLE IF NOT EXISTS markets (
  condition_id   TEXT PRIMARY KEY,
  question       TEXT,
  slug           TEXT,
  end_date       TIMESTAMPTZ,
  closed         BOOLEAN,
  outcomes       JSONB,
  clob_token_ids JSONB,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resolutions (
  condition_id        TEXT PRIMARY KEY REFERENCES markets(condition_id),
  winning_token_id    TEXT,
  winning_outcome_index INT,
  resolved_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trades (
  pk              TEXT PRIMARY KEY,
  ts              TIMESTAMPTZ NOT NULL,
  wallet          TEXT NOT NULL,
  condition_id    TEXT NOT NULL REFERENCES markets(condition_id),
  side            TEXT NOT NULL,
  price           DOUBLE PRECISION,
  size            DOUBLE PRECISION,
  outcome         TEXT,
  outcome_index   INT,
  asset           TEXT,
  tx_hash         TEXT
);

-- wallet_stats: per-wallet per-threshold aggregate stats
CREATE TABLE IF NOT EXISTS wallet_stats (
  wallet          TEXT NOT NULL,
  threshold       DOUBLE PRECISION NOT NULL,
  n               INT NOT NULL DEFAULT 0,
  wins            INT NOT NULL DEFAULT 0,
  expected_wins   DOUBLE PRECISION NOT NULL DEFAULT 0,
  variance        DOUBLE PRECISION NOT NULL DEFAULT 0,
  alphaz          DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (wallet, threshold)
);

-- wallet_profiles: follow score & followability metrics
CREATE TABLE IF NOT EXISTS wallet_profiles (
  wallet              TEXT PRIMARY KEY,
  follow_score        DOUBLE PRECISION NOT NULL,
  is_followable       BOOLEAN NOT NULL,
  n_02                INT NOT NULL,
  alphaz_02           DOUBLE PRECISION NOT NULL,
  hedge_rate          DOUBLE PRECISION NOT NULL,
  late_sniping_rate   DOUBLE PRECISION NOT NULL,
  last_trade_at       TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- etl_state: key-value store for ETL cursors / state
CREATE TABLE IF NOT EXISTS etl_state (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- trade_backfill: tracks per-market trade ingestion progress
CREATE TABLE IF NOT EXISTS trade_backfill (
  condition_id TEXT PRIMARY KEY REFERENCES markets(condition_id),
  next_offset  INT NOT NULL DEFAULT 0,
  done         BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- wallet_live_cursor: per-wallet cursor for live trade sync
CREATE TABLE IF NOT EXISTS wallet_live_cursor (
  wallet      TEXT PRIMARY KEY,
  last_ts     TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- wallet_watchlist: manually followed wallets
CREATE TABLE IF NOT EXISTS wallet_watchlist (
  wallet      TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- etl_runs: log every cron execution for monitoring
CREATE TABLE IF NOT EXISTS etl_runs (
  id          BIGSERIAL PRIMARY KEY,
  job         TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running',
  request_id  TEXT,
  summary     JSONB,
  error       TEXT
);

-- trade_backfill: add error tracking columns (idempotent ALTERs)
DO $$ BEGIN
  ALTER TABLE trade_backfill ADD COLUMN IF NOT EXISTS fail_count INT NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE trade_backfill ADD COLUMN IF NOT EXISTS last_error TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE trade_backfill ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_wallet       ON trades(wallet);
CREATE INDEX IF NOT EXISTS idx_trades_condition_id  ON trades(condition_id);
CREATE INDEX IF NOT EXISTS idx_trades_price         ON trades(price);
CREATE INDEX IF NOT EXISTS idx_trades_side_price    ON trades(side, price);
CREATE INDEX IF NOT EXISTS idx_trades_wallet_ts     ON trades(wallet, ts DESC);
CREATE INDEX IF NOT EXISTS idx_trades_condition_ts  ON trades(condition_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_markets_closed       ON markets(closed);
CREATE INDEX IF NOT EXISTS idx_resolutions_cid      ON resolutions(condition_id);
CREATE INDEX IF NOT EXISTS idx_wallet_stats_thresh  ON wallet_stats(threshold);
CREATE INDEX IF NOT EXISTS idx_wallet_stats_threshold_alphaz ON wallet_stats(threshold, alphaz DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_profiles_follow ON wallet_profiles(follow_score DESC);
CREATE INDEX IF NOT EXISTS idx_trade_backfill_done  ON trade_backfill(done);
CREATE INDEX IF NOT EXISTS idx_trade_backfill_retry ON trade_backfill(done, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_etl_runs_job_started ON etl_runs(job, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_live_cursor_last_ts ON wallet_live_cursor(last_ts DESC);

-- wallet_positions: net shares per (wallet, condition_id, outcome_index)
CREATE TABLE IF NOT EXISTS wallet_positions (
  wallet        TEXT NOT NULL,
  condition_id  TEXT NOT NULL,
  outcome_index INT NOT NULL,
  net_shares    DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_trade_at TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (wallet, condition_id, outcome_index)
);

CREATE INDEX IF NOT EXISTS idx_wallet_positions_wallet ON wallet_positions(wallet);
CREATE INDEX IF NOT EXISTS idx_wallet_positions_open ON wallet_positions(net_shares) WHERE net_shares > 0;

-- token_prices: current prices for token_ids (from CLOB)
CREATE TABLE IF NOT EXISTS token_prices (
  token_id   TEXT PRIMARY KEY,
  price      DOUBLE PRECISION NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_prices_fetched ON token_prices(fetched_at DESC);

-- Partial index for low-prob BUY trades (critical for compute performance)
CREATE INDEX IF NOT EXISTS idx_trades_lowprob_buy_005
  ON trades(price)
  WHERE side = 'BUY' AND price <= 0.05;
