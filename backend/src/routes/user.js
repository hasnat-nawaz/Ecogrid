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
r.get('/me', authRequired, async (req, res) => {
  const c = await consumerForUser(req.user.uid);
  if (!c) return res.json({ consumer: null });

  const conns = await withCache(`consumer:${c.consumer_id}:connections`, 60, async () => {
    const { rows } = await query(`
      SELECT cn.connection_id, cn.start_date, cn.end_date,
             m.meter_id, m.serial_no, m.status
      FROM connections cn JOIN smart_meters m ON m.meter_id=cn.meter_id
      WHERE cn.consumer_id=$1`, [c.consumer_id]);
    return rows;
  });

  res.json({ consumer: c, connections: conns });
});

// ─── /consumption ─────────────────────────────────────────────────────────────
// TimescaleDB time_bucket query — most expensive route. Cache 30 s so the chart
// feels live but we're not hammering the hypertable on every poll.
r.get('/consumption', authRequired, async (req, res) => {
  const c = await consumerForUser(req.user.uid);
  if (!c) return res.json({ series: [] });

  const series = await withCache(`consumer:${c.consumer_id}:consumption:24h`, 30, async () => {
    const { rows } = await query(`
      SELECT time_bucket('1 hour', r.ts) AS bucket,
             SUM(r.energy_consumed)::float AS kwh
      FROM readings r
      JOIN connections cn ON cn.meter_id = r.meter_id AND cn.consumer_id=$1
      WHERE r.ts >= now() - INTERVAL '24 hours'
      GROUP BY bucket ORDER BY bucket`, [c.consumer_id]);
    return rows;
  });

  res.json({ series });
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