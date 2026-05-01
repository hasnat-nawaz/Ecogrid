-- ============================================================================
-- EcoGrid — Triggers, Functions & Stored Procedures
-- Database-centric business logic: ToU billing + load monitoring
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FUNCTION: get_tariff_rate(ts) — returns active ToU rate for a timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_tariff_rate(p_ts TIMESTAMPTZ)
RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC;
  v_time TIME := (p_ts AT TIME ZONE 'UTC')::TIME;
BEGIN
  SELECT rate_per_unit INTO v_rate
  FROM tariffs
  WHERE active = TRUE
    AND (
      (start_time <= end_time AND v_time >= start_time AND v_time < end_time)
      OR (start_time > end_time AND (v_time >= start_time OR v_time < end_time))
    )
  ORDER BY rate_per_unit DESC
  LIMIT 1;

  RETURN COALESCE(v_rate, 10.00); -- default fallback rate
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- TRIGGER FN: monitor load — raise alert on high-consumption readings
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_readings_monitor()
RETURNS TRIGGER AS $$
BEGIN
  -- A single 1-minute interval > 5 kWh is unusual residential load
  IF NEW.energy_consumed > 5 THEN
    INSERT INTO load_alerts (meter_id, ts, severity, message)
    VALUES (
      NEW.meter_id,
      NEW.ts,
      CASE WHEN NEW.energy_consumed > 10 THEN 'critical' ELSE 'warning' END,
      format('High load on meter %s: %.2f kWh', NEW.meter_id, NEW.energy_consumed)
    );

    -- NOTIFY listeners (the Node backend LISTENs and pushes to WS clients)
    PERFORM pg_notify(
      'ecogrid_alert',
      json_build_object(
        'meter_id', NEW.meter_id,
        'ts', NEW.ts,
        'energy_consumed', NEW.energy_consumed
      )::text
    );
  END IF;

  -- Always notify on every reading so dashboards can update in realtime
  PERFORM pg_notify(
    'ecogrid_reading',
    json_build_object(
      'meter_id', NEW.meter_id,
      'ts', NEW.ts,
      'energy_consumed', NEW.energy_consumed,
      'voltage', NEW.voltage,
      'current_amp', NEW.current_amp
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS readings_monitor ON readings;
CREATE TRIGGER readings_monitor
AFTER INSERT ON readings
FOR EACH ROW EXECUTE FUNCTION trg_readings_monitor();

-- ----------------------------------------------------------------------------
-- PROCEDURE: generate_invoice_for_connection(conn, period_start, period_end)
-- Computes ToU billing for a connection over a billing period.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE generate_invoice_for_connection(
  p_connection_id INT,
  p_period_start  DATE,
  p_period_end    DATE
) AS $$
DECLARE
  v_meter_id    INT;
  v_total_units NUMERIC := 0;
  v_total_amt   NUMERIC := 0;
BEGIN
  SELECT meter_id INTO v_meter_id
  FROM connections WHERE connection_id = p_connection_id;

  IF v_meter_id IS NULL THEN
    RAISE NOTICE 'Connection % has no meter', p_connection_id;
    RETURN;
  END IF;

  -- ToU billing: sum (energy * tariff_rate_at_ts) over all readings
  SELECT
    COALESCE(SUM(energy_consumed), 0),
    COALESCE(SUM(energy_consumed * get_tariff_rate(ts)), 0)
  INTO v_total_units, v_total_amt
  FROM readings
  WHERE meter_id = v_meter_id
    AND ts >= p_period_start
    AND ts <  p_period_end + INTERVAL '1 day';

  INSERT INTO invoices (connection_id, period_start, period_end, total_units, total_amount, status)
  VALUES (p_connection_id, p_period_start, p_period_end, v_total_units, ROUND(v_total_amt, 2), 'unpaid');
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- PROCEDURE: generate_invoices_for_period — runs for ALL active connections
-- Called by pg_cron monthly.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE generate_invoices_for_period(
  p_period_start DATE DEFAULT (date_trunc('month', CURRENT_DATE - INTERVAL '1 month'))::DATE,
  p_period_end   DATE DEFAULT (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::DATE
) AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT connection_id FROM connections
    WHERE end_date IS NULL OR end_date >= p_period_start
  LOOP
    CALL generate_invoice_for_connection(r.connection_id, p_period_start, p_period_end);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- PROCEDURE: mark_overdue_invoices — runs daily
-- ----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE mark_overdue_invoices() AS $$
BEGIN
  UPDATE invoices
  SET status = 'overdue'
  WHERE status = 'unpaid'
    AND generated_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- TRIGGER: auto-mark invoice paid when payment >= total_amount
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_payments_settle()
RETURNS TRIGGER AS $$
DECLARE
  v_paid NUMERIC;
  v_due  NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount_paid),0) INTO v_paid FROM payments WHERE invoice_id = NEW.invoice_id;
  SELECT total_amount INTO v_due FROM invoices WHERE invoice_id = NEW.invoice_id;
  IF v_paid >= v_due THEN
    UPDATE invoices SET status = 'paid' WHERE invoice_id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_settle ON payments;
CREATE TRIGGER payments_settle
AFTER INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION trg_payments_settle();
