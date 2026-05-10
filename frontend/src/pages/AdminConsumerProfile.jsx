import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { rs, kwh, shortDate, dateTime } from '../lib/format';

function Field({ k, v }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>{k}</div>
      <div style={{ fontWeight: 500, marginTop: 4 }}>{v ?? '—'}</div>
    </div>
  );
}

export default function AdminConsumerProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading, error } = usePoll(() => api(`/api/admin/consumers/${id}`), 5000, [id]);

  if (loading || !data) return <Layout><Loader label="Loading consumer profile…" /></Layout>;
  if (error) return <Layout><div className="empty"><div className="ico">⚠</div><p>{String(error.message)}</p></div></Layout>;

  const { consumer: c, connections, invoice_stats: stats, usage_30d_kwh } = data;

  return (
    <Layout>
      <div className="page-head fade-in">
        <div>
          <button className="ghost small" style={{ marginBottom: 10 }} onClick={() => nav('/admin/consumers')}>← All consumers</button>
          <div className="eyebrow">Consumer profile · #{c.consumer_id}</div>
          <h2>{c.name}</h2>
        </div>
      </div>

      <div className="grid-2 fade-in" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3 className="subtitle">Profile</h3>
          <div className="big-card">
            <div className="row-info">
              <Field k="Name" v={c.name} />
              <Field k="Consumer ID" v={`#${c.consumer_id}`} />
              <Field k="Email" v={c.email} />
              <Field k="Phone" v={c.phone} />
              <Field k="Street" v={c.street} />
              <Field k="City" v={c.city} />
              <Field k="Region" v={c.region_name} />
              <Field k="Joined" v={dateTime(c.created_at)} />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="subtitle">Account Summary</h3>
          <div className="stat-strip" style={{ marginTop: 8 }}>
            <div className="card stat">
              <div className="label">Last 30d Usage</div>
              <div className="value">{kwh(usage_30d_kwh, 1)}</div>
            </div>
            <div className="card stat">
              <div className="label">Total Invoices</div>
              <div className="value">{stats.total ?? 0}</div>
            </div>
            <div className="card stat">
              <div className="label">Paid Amount</div>
              <div className="value" style={{ color: 'var(--ok)' }}>{rs(stats.paid_amount || 0)}</div>
            </div>
            <div className="card stat">
              <div className="label">Total Billed</div>
              <div className="value">{rs(stats.billed || 0)}</div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            <span className="badge paid">{stats.paid ?? 0} paid</span>{' '}
            <span className="badge unpaid">{stats.unpaid ?? 0} unpaid</span>{' '}
            <span className="badge overdue">{stats.overdue ?? 0} overdue</span>
          </p>
        </div>
      </div>

      <h3 className="subtitle">Meters & Connections ({connections.length})</h3>
      <div className="grid-cards">
        {connections.map((cn) => (
          <div key={cn.connection_id} className="card lift">
            <div className="row between" style={{ marginBottom: 8 }}>
              <div className="text-lg" style={{ fontWeight: 700 }}>{cn.serial_no}</div>
              <span className={`badge ${cn.status}`}>{cn.status}</span>
            </div>
            <div className="row-info" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              <Field k="Meter ID" v={`#${cn.meter_id}`} />
              <Field k="Connection" v={`#${cn.connection_id}`} />
              <Field k="Installed" v={shortDate(cn.installation_date)} />
              <Field k="Active Since" v={shortDate(cn.start_date)} />
              <Field k="Region" v={cn.region_name} />
              <Field k="Sub-Region" v={cn.parent_region_name || '—'} />
              <Field k="Address" v={`${cn.street || ''}, ${cn.city || ''}`} />
              <Field k="Ended" v={cn.end_date ? shortDate(cn.end_date) : 'Active'} />
            </div>
            <div className="actions" style={{ marginTop: 14 }}>
              <button className="small" onClick={() => nav(`/admin/consumption?meter_id=${cn.meter_id}`)}>
                View Consumption
              </button>
              <button className="ghost small"
                      onClick={() => window.open(`/admin/consumption?meter_id=${cn.meter_id}`, '_blank')}>
                Open in new tab
              </button>
            </div>
          </div>
        ))}
        {connections.length === 0 && (
          <div className="empty"><div className="ico">⌬</div><p>No meters connected yet.</p></div>
        )}
      </div>
    </Layout>
  );
}
