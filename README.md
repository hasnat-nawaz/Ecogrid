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

## Quick start (local, without Docker)

You need: **Node 20+**, **PostgreSQL** with `timescaledb` + `pg_cron` extensions (or a Neon project with both enabled), and a **Redis** instance (optional — caching falls back gracefully).

```bash
# 1. Install everything
npm install

# 2. Configure env
cp .env.example .env
# edit DATABASE_URL, REDIS_URL, JWT_SECRET

# 3. Initialise the database
npm run db:init   # runs schema → triggers → cron → seed

# 4. Run frontend + backend together
npm start

# 5. (in another terminal) start the meter simulator so dashboards light up
cd backend && npm run simulate
```

- Frontend → http://localhost:5173
- Backend  → http://localhost:4000  (`/health` for sanity check)

### Demo credentials (created by `database/seed.sql`)
- **Admin:** `admin@ecogrid.io` / `admin123`
- **User:**  `user@ecogrid.io`  / `user123`

## Quick start (Docker)

```bash
npm run docker:up
```
Brings up Postgres+TimescaleDB+pg_cron, Redis, the backend, and the frontend in one command. The SQL files in `database/` are auto-applied on first boot.

## Features

| # | Feature | Implementation |
|---|---------|----------------|
| 1 | High-frequency telemetry | TimescaleDB hypertable on `readings`, simulator streams every 2s |
| 2 | Database-centric logic | Triggers on `readings` & `payments`, procedures `generate_invoice_for_connection`, `generate_invoices_for_period`, `mark_overdue_invoices` |
| 3 | Time-of-Use billing | `get_tariff_rate(ts)` resolves Off-Peak / Standard / Peak rates; SUM(energy × rate) per period |
| 4 | Real-time dashboard | Postgres `NOTIFY` → Node `LISTEN` → WebSocket fan-out → React `useLiveStream` hook |
| 5 | Redis caching | KPI overview cached 15s; transparent fallback if Redis is unavailable |
| 6 | Scheduled jobs | `pg_cron`: monthly billing (0 2 1 * *), daily overdue (0 3 * * *), weekly prune |
| 7 | Role-based auth | JWT (Bearer) + bcrypt; `admin` and `user` roles enforced server-side and in routing |
| 8 | Containerised | Multi-service `docker-compose.yml` |

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
                            │ Redis  │  (KPI cache)
                            └────────┘

                Smart-meter simulator (backend/src/utils/simulator.js)
                  └─► INSERT readings → trigger NOTIFY → WS fan-out
```

## Database highlights

- `readings` is a TimescaleDB **hypertable** partitioned by `ts`.
- `trg_readings_monitor` raises a `load_alerts` row + `pg_notify('ecogrid_alert', …)` on any reading > 5 kWh.
- Every insert also fires `pg_notify('ecogrid_reading', …)` so dashboards update live.
- `generate_invoice_for_connection(conn, start, end)` performs ToU billing entirely in SQL.
- `pg_cron` schedules monthly billing, daily overdue marking, and weekly pruning.

## Environment variables

See `.env.example`. Backend reads `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `PORT`, `FRONTEND_ORIGIN`. Frontend reads `VITE_API_URL`, `VITE_WS_URL`.

## Notes

- **Neon DB**: enable the `timescaledb` and `pg_cron` extensions in the Neon console before `npm run db:init`.
- **Redis is optional**: if `REDIS_URL` is not set, the backend prints a warning and skips caching — every other feature still works.
- **CORS**: `FRONTEND_ORIGIN` accepts a comma-separated list.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm install` | Installs root + backend + frontend deps |
| `npm start`   | Runs backend (4000) and frontend (5173) concurrently |
| `npm run db:init` | Applies schema, triggers, cron jobs, and seed |
| `npm run docker:up` / `docker:down` | Compose up/down |
| `cd backend && npm run simulate` | Streams synthetic meter readings |

## License

MIT.
