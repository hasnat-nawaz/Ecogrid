# ⚡ EcoGrid: Viva Preparation Guide

This document is your cheat sheet for explaining the EcoGrid architecture, data flow, and underlying logic during your viva.

---

## 1. System Architecture & Tech Stack

EcoGrid relies on a modern, **database-centric** architecture. Instead of putting all business logic in the backend Node server, much of the heavy lifting (billing, alerting, scheduling) is delegated directly to the database.

*   **Frontend**: React (built with Vite) as a Single Page Application (SPA). Uses WebSockets for live data and REST APIs for standard data fetching.
*   **Backend**: Node.js with Express.js. Handles REST routing, authentication, caching, and WebSocket fan-out.
*   **Database**: PostgreSQL with **TimescaleDB** (for time-series telemetry data) and **pg_cron** (for scheduled tasks).
*   **Cache**: Redis. Used for a cache-aside pattern to reduce DB load.
*   **Simulator**: A Node script that injects mock readings every 2 seconds to simulate live smart meters.

---

## 2. Core Data Flows

### A. Real-Time Telemetry Flow (How the dashboard updates live)
1. **Ingestion**: The simulator (`simulator.js`) inserts row data into the `readings` table.
2. **Database Trigger**: An insert trigger on `readings` fires the Postgres `pg_notify('ecogrid_reading', payload)` function. 
   * *If the reading > 5 kWh*, another trigger (`trg_readings_monitor`) inserts a row into `load_alerts` and fires `pg_notify('ecogrid_alert', payload)`.
3. **Backend Listener**: The Express backend uses `LISTEN ecogrid_reading` to capture this event.
4. **Cache Busting & Fan-Out**: The backend clears relevant Redis caches (so the next REST call gets fresh data) and pushes the event to all connected React clients via **WebSockets**.
5. **Frontend**: React hooks (`useLiveStream`) catch the WebSocket message and instantly update the UI graphs.

### B. Automated Billing Flow (Time-of-Use)
1. **Scheduler**: `pg_cron` runs inside Postgres. At 02:00 on the 1st of every month, it executes `CALL generate_invoices_for_period();`.
2. **Procedure Execution**: The stored procedure loops through active connections. It uses a Time-of-Use (ToU) algorithm (`get_tariff_rate(ts)`) to multiply energy consumed during specific hours (Off-Peak, Standard, Peak) by the respective rates.
3. **Invoice Generation**: Invoices are generated with an `unpaid` status.
4. **Automated Status Updates**: Another `pg_cron` job runs daily to `CALL mark_overdue_invoices()`, shifting unpaid invoices past their due date to `overdue`.

---

## 3. Database Schema Highlights

*   **`consumers` & `smart_meters`**: Core entities. 
*   **`connections`**: A junction table that maps consumers to meters with `start_date` and `end_date`.
*   **`readings` (Hypertable)**: This is NOT a standard Postgres table. It is a **TimescaleDB Hypertable** partitioned by time (`ts`). This is crucial because IoT telemetry generates massive amounts of data; hypertables allow fast time-bucketed aggregations (e.g., `time_bucket('15 minutes', ts)`).
*   **`tariffs`**: Stores the Time-of-Use pricing tiers (Peak, Off-Peak).
*   **`invoices` & `payments`**: Financial records. Paying an invoice triggers cache invalidations.

---

## 4. API & Backend Structure

The backend exposes two main router modules, heavily protected by middleware:
*   **User Routes (`/api/user/*`)**: Fetching profile (`/me`), time-bucketed consumption, retrieving invoices, and paying invoices.
*   **Admin Routes (`/api/admin/*`)**: System overview, full consumer/meter CRU(D), region filtering, bulk billing generation (`/billing/run`), and alert monitoring.

