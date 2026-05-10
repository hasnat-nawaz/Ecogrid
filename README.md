# ⚡ EcoGrid — Autonomous Smart Grid Management System

EcoGrid is a database-centric smart grid platform: high-frequency smart-meter telemetry is streamed into PostgreSQL (TimescaleDB hypertables), Time-of-Use billing is computed by stored procedures, scheduled by `pg_cron`, cached in Redis, and visualized in a React dashboard over WebSockets.

## Project structure

```
ecogrid/
├── frontend/           React + Vite SPA (admin & user dashboards)
├── backend/            Node.js (Express) + ws + ioredis + pg
├── database/           SQL: schema, triggers, procedures, cron jobs, seed
├── docker/             Dockerfiles + docker-compose
├── .env.example
├── package.json        Root orchestrator (concurrently runs both apps)
└── README.md
```

## Prerequisites

### Node.js 20+

The project requires **Node 20 or higher**. The root `package.json` uses `concurrently` which requires modern JS syntax (`??`, `?.`) unavailable in older Node versions. If `npm start` throws a `SyntaxError: Unexpected token '?'` error, your system Node is too old.

Install Node 20 via `nvm` (recommended):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
node --version   # should print v20.x.x
```

Or via apt:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

### PostgreSQL (Neon recommended)

Use a [Neon](https://neon.tech) project with the `timescaledb` and `pg_cron` extensions enabled (toggle them in the Neon console under **Extensions** before running `db:init`). A local PostgreSQL install with both extensions also works.

### Redis

Redis is used to cache API responses. It is **optional** — if `REDIS_URL` is not set or Redis is unavailable the backend falls back gracefully and all features still work, just without caching.

To install Redis locally on Ubuntu/Debian:

```bash
sudo apt install redis-server -y
sudo systemctl start redis
redis-cli ping   # should reply PONG
```

---

## Quick start (local, without Docker)

### 1. Install dependencies

```bash
npm install
```

This installs root, backend, and frontend dependencies in one step.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. Neon URL with `?sslmode=require`) |
| `REDIS_URL` | Redis URL — `redis://localhost:6379` for local, or omit to disable caching |
| `JWT_SECRET` | Any long random string |
| `PORT` | Backend port (default `4000`) |
| `FRONTEND_ORIGIN` | Frontend URL for CORS (default `http://localhost:5173`) |

Frontend `.env` (inside `frontend/`):

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL — `http://localhost:4000` |
| `VITE_WS_URL` | WebSocket URL — `ws://localhost:4000/ws` |

### 3. Initialise the database

> ⚠️ Only run this once. It drops and recreates all tables, triggers, and seed data.

```bash
npm run db:init
```

This applies in order: `schema.sql` → `triggers_procedure.sql` → `cron_jobs.sql` → `seed.sql`.

### 4. Run the app

You need **three terminals** running simultaneously:

**Terminal 1 — Backend**
```bash
cd backend && npm start
# Listening on http://localhost:4000
```

**Terminal 2 — Frontend**
```bash
cd frontend && npm run dev
# Listening on http://localhost:5173
```

**Terminal 3 — Meter simulator**
```bash
cd backend && npm run simulate
# Streams synthetic readings for all active meters every 2s
```

Or run backend + frontend together from the root (no simulator):

```bash
npm start
```

### 5. Open the app

- **Frontend** → http://localhost:5173
- **Backend health check** → http://localhost:4000/health

### Demo credentials

The seed creates one admin and two consumer accounts. Alice is in Sector A with a single meter; Bob is in Sector B with two meters (primary + secondary).

| Role | Email | Password | Region | Meters |
|------|-------|----------|--------|--------|
| Admin | `admin@ecogrid.io` | `admin123` | — | — |
| User · Alice | `alice@ecogrid.io` | `alice123` | Sector A | `MTR-0001` |
| User · Bob | `bob@ecogrid.io` | `bob123` | Sector B | `MTR-0002`, `MTR-0003` |

> Re-run `npm run db:init` any time you want to reset back to this clean topology — the seed `TRUNCATE`s every domain table before re-inserting. After reseeding, restart the simulator (`cd backend && npm run simulate`) so it picks up the fresh meter ids.

---

## Quick start (Docker)

```bash
npm run docker:up
```

Brings up Postgres+TimescaleDB+pg_cron, Redis, backend, and frontend in one command. The SQL files in `database/` are auto-applied on first boot.

To stop:

```bash
npm run docker:down
```

---

## Features

