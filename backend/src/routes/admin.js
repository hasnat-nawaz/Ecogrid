// backend/src/routes/admin.js
import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { withCache, cacheDel } from '../services/cache.js';

const r = Router();

// Tiny helper so a thrown DB error never crashes the server.
const safe = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (e) {
    console.error('[admin route]', req.path, e?.message);
    res.status(500).json({ error: e?.message || 'internal error' });
  }
};

// ─── /overview ───────────────────────────────────────────────────────────────
r.get('/overview', authRequired, adminOnly, safe(async (_req, res) => {
  const payload = await withCache('admin:overview', 5, async () => {
    const [
      { rows: c }, { rows: m }, { rows: e }, { rows: i }, { rows: a },
      { rows: invTotals }, { rows: meterTotal }
    ] = await Promise.all([
      query(`SELECT COUNT(*)::int AS n FROM consumers`),
      query(`SELECT COUNT(*)::int AS n FROM smart_meters WHERE status='active'`),
      query(`SELECT COALESCE(SUM(energy_consumed),0)::float AS kwh FROM readings WHERE ts >= date_trunc('day', now())`),
      query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(total_amount),0)::float AS amt FROM invoices WHERE status='unpaid'`),
      query(`SELECT COUNT(*)::int AS n FROM load_alerts WHERE ts >= now() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*)::int AS total, COALESCE(SUM(total_amount),0)::float AS amt FROM invoices`),
      query(`SELECT COUNT(*)::int AS total FROM smart_meters`),
    ]);
    return {
      consumers: c[0].n,
      active_meters: m[0].n,
      total_meters: meterTotal[0].total,
      energy_today_kwh: e[0].kwh,
      unpaid_invoices: i[0].n,
      unpaid_amount: i[0].amt,
      total_invoices: invTotals[0].total,
      total_billed: invTotals[0].amt,
      alerts_24h: a[0].n,
    };
  });
  res.json(payload);
}));

// ─── /consumers (list) ───────────────────────────────────────────────────────
r.get('/consumers', authRequired, adminOnly, safe(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const cacheKey = q ? null : 'admin:consumers';
  const loader = async () => {
    const where = q
      ? `WHERE c.name ILIKE $1 OR c.email ILIKE $1 OR CAST(c.consumer_id AS TEXT) = $2`
      : ``;
    const params = q ? [`%${q}%`, q] : [];
    const { rows } = await query(`
      SELECT c.consumer_id, c.name, c.email, c.phone, c.created_at,
             (SELECT COUNT(*)::int FROM connections cn WHERE cn.consumer_id=c.consumer_id) AS connections
      FROM consumers c ${where}
      ORDER BY c.created_at DESC
      LIMIT 200`, params);
    return rows;
  };
  const consumers = cacheKey ? await withCache(cacheKey, 15, loader) : await loader();
  res.json({ consumers });
}));

// ─── /consumers/:id (profile + connections) ──────────────────────────────────
r.get('/consumers/:id', authRequired, adminOnly, safe(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

  const { rows: cs } = await query(`
    SELECT c.*, a.street, a.city, r.name AS region_name, r.region_id
    FROM consumers c
    LEFT JOIN addresses a ON a.address_id = c.address_id
    LEFT JOIN regions r ON r.region_id = a.region_id
    WHERE c.consumer_id = $1`, [id]);
  const consumer = cs[0];
  if (!consumer) return res.status(404).json({ error: 'consumer not found' });

  const [{ rows: conns }, { rows: invStat }, { rows: usageRow }] = await Promise.all([
    query(`
      SELECT cn.connection_id, cn.start_date, cn.end_date,
             m.meter_id, m.serial_no, m.status, m.installation_date,
             a.street, a.city, r.name AS region_name,
             pr.name AS parent_region_name
      FROM connections cn
      JOIN smart_meters m ON m.meter_id = cn.meter_id
      LEFT JOIN addresses a ON a.address_id = m.address_id
      LEFT JOIN regions r ON r.region_id = m.region_id
      LEFT JOIN regions pr ON pr.region_id = r.parent_region_id
      WHERE cn.consumer_id = $1
      ORDER BY cn.start_date DESC`, [id]),
    query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE i.status='paid')::int AS paid,
        COUNT(*) FILTER (WHERE i.status='unpaid')::int AS unpaid,
        COUNT(*) FILTER (WHERE i.status='overdue')::int AS overdue,
        COALESCE(SUM(i.total_amount),0)::float AS billed,
        COALESCE(SUM(i.total_amount) FILTER (WHERE i.status='paid'),0)::float AS paid_amount
      FROM invoices i
      JOIN connections cn ON cn.connection_id=i.connection_id
      WHERE cn.consumer_id=$1`, [id]),
    query(`
      SELECT COALESCE(SUM(r.energy_consumed),0)::float AS kwh_30d
      FROM readings r
      JOIN connections cn ON cn.meter_id = r.meter_id AND cn.consumer_id=$1
      WHERE r.ts >= now() - INTERVAL '30 days'`, [id]),
  ]);

  res.json({
    consumer,
    connections: conns,
    invoice_stats: invStat[0] || {},
    usage_30d_kwh: usageRow[0]?.kwh_30d ?? 0,
  });
}));

