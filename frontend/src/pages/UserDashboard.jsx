import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { kwh, rangeLabel, fillBuckets, currentMonthRange, lastNDaysRange, todayRange } from '../lib/format';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

export default function UserDashboard() {
  const nav = useNavigate();
  const { data: me, loading: l1 } = usePoll(() => api('/api/user/me'), 5000);

  // ── Default to current month (1st → today) ──
  const def = currentMonthRange();
  const [dFrom,  setDFrom]  = useState(def.from);
  const [dTo,    setDTo]    = useState(def.to);
  const [dMeter, setDMeter] = useState('');
  const [filters, setFilters] = useState({ from: def.from, to: def.to, meter_id: '' });

  // Validate range live so the user sees the issue before submit
  const rangeError = useMemo(() => {
    if (!dFrom || !dTo) return '';
    return new Date(dTo) < new Date(dFrom) ? '“To” cannot be before “From”.' : '';
  }, [dFrom, dTo]);

  const qs = useMemo(() => {
    const sp = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.meter_id) sp.set('meter_id', filters.meter_id);
    return sp.toString();
  }, [filters]);

  const { data: cons, loading: l2 } = usePoll(() => api(`/api/user/consumption?${qs}`), 3000, [qs]);

  const isDirty =
    dFrom !== filters.from || dTo !== filters.to || dMeter !== filters.meter_id;

  function applyFilters() {
    if (rangeError) return;
    setFilters({ from: dFrom, to: dTo, meter_id: dMeter });
  }
  function resetFilters() {
    const d = currentMonthRange();
    setDFrom(d.from); setDTo(d.to); setDMeter('');
    setFilters({ from: d.from, to: d.to, meter_id: '' });
  }
  function applyQuickRange(r) {
    setDFrom(r.from); setDTo(r.to);
    setFilters((f) => ({ ...f, from: r.from, to: r.to }));
  }

  if (l1 && !me) return <Layout><Loader label="Loading your dashboard…" /></Layout>;

  const bucketName = cons?.bucket || '15 minutes';
  // Fill in zeros for missing buckets so the x-axis reflects the *whole* range
  // — even when there were no readings on intermediate days.
  const series = fillBuckets(cons?.series || [], filters.from, filters.to, bucketName);
  const total = series.reduce((s, p) => s + p.kWh, 0);

  return (
    <Layout>
      <div className="page-head fade-in">
        <div>
          <div className="eyebrow">Personal dashboard</div>
          <h2>My Usage</h2>
        </div>
        <span className="range-pill">
          <span className="dot" />
          <strong>Showing</strong> {rangeLabel(filters.from, filters.to)}
        </span>
      </div>

      <div className="grid-cards" style={{ marginTop: 4 }}>
        <div className="card lift kpi-card clickable" onClick={() => nav('/profile')} title="View your profile">
          <div className="icon">👤</div>
          <div className="label">Account</div>
          <div className="value" style={{ fontSize: 20 }}>{me?.consumer?.name || '—'}</div>
          <div className="sub">{me?.consumer?.email}</div>
          <div className="sub" style={{ color: 'var(--primary)', marginTop: 2 }}>View profile →</div>
        </div>
        <div className="card lift kpi-card clickable" onClick={() => nav('/meters')} title="View your meters">
          <div className="icon">⌬</div>
          <div className="label">Meters</div>
          <div className="value">{me?.connections?.length ?? 0}</div>
          <div className="sub">{me?.connections?.map((c) => c.serial_no).join(', ') || 'None linked'}</div>
          <div className="sub" style={{ color: 'var(--primary)', marginTop: 2 }}>View details →</div>
        </div>
        <div className="card lift kpi-card">
          <div className="icon">⚡</div>
          <div className="label">Total this period</div>
          <div className="value">{kwh(total, 1)}</div>
          <div className="sub">Bucket · {bucketName}</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card fade-in" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 className="subtitle" style={{ margin: 0 }}>Filter consumption</h3>
          <div className="quick-ranges">
            <span className="chip" onClick={() => applyQuickRange(todayRange())}>Today</span>
            <span className="chip" onClick={() => applyQuickRange(lastNDaysRange(7))}>Last 7 days</span>
            <span className="chip" onClick={() => applyQuickRange(lastNDaysRange(30))}>Last 30 days</span>
            <span className="chip" onClick={() => applyQuickRange(currentMonthRange())}>This month</span>
          </div>
        </div>

        <div className="grid-3" style={{ alignItems: 'end' }}>
          <div>
            <label>From</label>
            <input type="date" value={dFrom} max={dTo || undefined}
                   onChange={(e) => setDFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={dTo} min={dFrom || undefined}
                   onChange={(e) => setDTo(e.target.value)} />
          </div>
          <div>
            <label>Meter</label>
            <select value={dMeter} onChange={(e) => setDMeter(e.target.value)}>
              <option value="">All my meters</option>
              {(me?.connections || []).map((c) => (
                <option key={c.meter_id} value={c.meter_id}>
                  {c.serial_no} (#{c.meter_id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {rangeError && <p className="error" style={{ marginTop: 12 }}>{rangeError}</p>}

        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button onClick={applyFilters} disabled={!isDirty || !!rangeError}>Apply Filters</button>
          <button type="button" className="ghost" onClick={resetFilters}>Reset</button>
          {isDirty && !rangeError && (
            <span className="muted" style={{ marginLeft: 8 }}>
              Unapplied changes — click <strong>Apply Filters</strong>.
            </span>
          )}
        </div>
      </div>

      {/* ── Range chart ── */}
      <div className="card fade-in">
        <div className="row between" style={{ marginBottom: 12 }}>
          <div>
            <h3 className="subtitle" style={{ margin: 0 }}>Consumption over time</h3>
            <span className="muted text-sm">{rangeLabel(filters.from, filters.to)} · {bucketName} buckets</span>
          </div>
          <span className="range-pill">
            <strong>Total</strong> {kwh(total, 1)}
          </span>
        </div>

        <div style={{ width: '100%', height: 320 }}>
          {l2 && !cons ? <Loader label="Loading chart…" /> : (
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#2f6fd8" stopOpacity={0.40} />
                    <stop offset="100%" stopColor="#2f6fd8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(34,51,84,0.10)" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="#8c98b3" fontSize={11} minTickGap={28} />
                <YAxis stroke="#8c98b3" fontSize={11} allowDecimals />
                <Tooltip formatter={(v) => kwh(v, 3)} />
                <Area type="monotone" dataKey="kWh" stroke="#2f6fd8" strokeWidth={2.4}
                      fill="url(#rangeGrad)" dot={{ r: 2.5, fill: '#2f6fd8' }}
                      activeDot={{ r: 5, fill: '#1a5bbf' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {series.length > 0 && total === 0 && (
          <p className="muted" style={{ marginTop: 8 }}>
            No metered consumption in this period — the timeline is intentionally
            shown so you can see the full range you selected.
          </p>
        )}
      </div>
    </Layout>
  );
}