| # | Feature | Implementation |
|---|---------|----------------|
| 1 | High-frequency telemetry | TimescaleDB hypertable on `readings`, simulator streams every 2s |
| 2 | Database-centric logic | Triggers on `readings` & `payments`, procedures `generate_invoice_for_connection`, `generate_invoices_for_period`, `mark_overdue_invoices` |
| 3 | Time-of-Use billing | `get_tariff_rate(ts)` resolves Off-Peak / Standard / Peak rates; SUM(energy × rate) per period |
| 4 | Real-time dashboard | Postgres `NOTIFY` → Node `LISTEN` → WebSocket fan-out → React `useLiveStream` hook |
| 5 | Redis caching | All routes cached with TTLs tuned per data type; transparent fallback if Redis is unavailable |
| 6 | Scheduled jobs | `pg_cron`: monthly billing (0 2 1 * *), daily overdue (0 3 * * *), weekly prune |
| 7 | Role-based auth | JWT (Bearer) + bcryptjs; `admin` and `user` roles enforced server-side and in routing |
| 8 | Containerised | Multi-service `docker-compose.yml` |

---

## Architecture

```
┌──────────┐  WebSocket   ┌────────────┐  LISTEN/NOTIFY   ┌─────────────────┐
│  React   │◄────────────►│  Express   │◄────────────────►│ PostgreSQL +    │
│  (Vite)  │   REST/JWT   │  + ws      │       pg         │ TimescaleDB +   │
└──────────┘              │  + Redis   │                  │ pg_cron         │
                          └─────┬──────┘                  │  triggers,      │
                                │                         │  procedures,    │
                                ▼                         │  ToU billing    │
                            ┌────────┐                    └─────────────────┘
                            │ Redis  │  (API response cache)
                            └────────┘

                Smart-meter simulator (backend/src/utils/simulator.js)
                  └─► INSERT readings → trigger NOTIFY → WS fan-out
```

---

## Redis caching

All API routes are cached using a cache-aside pattern (`withCache(key, ttl, loader)` in `backend/src/services/cache.js`). Cache is busted on writes and on Postgres `NOTIFY` events via the WebSocket listener.

| Route | TTL | Notes |
|-------|-----|-------|
| `GET /api/admin/overview` | 15s | Busted on NOTIFY |
| `GET /api/admin/consumers` | 30s | |
| `GET /api/admin/billing` | 20s | Busted after `/billing/run` |
| `GET /api/admin/alerts` | 10s | Busted on NOTIFY |
| Consumer lookup (internal) | 120s | Per-user, busted on profile change |
| `GET /api/user/me` | 60s | |
| `GET /api/user/consumption` | 30s | Busted on NOTIFY ecogrid_reading |
| `GET /api/user/invoices` | 30s | Busted after payment |

If `REDIS_URL` is not set, all cache calls are no-ops and the app runs normally against the database.

---

## Database highlights

- `readings` is a TimescaleDB **hypertable** partitioned by `ts`.
- `trg_readings_monitor` inserts a `load_alerts` row and fires `pg_notify('ecogrid_alert', …)` on any reading above 5 kWh.
- Every insert also fires `pg_notify('ecogrid_reading', …)` so dashboards update live.
- `generate_invoice_for_connection(conn, start, end)` performs ToU billing entirely in SQL.
- `pg_cron` schedules monthly billing, daily overdue marking, and weekly data pruning.

> **Note:** PostgreSQL's `format()` function only supports `%s`, `%I`, and `%L` — it does not support printf-style specifiers like `%.2f`. Numeric formatting in trigger messages uses string concatenation with `ROUND()::text` instead.

---

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | backend | Full PostgreSQL connection string |
| `REDIS_URL` | backend | Redis connection string (optional) |
| `JWT_SECRET` | backend | Secret for signing JWTs |
| `PORT` | backend | HTTP port (default 4000) |
| `FRONTEND_ORIGIN` | backend | Comma-separated allowed CORS origins |
| `VITE_API_URL` | frontend | Backend REST base URL |
| `VITE_WS_URL` | frontend | Backend WebSocket URL |
| `SIM_TICK_MS` | backend | Simulator interval in ms (default 2000) |

---

## Scripts

| Script | What it does |
|--------|--------------|
| `npm install` | Installs root + backend + frontend deps |
| `npm start` | Runs backend (4000) and frontend (5173) concurrently |
| `npm run db:init` | Applies schema, triggers, cron jobs, and seed data |
| `npm run docker:up` | Starts all services via Docker Compose |
| `npm run docker:down` | Stops all Docker services |
| `cd backend && npm start` | Runs backend only |
| `cd backend && npm run simulate` | Streams synthetic meter readings |
| `cd frontend && npm run dev` | Runs frontend only |

---

## License

MIT.