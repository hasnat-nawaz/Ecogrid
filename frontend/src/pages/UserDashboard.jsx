import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { useLiveStream } from '../hooks/useLiveStream';
import { usePoll } from '../hooks/usePoll';
import { kwh } from '../lib/format';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const LIVE_WINDOW_SECONDS = 60;          // how many seconds of history to keep on the live chart
const FRESH_READING_MS    = 2500;        // a reading is considered "fresh" if seen in the last 2.5s

// Fill the live buffer with zero-points so the line is visible from the very
// first render — otherwise an empty array gives an empty chart for ~60s.
function buildInitialLive() {
  const now = Date.now();
  const out = [];
  for (let i = LIVE_WINDOW_SECONDS - 1; i >= 0; i--) {
    const t = new Date(now - i * 1000).toLocaleTimeString('en-GB', { hour12: false });
    out.push({ t, kWh: 0 });
  }
  return out;
}

// Default range = first day of current month → last day of current month.
function defaultRange() {
  const now  = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0); // day 0 of next month = last day of this
  const iso  = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function fmtBucket(iso, bucket) {
  const d = new Date(iso);
  const opts =
    bucket?.includes('minute') ? { hour: '2-digit', minute: '2-digit' } :
    bucket?.includes('hour')   ? { day: '2-digit', month: 'short', hour: '2-digit' } :
                                 { day: '2-digit', month: 'short' };
  return d.toLocaleString('en-GB', opts);
}

