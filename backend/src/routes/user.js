// backend/src/routes/user.js
import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';
import { withCache, cacheDel } from '../services/cache.js';

const r = Router();

// ─── helper ───────────────────────────────────────────────────────────────────
// Cached per-user consumer lookup — called on almost every route, was hitting
// DB every single time before.
async function consumerForUser(uid) {
  return withCache(`consumer:uid:${uid}`, 120, async () => {
    const { rows } = await query(
      `SELECT * FROM consumers WHERE user_id=$1 LIMIT 1`, [uid]
    );
    return rows[0] ?? null;
  });
}

// ─── /me ─────────────────────────────────────────────────────────────────────
// Returns the full consumer profile (with address + region) and every meter
// the consumer is connected to (with address, region, sub-region, install date,
// last reading timestamp, and rolling 30-day kWh) so the dashboard, profile
// page, and meters page can all render off a single payload.
r.get('/me', authRequired, async (req, res) => {
  const c = await consumerForUser(req.user.uid);
  if (!c) return res.json({ consumer: null });

  const profile = await withCache(`consumer:${c.consumer_id}:profile`, 60, async () => {
    const { rows } = await query(`
      SELECT c.consumer_id, c.user_id, c.name, c.email, c.phone, c.created_at,
             a.address_id, a.street, a.city,
             r.region_id, r.name AS region_name,
             pr.name AS parent_region_name
      FROM consumers c
      LEFT JOIN addresses a ON a.address_id = c.address_id
      LEFT JOIN regions   r ON r.region_id   = a.region_id
      LEFT JOIN regions   pr ON pr.region_id = r.parent_region_id
      WHERE c.consumer_id = $1`, [c.consumer_id]);
    return rows[0] ?? c;
  });

  const conns = await withCache(`consumer:${c.consumer_id}:connections`, 60, async () => {
    const { rows } = await query(`
      SELECT cn.connection_id, cn.start_date, cn.end_date,
             m.meter_id, m.serial_no, m.status, m.installation_date,
             a.street, a.city,
             r.region_id, r.name AS region_name,
             pr.name AS parent_region_name,
             (SELECT COALESCE(SUM(rd.energy_consumed),0)::float
                FROM readings rd
               WHERE rd.meter_id = m.meter_id
                 AND rd.ts >= now() - INTERVAL '30 days') AS kwh_30d,
             (SELECT MAX(ts) FROM readings rd WHERE rd.meter_id = m.meter_id) AS last_reading_ts
      FROM connections cn
      JOIN smart_meters m ON m.meter_id = cn.meter_id
      LEFT JOIN addresses a ON a.address_id = m.address_id
      LEFT JOIN regions   r ON r.region_id  = m.region_id
      LEFT JOIN regions   pr ON pr.region_id = r.parent_region_id
      WHERE cn.consumer_id = $1
      ORDER BY cn.start_date DESC`, [c.consumer_id]);
    return rows;
  });

  res.json({ consumer: profile, connections: conns });
});

// ─── /consumption ─────────────────────────────────────────────────────────────
// Accepts optional ?from, ?to, ?meter_id query params so the user dashboard
// can let consumers slice by date and by individual meter. Uses the same
// adaptive bucket sizing as the admin route → always a jagged line.
r.get('/consumption', authRequired, async (req, res) => {
  const c = await consumerForUser(req.user.uid);
  if (!c) return res.json({ series: [] });

  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 24 * 3600 * 1000);
  const to   = req.query.to   ? new Date(req.query.to)   : new Date();
  if (isNaN(from) || isNaN(to)) return res.status(400).json({ error: 'invalid dates' });
  const meterId = req.query.meter_id ? Number(req.query.meter_id) : null;

  const spanDays = (to - from) / (24 * 3600 * 1000);
  let bucket;
  if      (spanDays <= 0.5) bucket = `'5 minutes'`;
  else if (spanDays <= 2)   bucket = `'15 minutes'`;
  else if (spanDays <= 7)   bucket = `'1 hour'`;
  else if (spanDays <= 30)  bucket = `'4 hours'`;
  else if (spanDays <= 180) bucket = `'1 day'`;
  else                      bucket = `'1 week'`;

  const conds = [`cn.consumer_id = $1`, `r.ts >= $2`, `r.ts <= $3`];
  const params = [c.consumer_id, from.toISOString(), to.toISOString()];
  if (meterId) { params.push(meterId); conds.push(`r.meter_id = $${params.length}`); }
  const where = `WHERE ${conds.join(' AND ')}`;

  // Cache key reflects the filter so distinct selections don't trample each other
  const key = `consumer:${c.consumer_id}:consumption:${spanDays.toFixed(2)}:${meterId || 'all'}:${from.toISOString().slice(0,10)}-${to.toISOString().slice(0,10)}`;
  const series = await withCache(key, 5, async () => {
    const { rows } = await query(`
      SELECT time_bucket(${bucket}, r.ts) AS bucket,
             SUM(r.energy_consumed)::float AS kwh
      FROM readings r
      JOIN connections cn ON cn.meter_id = r.meter_id
      ${where}
      GROUP BY bucket ORDER BY bucket`, params);
    return rows;
  });

  res.json({ series, bucket: bucket.replace(/'/g, '') });
});

// ─── /invoices ────────────────────────────────────────────────────────────────
r.get('/invoices', authRequired, async (req, res) => {
  const c = await consumerForUser(req.user.uid);
  if (!c) return res.json({ invoices: [] });

  const invoices = await withCache(`consumer:${c.consumer_id}:invoices`, 30, async () => {
    const { rows } = await query(`
      SELECT i.* FROM invoices i
      JOIN connections cn ON cn.connection_id=i.connection_id
      WHERE cn.consumer_id=$1
      ORDER BY i.generated_at DESC`, [c.consumer_id]);
    return rows;
  });

  res.json({ invoices });
});

// ─── /invoices/:id/pay ────────────────────────────────────────────────────────
r.post('/invoices/:id/pay', authRequired, async (req, res) => {
  const c = await consumerForUser(req.user.uid);
  if (!c) return res.status(404).json({ error: 'no consumer' });

  const id = Number(req.params.id);
  const { rows } = await query(`
    SELECT i.* FROM invoices i
    JOIN connections cn ON cn.connection_id=i.connection_id
    WHERE i.invoice_id=$1 AND cn.consumer_id=$2`, [id, c.consumer_id]);

  const inv = rows[0];
  if (!inv) return res.status(404).json({ error: 'not found' });

  await query(
    `INSERT INTO payments (invoice_id, amount_paid, method) VALUES ($1, $2, 'card')`,
    [id, inv.total_amount]
  );

  // Bust invoice list + admin caches so both dashboards reflect the payment
  await cacheDel(
    `consumer:${c.consumer_id}:invoices`,
    'admin:overview',
    'admin:billing*',
  );

  res.json({ ok: true });
});

export default r;