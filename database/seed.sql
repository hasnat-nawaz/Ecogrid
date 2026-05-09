-- ============================================================================
-- EcoGrid — Seed data
-- Wipes existing rows in dependency order, then re-creates a clean topology:
--   • 1 admin account
--   • 1 consumer (Alice) in Sector A with 1 meter   (MTR-0001)
--   • 1 consumer (Bob)   in Sector B with 2 meters  (MTR-0002, MTR-0003)
--
-- Demo creds (see README):
--   admin@ecogrid.io / admin123
--   alice@ecogrid.io / alice123
--   bob@ecogrid.io   / bob123
-- ============================================================================

-- ── Wipe in dependency-safe order ───────────────────────────────────────────
TRUNCATE TABLE
  payments,
  invoices,
  load_alerts,
  readings,
  connections,
  smart_meters,
  consumers,
  app_users,
  addresses,
  regions,
  providers,
  tariffs
RESTART IDENTITY CASCADE;

-- ── Provider + regions (sectors) ────────────────────────────────────────────
INSERT INTO providers (name, province) VALUES
  ('National Power Co.', 'Capital');

INSERT INTO regions (name, provider_id) VALUES
  ('Sector A', 1),
  ('Sector B', 1);

-- ── Addresses ───────────────────────────────────────────────────────────────
-- 1: Alice's home in Sector A
-- 2: Bob's home in Sector B
-- 3: Bob's second meter (e.g. workshop) in Sector B
INSERT INTO addresses (street, city, region_id) VALUES
  ('12 Grid Lane',     'Metro City', 1),
  ('44 Volt Road',     'Metro City', 2),
  ('44 Volt Road #B',  'Metro City', 2);

-- ── Time-of-Use tariffs ─────────────────────────────────────────────────────
INSERT INTO tariffs (name, rate_per_unit, start_time, end_time, active) VALUES
  ('Off-Peak', 8.50,  '22:00', '06:00', TRUE),
  ('Standard', 14.00, '06:00', '17:00', TRUE),
  ('Peak',     22.00, '17:00', '22:00', TRUE);

-- ── Auth users (bcrypt hashes generated with cost 10) ───────────────────────
INSERT INTO app_users (email, password_hash, role) VALUES
  ('admin@ecogrid.io', '$2b$10$xUzNbvWhrrqGaG8ECWZVu..c8YYvWmo/PsDe524RxxmABf2WWleqS', 'admin'),
  ('alice@ecogrid.io', '$2b$10$gRvYRB0LP1JWnRCflow6SudEq3UOZ0cLiBfztGvWzRbnKpOhGH/9.', 'user'),
  ('bob@ecogrid.io',   '$2b$10$9Gn9g5EspREmLbu8f49XfO1AaKyPDGZYY8dJfr9ZQaJ5ETv5awCwy', 'user');

-- ── Consumer profiles linked to user accounts ───────────────────────────────
INSERT INTO consumers (user_id, name, email, phone, address_id)
SELECT user_id, 'Alice Walker', 'alice@ecogrid.io', '+10000000001', 1
FROM app_users WHERE email = 'alice@ecogrid.io';

INSERT INTO consumers (user_id, name, email, phone, address_id)
SELECT user_id, 'Bob Carter', 'bob@ecogrid.io', '+10000000002', 2
FROM app_users WHERE email = 'bob@ecogrid.io';

-- ── Smart meters ────────────────────────────────────────────────────────────
-- MTR-0001 → Sector A (Alice)
-- MTR-0002 → Sector B (Bob, primary)
-- MTR-0003 → Sector B (Bob, secondary)
INSERT INTO smart_meters (serial_no, address_id, region_id) VALUES
  ('MTR-0001', 1, 1),
  ('MTR-0002', 2, 2),
  ('MTR-0003', 3, 2);

-- ── Connections (consumer ↔ meter) ──────────────────────────────────────────
-- Alice gets MTR-0001
INSERT INTO connections (consumer_id, meter_id, start_date)
SELECT c.consumer_id, m.meter_id, CURRENT_DATE - INTERVAL '60 days'
FROM consumers c, smart_meters m
WHERE c.email='alice@ecogrid.io' AND m.serial_no='MTR-0001';

-- Bob gets MTR-0002 and MTR-0003
INSERT INTO connections (consumer_id, meter_id, start_date)
SELECT c.consumer_id, m.meter_id, CURRENT_DATE - INTERVAL '60 days'
FROM consumers c, smart_meters m
WHERE c.email='bob@ecogrid.io' AND m.serial_no IN ('MTR-0002', 'MTR-0003');
