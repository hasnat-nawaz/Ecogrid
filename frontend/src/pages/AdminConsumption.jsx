import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceArea,
} from 'recharts';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { kwh, rangeLabel, fillBuckets, currentMonthRange, lastNDaysRange, todayRange } from '../lib/format';

// Pakistan grid evening peak window — also where most residential demand spikes.
const PEAK_START = 18;
const PEAK_END   = 22;
const isPeakHour = (h) => h >= PEAK_START && h <= PEAK_END;

export default function AdminConsumption() {
  const [params, setParams] = useSearchParams();
  const initialMeter = params.get('meter_id') || '';

  // Default = current month, so the page is informative on first load.
  const def = currentMonthRange();
  const [dFrom, setDFrom] = useState(def.from);
  const [dTo, setDTo] = useState(def.to);
  const [dRegion, setDRegion] = useState('');
  const [dSubRegion, setDSubRegion] = useState('');
  const [dMeter, setDMeter] = useState(initialMeter);

  const [filters, setFilters] = useState({
    from: def.from, to: def.to, region_id: '', subregion_id: '', meter_id: initialMeter,
  });

  const [meterSearch, setMeterSearch] = useState('');
  const [meterError, setMeterError] = useState('');

  const rangeError = useMemo(() => {
    if (!dFrom || !dTo) return '';
    return new Date(dTo) < new Date(dFrom) ? '“To” cannot be before “From”.' : '';
  }, [dFrom, dTo]);

  const { data: regionData } = usePoll(() => api('/api/admin/regions'), 60000);
  const regions = regionData?.regions || [];
  const parentRegions = regions.filter((r) => !r.parent_region_id);
  const subRegions = useMemo(
    () => regions.filter((r) => dRegion && r.parent_region_id === Number(dRegion)),
    [regions, dRegion]
  );

  const qs = useMemo(() => {
    const sp = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.region_id)    sp.set('region_id',    filters.region_id);
    if (filters.subregion_id) sp.set('subregion_id', filters.subregion_id);
    if (filters.meter_id)     sp.set('meter_id',     filters.meter_id);
    return sp.toString();
  }, [filters]);

  const { data, loading } = usePoll(() => api(`/api/admin/consumption?${qs}`), 3000, [qs]);

  useEffect(() => {
    const sp = new URLSearchParams(params);
    if (filters.meter_id) sp.set('meter_id', filters.meter_id); else sp.delete('meter_id');
    setParams(sp, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.meter_id]);

  function applyFilters() {
    if (rangeError) return;
    setFilters({
      from: dFrom, to: dTo,
      region_id: dRegion, subregion_id: dSubRegion,
      meter_id: dMeter,
    });
  }
  function resetFilters() {
    const d = currentMonthRange();
    setDFrom(d.from); setDTo(d.to);
    setDRegion(''); setDSubRegion(''); setDMeter('');
    setFilters({ from: d.from, to: d.to, region_id: '', subregion_id: '', meter_id: '' });
  }
  function applyQuickRange(r) {
    setDFrom(r.from); setDTo(r.to);
    setFilters((f) => ({ ...f, from: r.from, to: r.to }));
  }

  async function searchMeter(e) {
    e.preventDefault();
    setMeterError('');
    const term = meterSearch.trim();
    if (!term) return;
    try {
      const isId = /^\d+$/.test(term);
      const path = isId
        ? `/api/admin/consumption/meter/search?id=${encodeURIComponent(term)}`
        : `/api/admin/consumption/meter/search?serial=${encodeURIComponent(term)}`;
      const x = await api(path);
      const url = `/admin/consumption?meter_id=${x.meter.meter_id}`;
      window.open(url, '_blank');
    } catch (err) {
      setMeterError(err.message || 'Meter not found');
    }
  }

  const bucketName = data?.bucket || '1 hour';
  const series = fillBuckets(data?.series || [], filters.from, filters.to, bucketName);
  const peaks = (data?.peaks || []).map((p) => ({
    hour: `${String(p.hour).padStart(2, '0')}:00`,
    hourNum: Number(p.hour),
    kWh: Number(p.kwh),
    isPeak: isPeakHour(Number(p.hour)),
  }));
  const totals = data?.totals || {};

  const sortedPeaks = [...peaks].filter((p) => p.kWh > 0).sort((a, b) => b.kWh - a.kWh);
  const peakHour = sortedPeaks[0];
  const lowHour  = sortedPeaks[sortedPeaks.length - 1];

  const isDirty =
    dFrom !== filters.from || dTo !== filters.to ||
    dRegion !== filters.region_id || dSubRegion !== filters.subregion_id ||
    dMeter !== filters.meter_id;

  return (
    <Layout>
      <div className="page-head fade-in">
        <div>
          <div className="eyebrow">Analytics</div>
          <h2>Consumption</h2>
        </div>
        <span className="range-pill">
          <span className="dot" />
          <strong>Showing</strong> {rangeLabel(filters.from, filters.to)} · {bucketName} buckets
        </span>
      </div>

      {/* ── Filters ── */}
      <div className="card fade-in" style={{ marginBottom: 18 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 className="subtitle" style={{ margin: 0 }}>Filters</h3>
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
            <label>Meter ID (optional)</label>
            <input value={dMeter} onChange={(e) => setDMeter(e.target.value)} placeholder="e.g. 1" />
          </div>
          <div>
            <label>Region</label>
            <select value={dRegion} onChange={(e) => { setDRegion(e.target.value); setDSubRegion(''); }}>
              <option value="">All regions</option>
              {parentRegions.map((r) => <option key={r.region_id} value={r.region_id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label>Sub-Region</label>
            <select value={dSubRegion} onChange={(e) => setDSubRegion(e.target.value)}
                    disabled={!dRegion || subRegions.length === 0}>
              <option value="">All sub-regions</option>
              {subRegions.map((r) => <option key={r.region_id} value={r.region_id}>{r.name}</option>)}
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

      {/* ── Meter search ── */}
      <form onSubmit={searchMeter} className="card" style={{ marginBottom: 18, padding: 14 }}>
        <h3 className="subtitle">Search specific meter</h3>
        <div className="search-bar">
          <span style={{ color: 'var(--muted)' }}>🔍</span>
          <input value={meterSearch} onChange={(e) => setMeterSearch(e.target.value)}
                 placeholder="Enter meter ID (e.g. 1) or serial (e.g. MTR-0001)…" />
          <button className="small">Open in new tab</button>
        </div>
        {meterError && <p className="error" style={{ marginTop: 8 }}>{meterError}</p>}
      </form>

      {/* ── Stats strip ── */}
      <div className="stat-strip" style={{ marginBottom: 18 }}>
        <div className="card stat">
          <div className="label">Total Consumption</div>
          <div className="value">{kwh(totals.total_kwh, 1)}</div>
        </div>
        <div className="card stat">
          <div className="label">Avg per Reading</div>
          <div className="value">{kwh(totals.avg_kwh, 3)}</div>
        </div>
        <div className="card stat">
          <div className="label">Peak hour</div>
          <div className="value" style={{ color: 'var(--warn)' }}>
            {peakHour ? `${peakHour.hour} · ${peakHour.kWh.toFixed(1)} kWh` : '—'}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Lowest hour</div>
          <div className="value" style={{ color: 'var(--info)' }}>
            {lowHour ? `${lowHour.hour} · ${lowHour.kWh.toFixed(1)} kWh` : '—'}
          </div>
        </div>
      </div>

      {loading && !data ? <Loader label="Crunching meter data…" /> : (
        <>
          {/* ── Consumption over time ── */}
          <div className="card fade-in" style={{ marginBottom: 18 }}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="subtitle" style={{ margin: 0 }}>Consumption over time</h3>
                <span className="muted text-sm">{rangeLabel(filters.from, filters.to)} · {bucketName} buckets</span>
              </div>
              <span className="range-pill">
                <strong>Total</strong> {kwh(totals.total_kwh || 0, 1)}
              </span>
            </div>

            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor="#2f6fd8" stopOpacity={0.40} />
                      <stop offset="100%" stopColor="#2f6fd8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(34,51,84,0.10)" strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke="#8c98b3" fontSize={11} minTickGap={28} />
                  <YAxis stroke="#8c98b3" fontSize={11} allowDecimals />
                  <Tooltip formatter={(v) => kwh(v, 3)} />
                  <Area type="monotone" dataKey="kWh" stroke="#2f6fd8" strokeWidth={2.4}
                        fill="url(#adminGrad)" dot={{ r: 2.5, fill: '#2f6fd8' }}
                        activeDot={{ r: 5, fill: '#1a5bbf' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {series.every((p) => p.kWh === 0) && (
              <p className="muted" style={{ marginTop: 6 }}>
                No metered consumption in this period — the timeline is shown for the full range so
                gaps remain visible.
              </p>
            )}
          </div>

          {/* ── Peak / Off-Peak ── */}
          <div className="card fade-in">
            <div className="row between" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="subtitle" style={{ margin: 0 }}>Peak vs off-peak hours</h3>
                <span className="muted text-sm">
                  Peak window {String(PEAK_START).padStart(2,'0')}:00–{String(PEAK_END).padStart(2,'0')}:59 · {rangeLabel(filters.from, filters.to)}
                </span>
              </div>
              <div className="chart-legend">
                <span className="item"><span className="swatch" style={{ background: '#2f6fd8' }} />Off-peak</span>
                <span className="item"><span className="swatch" style={{ background: '#f5c93a' }} />Peak (18:00–22:59)</span>
              </div>
            </div>

            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={peaks} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(34,51,84,0.10)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour" stroke="#8c98b3" fontSize={11} interval={1}
                    tick={({ x, y, payload }) => {
                      const h = parseInt(payload.value, 10);
                      const peak = isPeakHour(h);
                      return (
                        <g transform={`translate(${x},${y + 12})`}>
                          <text textAnchor="middle"
                                fontSize={11}
                                fontWeight={peak ? 700 : 400}
                                fill={peak ? '#a07b1a' : '#8c98b3'}>
                            {payload.value}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <YAxis stroke="#8c98b3" fontSize={11} />
                  <Tooltip
                    formatter={(v) => kwh(v, 3)}
                    labelFormatter={(label, items) => {
                      const h = parseInt(label, 10);
                      return `${label} · ${isPeakHour(h) ? 'Peak hour' : 'Off-peak'}`;
                    }}
                  />
                  {/* Highlight peak window with a translucent band */}
                  <ReferenceArea
                    x1={`${String(PEAK_START).padStart(2,'0')}:00`}
                    x2={`${String(PEAK_END).padStart(2,'0')}:00`}
                    y1={0}
                    fill="#f5c93a" fillOpacity={0.10}
                    stroke="#f5c93a" strokeOpacity={0.4}
                    strokeDasharray="4 3"
                  />
                  <Bar dataKey="kWh" radius={[8, 8, 0, 0]}>
                    {peaks.map((p, i) => (
                      <Cell key={i} fill={p.isPeak ? '#f5c93a' : '#4d8df0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="muted text-sm" style={{ marginTop: 10 }}>
              Tip: peak hours typically reflect evening residential load. Demand outside this window
              is generally cheaper to serve and easier to balance on the grid.
            </p>

            {peaks.every((p) => p.kWh === 0) && (
              <p className="muted" style={{ marginTop: 6 }}>No data for this period.</p>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
