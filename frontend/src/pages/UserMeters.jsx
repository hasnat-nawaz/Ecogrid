import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { kwh, shortDate, dateTime } from '../lib/format';

function Field({ k, v }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>{k}</div>
      <div style={{ fontWeight: 500, marginTop: 4 }}>{v ?? '—'}</div>
    </div>
  );
}

export default function UserMeters() {
  const nav = useNavigate();
  const { data, loading } = usePoll(() => api('/api/user/me'), 5000);

  if (loading && !data) return <Layout><Loader label="Loading your meters…" /></Layout>;

  const conns = data?.connections ?? [];
  const total30d = conns.reduce((s, c) => s + Number(c.kwh_30d || 0), 0);
  const active   = conns.filter((c) => c.status === 'active').length;

  return (
    <Layout>
      <div className="toolbar">
        <button className="ghost small" onClick={() => nav('/dashboard')}>← Dashboard</button>
        <h2 className="section-title" style={{ margin: 0 }}>My Meters</h2>
        <span className="muted">{conns.length} total · {active} active</span>
      </div>

      <div className="stat-strip" style={{ marginBottom: 18 }}>
        <div className="card stat" style={{ background: 'rgba(63,169,245,0.06)' }}>
          <div className="label">Total Meters</div>
          <div className="value">{conns.length}</div>
        </div>
        <div className="card stat" style={{ background: 'rgba(56,211,159,0.06)' }}>
          <div className="label">Active</div>
          <div className="value" style={{ color: 'var(--ok)' }}>{active}</div>
        </div>
        <div className="card stat" style={{ background: 'rgba(95,188,255,0.06)' }}>
          <div className="label">30-Day Usage</div>
          <div className="value">{kwh(total30d, 1)}</div>
        </div>
      </div>

      <div className="grid-cards">
        {conns.map((cn) => {
          const addr   = [cn.street, cn.city].filter(Boolean).join(', ') || '—';
          const region = [cn.parent_region_name, cn.region_name].filter(Boolean).join(' · ') || '—';
          return (
            <div key={cn.connection_id} className="card lift">
              <div className="row between" style={{ marginBottom: 8 }}>
                <div className="text-lg" style={{ fontWeight: 700 }}>{cn.serial_no}</div>
                <span className={`badge ${cn.status}`}>{cn.status}</span>
              </div>
              <div className="row-info" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                <Field k="Meter ID"      v={`#${cn.meter_id}`} />
                <Field k="Connection"    v={`#${cn.connection_id}`} />
                <Field k="Installed"     v={shortDate(cn.installation_date)} />
                <Field k="Active Since"  v={shortDate(cn.start_date)} />
                <Field k="Ended"         v={cn.end_date ? shortDate(cn.end_date) : 'Active'} />
                <Field k="30-Day Usage"  v={kwh(cn.kwh_30d || 0, 1)} />
                <Field k="Last Reading"  v={cn.last_reading_ts ? dateTime(cn.last_reading_ts) : '—'} />
                <Field k="Region"        v={region} />
                <Field k="Address"       v={addr} />
              </div>
              <div className="actions" style={{ marginTop: 14 }}>
                <button className="small" onClick={() => nav(`/dashboard?meter_id=${cn.meter_id}`)}>
                  View Consumption
                </button>
              </div>
            </div>
          );
        })}
        {conns.length === 0 && (
          <div className="empty"><div className="ico">⌬</div><p>No meters connected yet.</p></div>
        )}
      </div>
    </Layout>
  );
}
