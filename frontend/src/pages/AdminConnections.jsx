import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { kwh, shortDate, dateTime } from '../lib/format';

export default function AdminConnections() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const { data, loading } = usePoll(
    () => api(`/api/admin/connections${search ? `?q=${encodeURIComponent(search)}` : ''}`),
    3000,
    [search]
  );
  const rows = data?.connections || [];

  function submit(e) { e.preventDefault(); setSearch(q.trim()); }

  return (
    <Layout>
      <div className="page-head fade-in">
        <div>
          <div className="eyebrow">Admin · Network</div>
          <h2>Connections &amp; Meters</h2>
        </div>
        <span className="range-pill"><strong>{rows.length}</strong>&nbsp;active cards</span>
      </div>

      <form onSubmit={submit} className="card" style={{ padding: 14, marginBottom: 18 }}>
        <div className="search-bar">
          <span style={{ color: 'var(--muted)' }}>🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Search by consumer name, consumer ID, email, or meter serial…" />
          <button className="small">Search</button>
          {search && <button type="button" className="ghost small" onClick={() => { setQ(''); setSearch(''); }}>Clear</button>}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Tip: type a consumer ID to find every meter assigned to that consumer.
        </p>
      </form>

      {loading && !data ? <Loader label="Loading connections…" /> : (
        <div className="grid-cards fade-in" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
          {rows.map((cn) => (
            <div key={cn.connection_id} className="card lift big-card">
              <div className="head">
                <div>
                  <div className="title">{cn.serial_no}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Meter #{cn.meter_id} · Connection #{cn.connection_id}
                  </div>
                </div>
                <span className={`badge ${cn.status}`}>{cn.status}</span>
              </div>

              <div className="row-info">
                <div><div className="k">Consumer</div><div className="v">{cn.consumer_name}</div></div>
                <div><div className="k">Consumer ID</div><div className="v">#{cn.consumer_id}</div></div>
                <div><div className="k">Email</div><div className="v">{cn.consumer_email}</div></div>
                <div><div className="k">Phone</div><div className="v">{cn.phone || '—'}</div></div>
                <div><div className="k">Region</div><div className="v">{cn.region_name || '—'}</div></div>
                <div><div className="k">Sub-Region</div><div className="v">{cn.parent_region_name || '—'}</div></div>
                <div><div className="k">Installed</div><div className="v">{shortDate(cn.installation_date)}</div></div>
                <div><div className="k">Active Since</div><div className="v">{shortDate(cn.start_date)}</div></div>
                <div><div className="k">Address</div><div className="v">{cn.street || '—'}, {cn.city || '—'}</div></div>
                <div><div className="k">Last Reading</div><div className="v">{cn.last_reading_ts ? dateTime(cn.last_reading_ts) : 'No data'}</div></div>
                <div><div className="k">Usage (30d)</div><div className="v">{kwh(cn.kwh_30d, 1)}</div></div>
                <div><div className="k">Status</div><div className="v" style={{ textTransform: 'capitalize' }}>{cn.status}</div></div>
              </div>

              <div className="actions">
                <button className="small"
                        onClick={() => nav(`/admin/consumption?meter_id=${cn.meter_id}`)}>
                  View Consumption
                </button>
                <button className="ghost small"
                        onClick={() => nav(`/admin/consumers/${cn.consumer_id}`)}>
                  Open Consumer
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="empty">
              <div className="ico">⌬</div>
              <p>No connections found.</p>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
