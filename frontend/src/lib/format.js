// ── Currency (Pakistani Rupee) ──────────────────────────────
const fmtPKR = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 2,
});

export function rs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Rs 0.00';
  return fmtPKR.format(n).replace('PKR', 'Rs').replace('Rs ', 'Rs ');
}

export function kwh(value, digits = 2) {
  const n = Number(value);
  return `${(Number.isFinite(n) ? n : 0).toFixed(digits)} kWh`;
}

// ── Dates (display) ─────────────────────────────────────────
//  All dates shown to humans use "DD MMM YYYY" format — never the
//  ambiguous numeric form (which is locale-dependent).

const SHORT_OPTS = { day: '2-digit', month: 'short', year: 'numeric' };
const TIME_OPTS  = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };

export function shortDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', SHORT_OPTS);
}

export function dateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', TIME_OPTS);
}

/**
 * Render a date range for chart headers.
 *   2026-05-03 → 2026-05-10  becomes  "3 May – 10 May 2026"
 *   2026-05-10 → 2026-05-10  becomes  "10 May 2026"
 *   2026-04-01 → 2026-05-10  becomes  "1 Apr – 10 May 2026"
 *   2025-12-29 → 2026-01-05  becomes  "29 Dec 2025 – 5 Jan 2026"
 */
export function rangeLabel(fromIso, toIso) {
  if (!fromIso || !toIso) return '';
  const f = new Date(fromIso);
  const t = new Date(toIso);
  if (isNaN(f) || isNaN(t)) return '';

  const sameDay  = f.toDateString() === t.toDateString();
  const sameYear = f.getFullYear()  === t.getFullYear();

  const fmtDM   = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const fmtDMY  = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (sameDay)  return fmtDMY(f);
  if (sameYear) return `${fmtDM(f)} – ${fmtDM(t)} ${t.getFullYear()}`;
  return `${fmtDMY(f)} – ${fmtDMY(t)}`;
}

// ── Bucket-aware utilities for timeline charts ─────────────

/** Convert a server-returned bucket string ("1 hour", "15 minutes", …) to milliseconds. */
export function bucketStepMs(bucket) {
  if (!bucket) return 3600_000;
  const num = parseInt(bucket, 10) || 1;
  if (bucket.includes('minute')) return num * 60_000;
  if (bucket.includes('hour'))   return num * 3_600_000;
  if (bucket.includes('day'))    return num * 86_400_000;
  if (bucket.includes('week'))   return num * 7 * 86_400_000;
  return 3_600_000;
}

/**
 * Format a single bucket for the chart x-axis.
 *  - sub-day buckets show "DD MMM HH:mm"
 *  - day-or-larger buckets show "DD MMM"
 */
export function fmtBucketTick(ts, bucket) {
  const d = new Date(ts);
  const subDay = bucket && (bucket.includes('minute') || bucket.includes('hour'));
  return d.toLocaleString('en-GB', subDay
    ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short' });
}

/**
 * Fill in missing buckets in a server time-series so the chart
 * has every expected x-axis tick (zero where there were no readings).
 *
 *   rawSeries  — [{ bucket: ISO-string, kwh: number }] from the API
 *   fromIso    — start date (inclusive, "YYYY-MM-DD" or ISO)
 *   toIso      — end date   (inclusive, "YYYY-MM-DD" or ISO)
 *   bucket     — server's chosen bucket string (e.g. "1 hour")
 *
 * Returns [{ ts, t, kWh }] where `ts` is the bucket-start in ms,
 * `t` is the formatted x-axis label, and `kWh` is the value.
 */
export function fillBuckets(rawSeries = [], fromIso, toIso, bucket) {
  const step = bucketStepMs(bucket);
  if (!step) return [];

  // Index existing readings by their bucket-start timestamp
  const map = new Map();
  for (const r of rawSeries) {
    const ts = new Date(r.bucket).getTime();
    if (!isNaN(ts)) map.set(ts, Number(r.kwh));
  }

  // Anchor the iteration to the first server bucket if available so
  // alignment matches Postgres/Timescale time_bucket exactly.
  let firstTs = Infinity;
  for (const ts of map.keys()) if (ts < firstTs) firstTs = ts;

  const fromDate = new Date(fromIso);
  const toDate   = new Date(toIso);
  // Span must include the entire `to` day so single-day ranges still work.
  const fromTs = isNaN(fromDate) ? Date.now() - 86_400_000 : new Date(fromDate).setHours(0, 0, 0, 0);
  const toTs   = isNaN(toDate)   ? Date.now() : new Date(toDate).setHours(23, 59, 59, 999);

  // Anchor: align to the first server bucket if one exists, else align to step
  // grid that contains fromTs.
  let anchor;
  if (firstTs !== Infinity) {
    anchor = firstTs;
    while (anchor - step >= fromTs) anchor -= step;
  } else {
    anchor = Math.floor(fromTs / step) * step;
  }

  const out = [];
  for (let t = anchor; t <= toTs; t += step) {
    out.push({
      ts: t,
      t:  fmtBucketTick(t, bucket),
      kWh: Number((map.get(t) || 0).toFixed(3)),
    });
  }
  return out;
}

// ── Date-range helpers ─────────────────────────────────────
const isoDay = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function currentMonthRange() {
  const now = new Date();
  return {
    from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)),
    to:   isoDay(now), // up to today (cleaner than month-end-in-future)
  };
}

export function lastNDaysRange(n) {
  const to = new Date();
  const from = new Date(to.getTime() - (n - 1) * 86_400_000);
  return { from: isoDay(from), to: isoDay(to) };
}

export function todayRange() {
  const t = isoDay(new Date());
  return { from: t, to: t };
}