// ─── /connections (with search by consumer name/id) ──────────────────────────
r.get('/connections', authRequired, adminOnly, safe(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const where = q
    ? `WHERE c.name ILIKE $1 OR c.email ILIKE $1 OR CAST(c.consumer_id AS TEXT) = $2 OR m.serial_no ILIKE $1`
    : '';
  const params = q ? [`%${q}%`, q] : [];

  const { rows } = await query(`
    SELECT cn.connection_id, cn.start_date, cn.end_date,
           c.consumer_id, c.name AS consumer_name, c.email AS consumer_email, c.phone,
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
    JOIN consumers c ON c.consumer_id = cn.consumer_id
    JOIN smart_meters m ON m.meter_id = cn.meter_id
    LEFT JOIN addresses a ON a.address_id = m.address_id
    LEFT JOIN regions r ON r.region_id = m.region_id
    LEFT JOIN regions pr ON pr.region_id = r.parent_region_id
    ${where}
    ORDER BY cn.start_date DESC
    LIMIT 200`, params);
  res.json({ connections: rows });
}));

// ─── /meters/:id ─────────────────────────────────────────────────────────────
r.get('/meters/:id', authRequired, adminOnly, safe(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

  const { rows: ms } = await query(`
    SELECT m.*, a.street, a.city, r.name AS region_name, pr.name AS parent_region_name
    FROM smart_meters m
    LEFT JOIN addresses a ON a.address_id = m.address_id
    LEFT JOIN regions r ON r.region_id = m.region_id
    LEFT JOIN regions pr ON pr.region_id = r.parent_region_id
    WHERE m.meter_id = $1`, [id]);
  const meter = ms[0];
  if (!meter) return res.status(404).json({ error: 'meter not found' });

  const { rows: cons } = await query(`
    SELECT c.consumer_id, c.name, c.email, cn.start_date, cn.end_date
    FROM connections cn
    JOIN consumers c ON c.consumer_id = cn.consumer_id
    WHERE cn.meter_id = $1
    ORDER BY cn.start_date DESC`, [id]);

  res.json({ meter, consumers: cons });
}));

// ─── /regions (hierarchy for filters) ────────────────────────────────────────
r.get('/regions', authRequired, adminOnly, safe(async (_req, res) => {
  const regions = await withCache('admin:regions', 60, async () => {
    const { rows } = await query(`
      SELECT region_id, name, parent_region_id
      FROM regions ORDER BY name`);
    return rows;
  });
  res.json({ regions });
}));

