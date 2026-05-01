import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { cacheGet, cacheSet } from '../services/cache.js';

const r = Router();

// Admin overview: total consumers, meters, today's energy, unpaid invoices
r.get('/overview', authRequired, adminOnly, async (_req, res) => {
  const cached = await cacheGet('admin:overview');
  if (cached) return res.json({ ...cached, cached: true });

  const [{ rows: c }, { rows: m }, { rows: e }, { rows: i }, { rows: a }] = await Promise.all([
    query(`SELECT COUNT(*)::int AS n FROM consumers`),
    query(`SELECT COUNT(*)::int AS n FROM smart_meters WHERE status='active'`),
    query(`SELECT COALESCE(SUM(energy_consumed),0)::float AS kwh FROM readings WHERE ts >= date_trunc('day', now())`),
    query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(total_amount),0)::float AS amt FROM invoices WHERE status='unpaid'`),
    query(`SELECT COUNT(*)::int AS n FROM load_alerts WHERE ts >= now() - INTERVAL '24 hours'`),
  ]);
  const payload = {
    consumers: c[0].n, active_meters: m[0].n,
    energy_today_kwh: e[0].kwh,
    unpaid_invoices: i[0].n, unpaid_amount: i[0].amt,
    alerts_24h: a[0].n,
  };
  await cacheSet('admin:overview', payload, 15);
  res.json(payload);
});

r.get('/consumers', authRequired, adminOnly, async (_req, res) => {
  const { rows } = await query(`
    SELECT c.consumer_id, c.name, c.email, c.phone, c.created_at,
           (SELECT COUNT(*)::int FROM connections cn WHERE cn.consumer_id=c.consumer_id) AS connections
    FROM consumers c ORDER BY c.created_at DESC LIMIT 200`);
  res.json({ consumers: rows });
});

r.get('/billing', authRequired, adminOnly, async (_req, res) => {
  const { rows } = await query(`
    SELECT i.invoice_id, i.period_start, i.period_end, i.total_units, i.total_amount, i.status,
           c.name AS consumer_name, c.email AS consumer_email
    FROM invoices i
    JOIN connections cn ON cn.connection_id = i.connection_id
    JOIN consumers   c  ON c.consumer_id   = cn.consumer_id
    ORDER BY i.generated_at DESC LIMIT 200`);
  res.json({ invoices: rows });
});

r.get('/alerts', authRequired, adminOnly, async (_req, res) => {
  const { rows } = await query(`SELECT * FROM load_alerts ORDER BY ts DESC LIMIT 100`);
  res.json({ alerts: rows });
});

// Manually trigger billing for a period (admin)
r.post('/billing/run', authRequired, adminOnly, async (req, res) => {
  const { period_start, period_end } = req.body || {};
  await query(`CALL generate_invoices_for_period($1::date, $2::date)`,
    [period_start || null, period_end || null]);
  res.json({ ok: true });
});

export default r;
