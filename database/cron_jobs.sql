-- ============================================================================
-- EcoGrid — pg_cron scheduled jobs
-- ============================================================================

-- Generate invoices on the 1st of every month at 02:00 UTC for the previous month
SELECT cron.schedule(
  'ecogrid_monthly_billing',
  '0 2 1 * *',
  $$ CALL generate_invoices_for_period(); $$
);

-- Mark overdue invoices daily at 03:00 UTC
SELECT cron.schedule(
  'ecogrid_mark_overdue',
  '0 3 * * *',
  $$ CALL mark_overdue_invoices(); $$
);

-- Compress / drop very old reading rows weekly (keep 1 year of raw data)
SELECT cron.schedule(
  'ecogrid_prune_readings',
  '0 4 * * 0',
  $$ DELETE FROM readings WHERE ts < now() - INTERVAL '1 year'; $$
);