// ─── /consumption (overall + by region/meter + date range) ───────────────────
// Query params:
//   from, to (ISO dates) — default: last 7 days
//   region_id (parent) | subregion_id (child)
//   meter_id
r.get('/consumption', authRequired, adminOnly, safe(async (req, res) => {
  const { region_id, subregion_id, meter_id } = req.query;
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const to   = req.query.to   ? new Date(req.query.to)   : new Date();
  if (isNaN(from) || isNaN(to)) return res.status(400).json({ error: 'invalid dates' });

  const conds = [`r.ts >= $1`, `r.ts <= $2`];
  const params = [from.toISOString(), to.toISOString()];
  if (meter_id) { params.push(Number(meter_id)); conds.push(`r.meter_id = $${params.length}`); }
  if (subregion_id) { params.push(Number(subregion_id)); conds.push(`m.region_id = $${params.length}`); }
  else if (region_id) {
    params.push(Number(region_id));
    conds.push(`(m.region_id = $${params.length} OR m.region_id IN (SELECT region_id FROM regions WHERE parent_region_id = $${params.length}))`);
  }

  const where = `WHERE ${conds.join(' AND ')}`;

  // Pick a bucket that yields ~80 points so the line is always jagged,
  // not a single flat segment.
  const spanDays = (to - from) / (24 * 3600 * 1000);
  let bucket;
  if      (spanDays <= 0.5) bucket = `'5 minutes'`;
  else if (spanDays <= 2)   bucket = `'15 minutes'`;
  else if (spanDays <= 7)   bucket = `'1 hour'`;
  else if (spanDays <= 30)  bucket = `'4 hours'`;
  else if (spanDays <= 180) bucket = `'1 day'`;
  else                      bucket = `'1 week'`;

  const [{ rows: series }, { rows: peaks }, { rows: totals }] = await Promise.all([
    query(`
      SELECT time_bucket(${bucket}, r.ts) AS bucket,
             SUM(r.energy_consumed)::float AS kwh
      FROM readings r
      JOIN smart_meters m ON m.meter_id = r.meter_id
      ${where}
      GROUP BY bucket ORDER BY bucket`, params),
    // 24 bars always — silent hours show as 0 instead of disappearing
    query(`
      WITH hourly AS (
        SELECT EXTRACT(HOUR FROM r.ts)::int AS hour,
               SUM(r.energy_consumed)::float AS kwh
        FROM readings r
        JOIN smart_meters m ON m.meter_id = r.meter_id
        ${where}
        GROUP BY hour
      )
      SELECT h AS hour, COALESCE(hourly.kwh, 0)::float AS kwh
      FROM generate_series(0, 23) h
      LEFT JOIN hourly ON hourly.hour = h
      ORDER BY h`, params),
    query(`
      SELECT COALESCE(SUM(r.energy_consumed),0)::float AS total_kwh,
             COUNT(*)::int AS samples,
             COALESCE(AVG(r.energy_consumed),0)::float AS avg_kwh
      FROM readings r
      JOIN smart_meters m ON m.meter_id = r.meter_id
      ${where}`, params),
  ]);

  res.json({ series, peaks, totals: totals[0] || {}, bucket: bucket.replace(/'/g, '') });
}));

// ─── /consumption/meter/search?serial=...|id=... ─────────────────────────────
r.get('/consumption/meter/search', authRequired, adminOnly, safe(async (req, res) => {
  const id = req.query.id ? Number(req.query.id) : null;
  const serial = (req.query.serial || '').toString().trim();
  if (!id && !serial) return res.status(400).json({ error: 'id or serial required' });

  const { rows } = await query(`
    SELECT m.meter_id, m.serial_no, m.status
    FROM smart_meters m
    WHERE ($1::int IS NOT NULL AND m.meter_id = $1::int)
       OR ($2::text <> '' AND m.serial_no ILIKE $2::text)
    LIMIT 1`, [id, serial ? `%${serial}%` : '']);

  if (!rows[0]) return res.status(404).json({ error: 'meter not found' });
  res.json({ meter: rows[0] });
}));

// ─── /billing (list invoices, filterable) ───────────────────────────────────
r.get('/billing', authRequired, adminOnly, safe(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const status = (req.query.status || '').toString().trim();
  const month = (req.query.month || '').toString().trim();   // YYYY-MM

  const conds = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`, q);
    conds.push(`(c.name ILIKE $${params.length - 1} OR c.email ILIKE $${params.length - 1} OR CAST(c.consumer_id AS TEXT) = $${params.length})`);
  }
  if (status) { params.push(status); conds.push(`i.status = $${params.length}`); }
  if (month) { params.push(`${month}-01`); conds.push(`date_trunc('month', i.period_start) = date_trunc('month', $${params.length}::date)`); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await query(`
    SELECT i.invoice_id, i.period_start, i.period_end,
           i.total_units, i.total_amount, i.status, i.generated_at,
           c.consumer_id, c.name AS consumer_name, c.email AS consumer_email
    FROM invoices i
    JOIN connections cn ON cn.connection_id = i.connection_id
    JOIN consumers   c  ON c.consumer_id   = cn.consumer_id
    ${where}
    ORDER BY i.generated_at DESC LIMIT 500`, params);
  res.json({ invoices: rows });
}));

// ─── /billing/stats — for the statistics view ───────────────────────────────
r.get('/billing/stats', authRequired, adminOnly, safe(async (req, res) => {
  const month = (req.query.month || '').toString().trim();
  const monthCond = month ? `WHERE date_trunc('month', i.period_start) = date_trunc('month', $1::date)` : '';
  const monthParam = month ? [`${month}-01`] : [];

  const [{ rows: byStatus }, { rows: monthly }, { rows: thisMonth }, { rows: paid_overall }] = await Promise.all([
    query(`
      SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total_amount),0)::float AS amount
      FROM invoices i ${monthCond}
      GROUP BY status`, monthParam),
    query(`
      SELECT to_char(date_trunc('month', i.period_start), 'YYYY-MM') AS month,
             COUNT(*)::int AS invoices,
             COALESCE(SUM(total_amount),0)::float AS amount,
             COALESCE(SUM(total_amount) FILTER (WHERE status='paid'),0)::float AS paid_amount
      FROM invoices i
      WHERE i.period_start >= now() - INTERVAL '12 months'
      GROUP BY month ORDER BY month`),
    query(`
      SELECT COALESCE(SUM(total_amount),0)::float AS amount,
             COUNT(*)::int AS invoices
      FROM invoices
      WHERE date_trunc('month', period_start) = date_trunc('month', CURRENT_DATE)`),
    query(`
      SELECT COALESCE(SUM(amount_paid),0)::float AS paid_total
      FROM payments
      WHERE date_trunc('month', payment_date) = date_trunc('month', CURRENT_DATE)`),
  ]);

  res.json({
    by_status: byStatus,
    monthly,
    this_month: { ...(thisMonth[0] || {}), paid: paid_overall[0]?.paid_total || 0 },
  });
}));

// ─── /billing/run ────────────────────────────────────────────────────────────
r.post('/billing/run', authRequired, adminOnly, safe(async (req, res) => {
  const { period_start, period_end, tariffs } = req.body || {};

  // Optional: replace the tariff set before running. `tariffs` is an array of
  // { name, rate_per_unit, start_time, end_time }.
  // We do a clean DELETE + INSERT so the table never accumulates stale rows.
  // (No other table references tariff_id, so deletion is safe.)
  if (Array.isArray(tariffs) && tariffs.length) {
    const cleaned = tariffs
      .filter(t => t && t.name && t.rate_per_unit != null && !Number.isNaN(Number(t.rate_per_unit)));

    await query('BEGIN');
    try {
      await query(`DELETE FROM tariffs`);
      for (const t of cleaned) {
        await query(`
          INSERT INTO tariffs (name, rate_per_unit, start_time, end_time, active)
          VALUES ($1, $2, $3, $4, TRUE)`,
          [t.name, Number(t.rate_per_unit), t.start_time || '00:00', t.end_time || '23:59']);
      }
      await query('COMMIT');
    } catch (e) {
      await query('ROLLBACK').catch(() => {});
      throw e;
    }
  }

  if (!period_start || !period_end) {
    await query(`CALL generate_invoices_for_period()`);
  } else {
    await query(`CALL generate_invoices_for_period($1::date, $2::date)`,
      [period_start, period_end]);
  }

  await cacheDel('admin:overview', 'admin:billing*');
  res.json({ ok: true });
}));

// ─── /tariffs (read current ToU rates — only active ones are shown) ────────
r.get('/tariffs', authRequired, adminOnly, safe(async (_req, res) => {
  const { rows } = await query(`
    SELECT tariff_id, name, rate_per_unit, start_time, end_time, active
    FROM tariffs
    WHERE active = TRUE
    ORDER BY start_time`);
  res.json({ tariffs: rows });
}));

// ─── /alerts (with filters) ─────────────────────────────────────────────────
r.get('/alerts', authRequired, adminOnly, safe(async (req, res) => {
  const severity = (req.query.severity || '').toString().trim();
  const meter_id = req.query.meter_id ? Number(req.query.meter_id) : null;
  const from = req.query.from ? new Date(req.query.from) : null;
  const to   = req.query.to   ? new Date(req.query.to)   : null;

  const conds = [];
  const params = [];
  if (severity) { params.push(severity); conds.push(`severity = $${params.length}`); }
  if (meter_id) { params.push(meter_id); conds.push(`meter_id = $${params.length}`); }
  if (from && !isNaN(from)) { params.push(from.toISOString()); conds.push(`ts >= $${params.length}`); }
  if (to   && !isNaN(to))   { params.push(to.toISOString());   conds.push(`ts <= $${params.length}`); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await query(`
    SELECT alert_id, meter_id, ts, severity, message
    FROM load_alerts ${where}
    ORDER BY ts DESC LIMIT 200`, params);
  res.json({ alerts: rows });
}));

// ─── /alerts/:id (detail) ───────────────────────────────────────────────────
r.get('/alerts/:id', authRequired, adminOnly, safe(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

  const { rows: ar } = await query(`
    SELECT a.*, m.serial_no, m.status AS meter_status,
           addr.street, addr.city, r.name AS region_name
    FROM load_alerts a
    LEFT JOIN smart_meters m ON m.meter_id = a.meter_id
    LEFT JOIN addresses addr ON addr.address_id = m.address_id
    LEFT JOIN regions r ON r.region_id = m.region_id
    WHERE a.alert_id = $1`, [id]);
  const alert = ar[0];
  if (!alert) return res.status(404).json({ error: 'alert not found' });

  // include recent readings around the alert
  const { rows: readings } = await query(`
    SELECT ts, energy_consumed, voltage, current_amp
    FROM readings
    WHERE meter_id = $1
      AND ts BETWEEN ($2::timestamptz - INTERVAL '15 minutes')
                 AND ($2::timestamptz + INTERVAL '15 minutes')
    ORDER BY ts`, [alert.meter_id, alert.ts]);

  res.json({ alert, readings });
}));

export default r;
