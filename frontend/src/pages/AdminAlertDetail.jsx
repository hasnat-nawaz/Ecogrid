import { useNavigate, useParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { dateTime } from '../lib/format';

export default function AdminAlertDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading, error } = usePoll(() => api(`/api/admin/alerts/${id}`), 10000, [id]);

  if (loading || !data) return <Layout><Loader label="Opening alert…" /></Layout>;
  if (error) return <Layout><div className="empty"><div className="ico">⚠</div><p>{String(error.message)}</p></div></Layout>;

  const { alert: a, readings } = data;
  const series = (readings || []).map(r => ({
    t: new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    kWh: Number(r.energy_consumed),
  }));

  return (
    <Layout>
      <div className="toolbar">
        <button className="ghost small" onClick={() => nav('/admin/alerts')}>← All Alerts</button>
        <h2 className="section-title" style={{ margin: 0 }}>Alert #{a.alert_id}</h2>
        <span className={`badge ${a.severity}`}>{a.severity}</span>
      </div>

      <div className="grid-2 fade-in" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3 className="subtitle">Alert Information</h3>
          <div className="big-card">
            <div className="row-info">
              <div><div className="k">When</div><div className="v">{dateTime(a.ts)}</div></div>
              <div><div className="k">Severity</div><div className="v" style={{ textTransform: 'capitalize' }}>{a.severity}</div></div>
              <div><div className="k">Meter</div><div className="v">{a.serial_no || `#${a.meter_id}`}</div></div>
              <div><div className="k">Meter Status</div><div className="v">{a.meter_status || '—'}</div></div>
              <div><div className="k">Region</div><div className="v">{a.region_name || '—'}</div></div>
              <div><div className="k">Address</div><div className="v">{a.street ? `${a.street}, ${a.city}` : '—'}</div></div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="subtitle">What Happened</h3>
          <p style={{ fontSize: 15, lineHeight: 1.55 }}>{a.message}</p>
          <p className="muted" style={{ marginTop: 12 }}>
            Alerts are raised by a Postgres trigger (<code>trg_readings_monitor</code>) the moment
            a reading exceeds 5&nbsp;kWh in the sampled interval. Critical alerts fire above 10&nbsp;kWh
            and are pushed live to all connected dashboards via WebSockets.
          </p>
        </div>
      </div>

      <div className="card fade-in">
        <h3 className="subtitle">Readings around the alert (±15 minutes)</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={series}>
              <CartesianGrid stroke="#1f3566" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#8fa2cf" fontSize={11} />
              <YAxis stroke="#8fa2cf" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0f1d3d', border: '1px solid #1f3566' }} />
              <Line type="monotone" dataKey="kWh" stroke="#ff5c7a" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {series.length === 0 && <p className="muted">No surrounding readings available.</p>}
      </div>
    </Layout>
  );
}
