import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { kwh } from '../lib/format';

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 3600 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

// Pick a nice x-axis label based on the bucket size the server picked.
function fmtBucket(iso, bucket) {
  const d = new Date(iso);
  const opts =
    bucket.includes('minute')                        ? { hour: '2-digit', minute: '2-digit' } :
    bucket.includes('hour') && !bucket.startsWith('4') ? { day: '2-digit', month: 'short', hour: '2-digit' } :
    bucket.includes('hour')                          ? { day: '2-digit', month: 'short', hour: '2-digit' } :
    bucket.includes('day')                           ? { day: '2-digit', month: 'short' } :
                                                        { day: '2-digit', month: 'short' };
  return d.toLocaleString('en-GB', opts);
}

export default function AdminConsumption() {
  const [params, setParams] = useSearchParams();
  const initialMeter = params.get('meter_id') || '';

  // ── Draft filter state — only committed when "Apply Filters" is pressed ──
  const def = defaultRange();
  const [dFrom, setDFrom] = useState(def.from);
  const [dTo, setDTo] = useState(def.to);
  const [dRegion, setDRegion] = useState('');
  const [dSubRegion, setDSubRegion] = useState('');
  const [dMeter, setDMeter] = useState(initialMeter);

  // ── Applied filters (what the API actually sees) ──
  const [filters, setFilters] = useState({
    from: def.from, to: def.to, region_id: '', subregion_id: '', meter_id: initialMeter,
  });

  const [meterSearch, setMeterSearch] = useState('');
  const [meterError, setMeterError] = useState('');

  const { data: regionData } = usePoll(() => api('/api/admin/regions'), 60000);
  const regions = regionData?.regions || [];
  const parentRegions = regions.filter(r => !r.parent_region_id);
  const subRegions = useMemo(
    () => regions.filter(r => dRegion && r.parent_region_id === Number(dRegion)),
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

  // sync meter id into URL whenever it's applied
  useEffect(() => {
    const sp = new URLSearchParams(params);
    if (filters.meter_id) sp.set('meter_id', filters.meter_id); else sp.delete('meter_id');
    setParams(sp, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.meter_id]);

  function applyFilters() {
    setFilters({
      from: dFrom, to: dTo,
      region_id: dRegion, subregion_id: dSubRegion,
      meter_id: dMeter,
    });
  }
  function resetFilters() {
    const d = defaultRange();
    setDFrom(d.from); setDTo(d.to);
    setDRegion(''); setDSubRegion(''); setDMeter('');
    setFilters({ from: d.from, to: d.to, region_id: '', subregion_id: '', meter_id: '' });
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
  const series = (data?.series || []).map(s => ({
    t: fmtBucket(s.bucket, bucketName),
    kWh: Number(s.kwh),
  }));
  const peaks = (data?.peaks || []).map(p => ({ hour: `${String(p.hour).padStart(2, '0')}:00`, kWh: Number(p.kwh) }));
  const totals = data?.totals || {};

  const sortedPeaks = [...peaks].filter(p => p.kWh > 0).sort((a, b) => b.kWh - a.kWh);
  const peakHour = sortedPeaks[0];
  const lowHour  = sortedPeaks[sortedPeaks.length - 1];

  const isDirty =
    dFrom !== filters.from || dTo !== filters.to ||
    dRegion !== filters.region_id || dSubRegion !== filters.subregion_id ||
    dMeter !== filters.meter_id;

  return (
    <Layout>
      <div className="toolbar">
        <h2 className="section-title" style={{ margin: 0 }}>Consumption Analytics</h2>
        <span className="muted">Bucket: {bucketName} · auto-refresh every 3s</span>
      </div>

      {/* Filters */}
      <div className="card fade-in" style={{ marginBottom: 18 }}>
        <h3 className="subtitle">Filters</h3>
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
            <label>Meter ID (optional)</label>
            <input value={dMeter} onChange={(e) => setDMeter(e.target.value)} placeholder="e.g. 1" />
          </div>
          <div>
            <label>Region</label>
            <select value={dRegion} onChange={(e) => { setDRegion(e.target.value); setDSubRegion(''); }}>
              <option value="">All regions</option>
              {parentRegions.map(r => <option key={r.region_id} value={r.region_id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label>Sub-Region</label>
            <select value={dSubRegion} onChange={(e) => setDSubRegion(e.target.value)}
                    disabled={!dRegion || subRegions.length === 0}>
              <option value="">All sub-regions</option>
              {subRegions.map(r => <option key={r.region_id} value={r.region_id}>{r.name}</option>)}
            </select>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button onClick={applyFilters} disabled={!isDirty}>Apply Filters</button>
            <button type="button" className="ghost" onClick={resetFilters}>Reset</button>
          </div>
        </div>
        {isDirty && <p className="muted" style={{ marginTop: 10 }}>Unapplied changes — click <strong>Apply Filters</strong>.</p>}
      </div>

      {/* Meter search */}
      <form onSubmit={searchMeter} className="card" style={{ marginBottom: 18, padding: 14 }}>
        <h3 className="subtitle">Search Specific Meter</h3>
        <div className="search-bar">
          <span style={{ color: 'var(--muted)' }}>🔍</span>
          <input value={meterSearch} onChange={(e) => setMeterSearch(e.target.value)}
                 placeholder="Enter meter ID (e.g. 1) or serial (e.g. MTR-0001)…" />
          <button className="small">Open in new tab</button>
        </div>
        {meterError && <p className="error" style={{ marginTop: 8 }}>{meterError}</p>}
      </form>

      {/* Stats strip */}
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
          <div className="label">Peak Hour</div>
          <div className="value">{peakHour ? `${peakHour.hour} — ${peakHour.kWh.toFixed(1)} kWh` : '—'}</div>
        </div>
        <div className="card stat">
          <div className="label">Lowest Hour</div>
          <div className="value">{lowHour ? `${lowHour.hour} — ${lowHour.kWh.toFixed(1)} kWh` : '—'}</div>
        </div>
      </div>

      {loading && !data ? <Loader label="Crunching meter data…" /> : (
        <>
          <div className="card fade-in" style={{ marginBottom: 18 }}>
            <h3 className="subtitle">Consumption Over Time ({filters.from} → {filters.to})</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid stroke="#1f3566" strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke="#8fa2cf" fontSize={11} minTickGap={20} />
                  <YAxis stroke="#8fa2cf" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0f1d3d', border: '1px solid #1f3566' }} />
                  <Line type="monotone" dataKey="kWh" stroke="#3fa9f5" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {series.length === 0 && <p className="muted">No readings in the selected period.</p>}
          </div>

          <div className="card fade-in">
            <h3 className="subtitle">Peak vs Off-Peak Hours ({filters.from} → {filters.to})</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={peaks}>
                  <CartesianGrid stroke="#1f3566" strokeDasharray="3 3" />
                  <XAxis dataKey="hour" stroke="#8fa2cf" fontSize={11} interval={0} />
                  <YAxis stroke="#8fa2cf" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0f1d3d', border: '1px solid #1f3566' }} />
                  <Bar dataKey="kWh" fill="#3fa9f5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {peaks.every(p => p.kWh === 0) && <p className="muted">No data for this period.</p>}
          </div>
        </>
      )}
    </Layout>
  );
}
