# Polymarket Statistiche

Leaderboard & wallet analysis for Polymarket low-probability bets. Automated ingestion, statistical scoring, and follow-score ranking — all running on Vercel.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS** for UI
- **pg** for Postgres
- **@polymarket/clob-client** for CLOB public methods
- Deployable on **Vercel** (nodejs runtime, force-dynamic)

## Setup Local

```bash
# 1. Install dependencies
npm install

# 2. Copy env and configure
cp .env.example .env
# Edit .env: DATABASE_URL, SEED_SECRET, CRON_SECRET

# 3. Apply database schema
psql $DATABASE_URL -f db/schema.sql

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Schema

```bash
psql $DATABASE_URL -f db/schema.sql
```

Tables:
- **markets** — condition_id (PK), question, slug, end_date, closed, outcomes, clob_token_ids
- **resolutions** — condition_id (PK, FK→markets), winning_token_id, winning_outcome_index
- **trades** — pk (PK), ts, wallet, condition_id (FK→markets), side, price, size, outcome, outcome_index
- **wallet_stats** — (wallet, threshold) PK, n, wins, expected_wins, variance, alphaz
- **wallet_profiles** — wallet PK, follow_score, is_followable, hedge_rate, late_sniping_rate
- **etl_state** — key-value store for ETL cursors
- **trade_backfill** — per-market trade ingestion progress (next_offset, done)
- **etl_runs** — cron run log (job, status, summary, error)
- **wallet_live_cursor** — per-wallet cursor for live trade sync
- **wallet_watchlist** — manually followed wallets

All `CREATE` statements are idempotent (`IF NOT EXISTS`).

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SEED_SECRET` | Bearer token for `/api/db/seed` (dev only; prod uses ADMIN_SECRET) |
| `CRON_SECRET` | Bearer token for `/api/cron/sync` and `/api/cron/compute` |
| `ADMIN_SECRET` | Bearer token for `/api/admin/*`, debug endpoints in prod |

## API Endpoints

### Public
| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | DB counts, backlog, recent ETL runs, cooling-down count |
| GET | `/api/leaderboard` | Leaderboard (threshold, minN, sort, onlyFollowable, limit≤200) |
| GET | `/api/wallet/[address]` | Wallet profile, stats, upset wins, recent bets (address validated) |
| GET | `/api/signals` | Live signals feed: low-prob BUY trades from followable wallets |

### Cron (CRON_SECRET required)
| Method | Route | Lock | Description |
|---|---|---|---|
| GET | `/api/cron/sync` | 9001 | Ingest markets → resolutions → trades (time budget 25s) |
| GET | `/api/cron/compute` | 9002 | Compute wallet_stats + wallet_profiles (time budget 55s) |
| GET | `/api/cron/sync-live` | 9003 | Ingest live trades for followable/watchlist wallets (time budget 25s) |

### Admin (ADMIN_SECRET required)
| Method | Route | Description |
|---|---|---|
| GET | `/api/admin/status` | Extended health: ETL runs, failed backfill, all counts |
| POST | `/api/admin/run-sync` | Manually trigger sync |
| POST | `/api/admin/run-compute` | Manually trigger compute |
| POST | `/api/admin/reset-market-offset` | Reset markets_offset to 0 |
| GET/POST/DELETE | `/api/admin/watchlist` | Manage wallet watchlist (add/remove/list) |
| POST | `/api/admin/run-live-sync` | Manually trigger live sync |

### Debug (ADMIN_SECRET required in prod)
| Method | Route | Description |
|---|---|---|
| GET | `/api/debug/markets` | Fetch Gamma markets |
| GET | `/api/debug/market/[conditionId]` | CLOB winner + trades |
| GET | `/api/db/health` | DB connectivity check |
| POST | `/api/db/seed` | Seed sample data |

## Production Hardening

- **Advisory locks** — prevents concurrent cron runs (skip + log to `etl_runs`)
- **Time budgets** — sync exits safely at 25s, compute at 55s (returns status "partial")
- **Trade backfill retry** — on failure: `fail_count++`, `next_retry_at = now + 30min × fail_count`
- **ETL run logging** — every cron run logged in `etl_runs` (running/success/partial/error/skipped)
- **Partial index** — `idx_trades_lowprob_buy_005` on `price WHERE side='BUY' AND price<=0.05`
- **Input validation** — leaderboard limit capped at 200, wallet address must be `0x` + 40 hex
- **Prod protection** — debug/seed endpoints require ADMIN_SECRET in production

## Cron Jobs

Three staggered crons run every 10 minutes in Production:

| Cron | Schedule | maxDuration | Description |
|---|---|---|---|
| `/api/cron/sync` | `*/10 * * * *` | 30s | Markets (200), resolutions (25), trades (5×500) |
| `/api/cron/sync-live` | `2-59/10 * * * *` | 30s | Live BUY trades for top 50 followable + watchlist |
| `/api/cron/compute` | `5-59/10 * * * *` | 60s | wallet_stats (3 thresholds), wallet_profiles |

Local test:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-live
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/compute
```

## UI Pages

- **`/`** — Leaderboard with filters (threshold, minN, sort, onlyFollowable)
- **`/signals`** — Live signals feed: recent low-prob BUY trades from followable wallets
- **`/wallet/[address]`** — Wallet detail: profile cards, stats, upset wins, recent bets
- **`/admin`** — Admin panel: status, manual run triggers, backfill errors (noindex)
- **`/admin/watchlist`** — Manage wallet watchlist + force live sync
- **`/debug`** — Debug dashboard (dev only in prod)

## Deploy on Vercel

1. Push to GitHub
2. Import project on Vercel
3. Set env vars: `DATABASE_URL`, `SEED_SECRET`, `CRON_SECRET`, `ADMIN_SECRET`
4. Deploy
5. Apply schema: `psql $DATABASE_URL -f db/schema.sql`
6. Crons run automatically in Production every 10 min

## What's NOT included

- ML / predictions
