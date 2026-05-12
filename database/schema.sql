-- ============================================================================
-- EcoGrid — Schema
-- PostgreSQL + TimescaleDB hypertables
-- Run on Neon DB (TimescaleDB + pg_cron extensions must be enabled)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS timescaledb;
--This is built for time-series data (like sensor readings that happen every few seconds). It transforms regular tables into "hypertables," which automatically partition data into time-based chunks. This makes searching through millions of rows much faster.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--This provides cryptographic functions. It is used here to generate UUIDs (universally unique IDs) for users and to safely hash passwords.
CREATE EXTENSION IF NOT EXISTS pg_cron;
--This is a task scheduler that runs inside the database. It allows the system to run periodic jobs, such as automatically generating invoices at the end of every month.

-- ----------------------------------------------------------------------------
-- USERS / AUTH
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','user')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- CORE DOMAIN
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS providers (
  provider_id SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  province    TEXT
);

CREATE TABLE IF NOT EXISTS regions (
  region_id        SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  parent_region_id INT REFERENCES regions(region_id) ON DELETE SET NULL,
  provider_id      INT REFERENCES providers(provider_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS addresses (
  address_id SERIAL PRIMARY KEY,
  street     TEXT NOT NULL,
  city       TEXT NOT NULL,
  region_id  INT REFERENCES regions(region_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS consumers (
  consumer_id SERIAL PRIMARY KEY,
  user_id     UUID UNIQUE REFERENCES app_users(user_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  phone       TEXT,
  address_id  INT REFERENCES addresses(address_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smart_meters (
  meter_id          SERIAL PRIMARY KEY,
  serial_no         TEXT UNIQUE NOT NULL,
  installation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','faulty')),
  address_id        INT REFERENCES addresses(address_id) ON DELETE SET NULL,
  region_id         INT REFERENCES regions(region_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS connections (
  connection_id SERIAL PRIMARY KEY,
  consumer_id   INT NOT NULL REFERENCES consumers(consumer_id) ON DELETE CASCADE,
  meter_id      INT NOT NULL REFERENCES smart_meters(meter_id) ON DELETE CASCADE,
  start_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date      DATE,
  UNIQUE (consumer_id, meter_id, start_date)
);

CREATE TABLE IF NOT EXISTS tariffs (
  tariff_id     SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  rate_per_unit NUMERIC(10,4) NOT NULL,  -- currency per kWh
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- ----------------------------------------------------------------------------
-- READINGS (TimescaleDB hypertable — high frequency telemetry)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS readings (
  reading_id      BIGSERIAL,
  meter_id        INT NOT NULL REFERENCES smart_meters(meter_id) ON DELETE CASCADE,
  ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
  energy_consumed NUMERIC(12,4) NOT NULL,  -- kWh in this interval
  voltage         NUMERIC(8,2),
  current_amp     NUMERIC(8,2),
  PRIMARY KEY (reading_id, ts)
);

SELECT create_hypertable('readings', 'ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_readings_meter_ts ON readings (meter_id, ts DESC);

-- ----------------------------------------------------------------------------
-- INVOICES + PAYMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id     SERIAL PRIMARY KEY,
  connection_id  INT NOT NULL REFERENCES connections(connection_id) ON DELETE CASCADE,
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  total_units    NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','overdue'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_conn ON invoices (connection_id, period_start DESC);

CREATE TABLE IF NOT EXISTS payments (
  payment_id   SERIAL PRIMARY KEY,
  invoice_id   INT NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  amount_paid  NUMERIC(14,2) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  method       TEXT NOT NULL DEFAULT 'card'
);

-- ----------------------------------------------------------------------------
-- LOAD ALERTS (raised by trigger when consumption spikes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS load_alerts (
  alert_id   BIGSERIAL PRIMARY KEY,
  meter_id   INT NOT NULL REFERENCES smart_meters(meter_id) ON DELETE CASCADE,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
  severity   TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  message    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_ts ON load_alerts (ts DESC);
