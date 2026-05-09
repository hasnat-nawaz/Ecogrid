import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { rs, kwh } from '../lib/format';

function HeroCard({ icon, label, value, sub, onClick }) {
  return (
    <div className="card lift kpi-card clickable" onClick={onClick} role="button" tabIndex={0}
         onKeyDown={(e) => e.key === 'Enter' && onClick?.()}>
      <div className="icon">{icon}</div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export default function AdminOverview() {
  const nav = useNavigate();
  const { data: d, loading } = usePoll(() => api('/api/admin/overview'), 3000);

  if (loading || !d) return <Layout><Loader label="Fetching system status…" /></Layout>;

  return (
    <Layout>
      <div className="toolbar">
        <h2 className="section-title" style={{ margin: 0 }}>System Overview</h2>
        <span className="muted">Auto-refresh every 3s</span>
      </div>

      <div className="grid-cards fade-in">
        <HeroCard icon="👥" label="Consumers"
                  value={d.consumers}
                  sub="Click to view all"
                  onClick={() => nav('/admin/consumers')} />
        <HeroCard icon="⚡" label="Consumption Today"
                  value={kwh(d.energy_today_kwh, 1)}
                  sub="View detailed analytics"
                  onClick={() => nav('/admin/consumption')} />
        <HeroCard icon="⌬" label="Active Meters"
                  value={`${d.active_meters} / ${d.total_meters}`}
                  sub="View connections"
                  onClick={() => nav('/admin/connections')} />
        <HeroCard icon="₨" label="Invoices"
                  value={d.total_invoices}
                  sub={`${d.unpaid_invoices} unpaid · ${rs(d.unpaid_amount)}`}
                  onClick={() => nav('/admin/billing')} />
        <HeroCard icon="⚠" label="Alerts (24h)"
                  value={d.alerts_24h}
                  sub="View load alerts"
                  onClick={() => nav('/admin/alerts')} />
      </div>

      <div className="grid-2 fade-in">
        <div className="card">
          <h3 className="subtitle">How EcoGrid Works</h3>
          <p className="muted">
            Smart meters stream readings into the database every couple of seconds.
            Tariff-aware billing is computed entirely inside Postgres using stored procedures,
            and load alerts are pushed live over WebSockets the moment a spike is detected.
          </p>
          <p className="muted" style={{ marginTop: 10 }}>
            Use the cards above as quick navigation — every metric on this page links to a
            full detail screen.
          </p>
        </div>
        <div className="card">
          <h3 className="subtitle">Quick Actions</h3>
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => nav('/admin/billing')}>Run Billing</button>
            <button className="ghost" onClick={() => nav('/admin/consumption')}>Open Analytics</button>
            <button className="ghost" onClick={() => nav('/admin/alerts')}>View Alerts</button>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            Total billed to date: <strong style={{ color: 'var(--text)' }}>{rs(d.total_billed)}</strong>
          </p>
        </div>
      </div>
    </Layout>
  );
}