**Caching Strategy (Redis)**
Almost all `GET` routes are wrapped in a `withCache(key, ttl, loader)` function. 
*   If Redis is alive, it checks for a cached response.
*   If missing, it queries Postgres, stores the result in Redis with a Time-To-Live (TTL), and returns it.
*   **Cache Busting**: When a write happens (e.g., paying an invoice) or a Postgres `NOTIFY` arrives (a new reading), `cacheDel()` wipes the stale cache.
*   **Resiliency**: If Redis is completely offline, the system gracefully bypasses it and queries Postgres directly.

---

## 5. Security & Encryption

Your instructor will almost certainly ask how authentication works.

*   **Password Encryption**: Handled via `bcryptjs`. Passwords are **never** stored in plain text. When a user registers (`Register.jsx`), the backend hashes the password with a "salt" before inserting it into the `consumers` table.
*   **Authentication (JWT)**: Upon login, the backend verifies the bcrypt hash. If valid, it signs a **JSON Web Token (JWT)** using the `JWT_SECRET`. 
*   **Stateless Sessions**: The frontend stores this JWT and sends it in the `Authorization: Bearer <token>` header on every REST request, and as a `?token=` query param during WebSocket connection.
*   **Role-Based Access Control (RBAC)**: The JWT payload includes the user's role. Middleware (`authRequired`, `adminOnly`) intercepts incoming requests and blocks regular users from accessing `/api/admin/*` endpoints.

---

## 6. Expected Viva Questions & How to Answer Them

**Q: Why did you use TimescaleDB instead of standard PostgreSQL for the readings?**
**A:** Smart meters stream continuous, high-frequency data. Standard Postgres indexes degrade over time as the table grows massive. TimescaleDB converts the `readings` table into a **hypertable**, automatically partitioning data by time. This keeps insert speeds high and allows us to use advanced analytic functions like `time_bucket()` for our frontend charts.

**Q: How does the real-time dashboard update without the user refreshing the page?**
**A:** We use a combination of PostgreSQL `LISTEN/NOTIFY` and WebSockets. When the simulator inserts a row, a database trigger issues a `NOTIFY`. Our Node.js backend is `LISTEN`ing for this event. When it receives it, it pushes the payload down a WebSocket connection to the React frontend, which immediately updates the graphs. We don't use HTTP polling because it would overwhelm the database.

**Q: How is the password secured when a user registers?**
**A:** It is hashed using `bcryptjs` on the backend before being stored in the database. Bcrypt automatically applies a randomized "salt" to prevent rainbow table attacks. We never store plain-text passwords.

**Q: How do you handle authentication across different pages?**
**A:** We use JWT (JSON Web Tokens). Upon successful login, the server issues a signed token containing the user's ID and role. The React frontend includes this token in the header of subsequent API requests. Our Express middleware verifies the token's cryptographic signature to authenticate the user and determine their role (Admin vs Consumer).

**Q: What is the purpose of Redis in your architecture?**
**A:** Redis is used as a caching layer to improve read performance and reduce database load. Complex analytical queries (like summing up overall consumption for the admin dashboard) take time. We cache the result in Redis. We bust (delete) the cache whenever a new reading arrives via the Postgres `NOTIFY` trigger or when a state changes (like an invoice payment). If Redis fails, the system gracefully falls back to querying Postgres directly.

**Q: Explain how the billing is calculated. Where does that logic live?**
**A:** We use a "database-centric" approach. The billing logic lives entirely inside PostgreSQL as a stored procedure (`generate_invoices_for_period`). It iterates through consumer connections and calculates consumption multiplied by Time-of-Use (ToU) tariffs (Peak vs Off-Peak rates). It is executed automatically on the 1st of every month using the `pg_cron` extension.

**Q: What prevents a regular user from running the billing generation script?**
**A:** The `/api/admin/billing/run` endpoint is protected by an `adminOnly` Express middleware. It checks the role inside the user's verified JWT. If the role isn't 'admin', the middleware rejects the request with a 403 Forbidden status before it ever touches the database.