export default function UserDashboard() {
  const nav = useNavigate();
  const { data: me, loading: l1 } = usePoll(() => api('/api/user/me'), 5000);

  // ── Draft + applied filters ──
  const def = defaultRange();
  const [dFrom,  setDFrom]  = useState(def.from);
  const [dTo,    setDTo]    = useState(def.to);
  const [dMeter, setDMeter] = useState('');
  const [filters, setFilters] = useState({ from: def.from, to: def.to, meter_id: '' });

  const qs = useMemo(() => {
    const sp = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.meter_id) sp.set('meter_id', filters.meter_id);
    return sp.toString();
  }, [filters]);

  const { data: cons, loading: l2 } = usePoll(() => api(`/api/user/consumption?${qs}`), 3000, [qs]);

  // ── Live chart (1-second tick, scrolls left, flat-line at 0 if no sim) ──
  const [live, setLive] = useState(buildInitialLive);
  const { last, connected } = useLiveStream();
  const myMeterIds = useMemo(() => new Set((me?.connections || []).map((c) => c.meter_id)), [me]);

  // Latest reading we've seen, kept in a ref so the ticker can read it without re-rendering.
  const latestReadingRef = useRef({ kWh: 0, at: 0 });
  useEffect(() => {
    if (last?.type === 'ecogrid_reading' && myMeterIds.has(last.payload.meter_id)) {
      latestReadingRef.current = {
        kWh: Number(last.payload.energy_consumed),
        at:  Date.now(),
      };
    }
  }, [last, myMeterIds]);

  // 1-second ticker: append a new point each tick, drop the oldest. If no
  // fresh reading → push 0 so the line flat-lines at zero.
  useEffect(() => {
    const id = setInterval(() => {
      const now   = Date.now();
      const fresh = now - latestReadingRef.current.at < FRESH_READING_MS;
      const kWh   = fresh ? latestReadingRef.current.kWh : 0;
      const t     = new Date(now).toLocaleTimeString('en-GB', { hour12: false });
      setLive((arr) => {
        const next = arr.length >= LIVE_WINDOW_SECONDS ? arr.slice(1) : arr.slice();
        next.push({ t, kWh });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const isDirty = dFrom !== filters.from || dTo !== filters.to || dMeter !== filters.meter_id;

  function applyFilters() {
    setFilters({ from: dFrom, to: dTo, meter_id: dMeter });
  }
  function resetFilters() {
    const d = defaultRange();
    setDFrom(d.from); setDTo(d.to); setDMeter('');
    setFilters({ from: d.from, to: d.to, meter_id: '' });
  }

  if (l1 && !me) return <Layout><Loader label="Loading your dashboard…" /></Layout>;

  const bucketName = cons?.bucket || '15 minutes';
  const series = (cons?.series || []).map(r => ({
    t: fmtBucket(r.bucket, bucketName),
    kWh: Number(r.kwh),
  }));
  const total = series.reduce((s, p) => s + p.kWh, 0);
  const isStreaming = connected && Date.now() - latestReadingRef.current.at < FRESH_READING_MS;

  return (
    <Layout>
      <div className="row between">
        <h2 className="section-title" style={{ margin: 0 }}>My Usage</h2>
        <div className="row">
          <span className="live-dot" style={{ background: connected ? 'var(--ok)' : 'var(--danger)' }} />
          <span className="muted">{connected ? 'live stream' : 'reconnecting…'}</span>
        </div>
      </div>

      <div className="grid-cards" style={{ marginTop: 16 }}>
        <div className="card lift kpi-card clickable" onClick={() => nav('/profile')}
             title="View your profile">
          <div className="icon">👤</div>
          <div className="label">Account</div>
          <div className="value" style={{ fontSize: 18 }}>{me?.consumer?.name || '—'}</div>
          <div className="sub">{me?.consumer?.email}</div>
          <div className="sub" style={{ color: 'var(--primary)', marginTop: 4 }}>View profile →</div>
        </div>
        <div className="card lift kpi-card clickable" onClick={() => nav('/meters')}
             title="View your meters">
          <div className="icon">⌬</div>
          <div className="label">Meters</div>
          <div className="value">{me?.connections?.length ?? 0}</div>
          <div className="sub">{me?.connections?.map((c) => c.serial_no).join(', ') || 'None linked'}</div>
          <div className="sub" style={{ color: 'var(--primary)', marginTop: 4 }}>View details →</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card fade-in" style={{ marginBottom: 16 }}>
        <h3 className="subtitle">Filter Consumption</h3>
        <div className="grid-3" style={{ alignItems: 'end' }}>
          <div>
            <label>From</label>
            <input type="date" value={dFrom} onChange={(e) => setDFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={dTo} onChange={(e) => setDTo(e.target.value)} />
          </div>
          <div>
            <label>Meter</label>
            <select value={dMeter} onChange={(e) => setDMeter(e.target.value)}>
              <option value="">All my meters</option>
              {(me?.connections || []).map(c => (
                <option key={c.meter_id} value={c.meter_id}>
                  {c.serial_no} (#{c.meter_id})
                </option>
              ))}
            </select>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button onClick={applyFilters} disabled={!isDirty}>Apply Filters</button>
            <button type="button" className="ghost" onClick={resetFilters}>Reset</button>
          </div>
        </div>
        {isDirty && <p className="muted" style={{ marginTop: 10 }}>Unapplied changes — click <strong>Apply Filters</strong>.</p>}
      </div>

      {/* Live chart */}
      <div className="card fade-in" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3 className="subtitle" style={{ margin: 0 }}>Live Consumption (last {LIVE_WINDOW_SECONDS}s)</h3>
          <span className="muted text-sm">
            {connected
              ? (isStreaming ? 'streaming' : 'no readings — flat-lined at 0')
              : 'offline'}
          </span>
        </div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={live} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1f3566" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#8fa2cf" fontSize={10} minTickGap={30}
                     label={{ value: 'time', position: 'insideBottomRight', offset: -2, fill: '#8fa2cf', fontSize: 11 }} />
              {/* Clamp the y-axis to a minimum visible range so a flat-zero line stays on screen. */}
              <YAxis stroke="#8fa2cf" fontSize={11}
                     domain={[0, (dataMax) => Math.max(Number(dataMax) * 1.2, 1)]}
                     allowDecimals
                     label={{ value: 'kWh', angle: -90, position: 'insideLeft', fill: '#8fa2cf', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f1d3d', border: '1px solid #1f3566' }} />
              <Line type="monotone" dataKey="kWh" stroke="#3fa9f5" strokeWidth={2}
                    dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card fade-in">
        <h3 className="subtitle">
          Consumption ({filters.from} → {filters.to}) · Total {kwh(total, 1)} · Bucket {bucketName}
        </h3>
        <div style={{ width: '100%', height: 280 }}>
          {l2 && !cons ? <Loader label="Loading chart…" /> : (
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid stroke="#1f3566" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="#8fa2cf" fontSize={11} minTickGap={20} />
                <YAxis stroke="#8fa2cf" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0f1d3d', border: '1px solid #1f3566' }} />
                <Line type="monotone" dataKey="kWh" stroke="#5fbcff" strokeWidth={2}
                      dot={{ r: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {series.length === 0 && !l2 && <p className="muted">No readings in this range.</p>}
      </div>
    </Layout>
  );
}
