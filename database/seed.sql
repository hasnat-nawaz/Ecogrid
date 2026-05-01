-- ============================================================================
-- EcoGrid — Seed data (provider, region, tariffs, demo admin & user)
-- Demo creds:  admin@ecogrid.io / admin123    user@ecogrid.io / user123
-- Hashes are bcrypt of those passwords (cost 10).
-- ============================================================================

INSERT INTO providers (name, province) VALUES
  ('National Power Co.', 'Capital');

INSERT INTO regions (name, provider_id) VALUES
  ('Sector A', 1), ('Sector B', 1);

INSERT INTO addresses (street, city, region_id) VALUES
  ('12 Grid Lane', 'Metro City', 1),
  ('44 Volt Road',  'Metro City', 2);

-- ToU tariffs
INSERT INTO tariffs (name, rate_per_unit, start_time, end_time, active) VALUES
  ('Off-Peak', 8.50,  '22:00', '06:00', TRUE),
  ('Standard', 14.00, '06:00', '17:00', TRUE),
  ('Peak',     22.00, '17:00', '22:00', TRUE);

-- Demo users
INSERT INTO app_users (email, password_hash, role) VALUES
  ('admin@ecogrid.io', '$2b$10$zW4eS49ru5xcc/DUlCSywOYD4DPSpeonOp76rUkMQdh1jqytM9wT2', 'admin'),
  ('user@ecogrid.io',  '$2b$10$AYtKs2l/exubhMFZKBRFeebdPmjh5Mf0sQgQQcFbcYqYUkld25yxC', 'user');

-- Consumer linked to the user account
INSERT INTO consumers (user_id, name, email, phone, address_id)
SELECT user_id, 'Demo Consumer', 'user@ecogrid.io', '+10000000000', 1
FROM app_users WHERE email='user@ecogrid.io';

-- Smart meters
INSERT INTO smart_meters (serial_no, address_id, region_id) VALUES
  ('MTR-0001', 1, 1),
  ('MTR-0002', 2, 2);

-- Connection: demo consumer ↔ MTR-0001
INSERT INTO connections (consumer_id, meter_id, start_date)
SELECT c.consumer_id, m.meter_id, CURRENT_DATE - INTERVAL '60 days'
FROM consumers c, smart_meters m
WHERE c.email='user@ecogrid.io' AND m.serial_no='MTR-0001';
