import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';

const r = Router();

async function consumerForUser(uid) {
  const { rows } = await query(`SELECT * FROM consumers WHERE user_id=$1 LIMIT 1`, [uid]);
  return rows[0];
}

r.get('/me', authRequired, async (req, res) => {
  const c = await consumerForUser(req.user.uid);
  if (!c) return res.json({ consumer: null });
  const { rows: conns } = await query(`
    SELECT cn.connection_id, cn.start_date, cn.end_date,
           m.meter_id, m.serial_no, m.status
    FROM connections cn JOIN smart_meters m ON m.meter_id=cn.meter_id
    WHERE cn.consumer_id=$1`, [c.consumer_id]);
  res.json({ consumer: c, connections: conns });
});

// Real-time consumption for the user's primary meter (last 24h, hourly buckets)
r.get('/consumption', authRequired, async (req, res) => {
  const c = await consumerForUser(req.user.uid);
  if (!c) return res.json({ series: [] });
  const { rows } = await query(`
    SELECT time_bucket('1 hour', r.ts) AS bucket,
           SUM(r.energy_consumed)::float AS kwh
    FROM readings r
    JOIN connections cn ON cn.meter_id = r.meter_id AND cn.consumer_id=$1
    WHERE r.ts >= now() - INTERVAL '24 hours'
    GROUP BY bucket ORDER BY bucket`, [c.consumer_id]);
  res.json({ series: rows });
});

r.get('/invoices', authRequired, async (req, res) => {
  const c = await consumerForUser(req.user.uid);
  if (!c) return res.json({ invoices: [] });
  const { rows } = await query(`
    SELECT i.* FROM invoices i
    JOIN connections cn ON cn.connection_id=i.connection_id
    WHERE cn.consumer_id=$1
    ORDER BY i.generated_at DESC`, [c.consumer_id]);
  res.json({ invoices: rows });
});

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
  await query(`INSERT INTO payments (invoice_id, amount_paid, method) VALUES ($1, $2, 'card')`,
    [id, inv.total_amount]);
  res.json({ ok: true });
});

export default r;
