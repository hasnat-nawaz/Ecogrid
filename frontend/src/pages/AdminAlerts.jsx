import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { useLiveStream } from '../hooks/useLiveStream';
import { dateTime } from '../lib/format';

const SEV_ICON = { critical: '🛑', warning: '⚠', info: 'ℹ' };

export default function AdminAlerts() {
  const nav = useNavigate();
  const [severity, setSeverity] = useState('');
  const [meterId, setMeterId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [meterSearch, setMeterSearch] = useState('');

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (severity) sp.set('severity', severity);
    if (meterId)  sp.set('meter_id', meterId);
    if (from)     sp.set('from', from);
    if (to)       sp.set('to', to);
    return sp.toString();
  }, [severity, meterId, from, to]);

  const { data, loading, refresh } = usePoll(() => api(`/api/admin/alerts?${qs}`), 3000, [qs]);
  const rows = data?.alerts || [];
  const { last } = useLiveStream();

  // refresh on push from server
  useEffect(() => {
    if (last?.type === 'ecogrid_alert') refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  function searchMeter(e) {
    e.preventDefault();
    setMeterId(meterSearch.trim());
  }

  return (
    <Layout>
      <div className="page-head fade-in">
        <div>
          <div className="eyebrow">Admin · Live monitoring</div>
          <h2>Load Alerts</h2>
        </div>
        <span className="range-pill">
          <span className="live-dot" />
          <strong>Live</strong>&nbsp;auto-refresh 3s
        </span>
      </div>

      {/* Filter chips */}
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <h3 className="subtitle">Filter by severity</h3>
        <div className="chips">
          {[
            ['', 'All'],
            ['critical', 'Critical (Meter)'],
            ['warning',  'Warning (Meter)'],
            ['info',     'System / Info'],
          ].map(([s, label]) => (
            <span key={s || 'all'} className={`chip ${severity === s ? 'active' : ''}`}
                  onClick={() => setSeverity(s)}>{label}</span>
          ))}
        </div>
        <div className="grid-3" style={{ marginTop: 14 }}>
          <div>
            <label>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label>Meter ID</label>
            <input value={meterId} onChange={(e) => setMeterId(e.target.value)} placeholder="e.g. 1" />
          </div>
        </div>
      </div>

      <form onSubmit={searchMeter} className="card" style={{ marginBottom: 18, padding: 14 }}>
        <div className="search-bar">
          <span style={{ color: 'var(--muted)' }}>🔍</span>
          <input value={meterSearch} onChange={(e) => setMeterSearch(e.target.value)}
                 placeholder="Search alerts for a specific meter ID…" />
          <button className="small">Filter</button>
          {(meterId || from || to || severity) && (
            <button type="button" className="ghost small"
                    onClick={() => { setSeverity(''); setMeterId(''); setFrom(''); setTo(''); setMeterSearch(''); }}>
              Reset
            </button>
          )}
        </div>
      </form>

      {loading && !data ? <Loader label="Pulling alerts…" /> : (
        rows.length === 0 ? (
          <div className="card empty">
            <div className="ico">✅</div>
            <h3>No alerts</h3>
            <p>The grid is healthy. New alerts will appear here automatically.</p>
          </div>
        ) : (
          <div className="grid-cards fade-in" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            {rows.map((a) => (
              <div key={a.alert_id} className="card lift clickable"
                   onClick={() => nav(`/admin/alerts/${a.alert_id}`)}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{SEV_ICON[a.severity] || '⚠'}</span>
                    <span className={`badge ${a.severity}`}>{a.severity}</span>
                  </div>
                  <span className="muted text-sm">{dateTime(a.ts)}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  {a.severity === 'info' ? 'System Alert' : `Meter Alert — #${a.meter_id}`}
                </h3>
                <p className="muted" style={{ marginTop: 6 }}>{a.message}</p>
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="small">View Details</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Layout>
  );
}
