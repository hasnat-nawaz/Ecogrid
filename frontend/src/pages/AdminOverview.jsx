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

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function AdminOverview() {
  const nav = useNavigate();
  const { data: d, loading } = usePoll(() => api('/api/admin/overview'), 3000);

  if (loading || !d) return <Layout><Loader label="Fetching system status…" /></Layout>;

  const meterCoverage = d.total_meters
    ? Math.round((d.active_meters / d.total_meters) * 100)
    : 0;

  return (
    <Layout>
      <div className="page-head fade-in">
        <div>
          <div className="eyebrow">Admin · {todayLabel()}</div>
          <h2>System Overview</h2>
        </div>
        <span className="range-pill">
          <span className="dot" />
          <strong>Auto-refresh</strong> every 3 seconds
        </span>
      </div>

      <div className="grid-cards fade-in">
        <HeroCard icon="👥" label="Consumers"
                  value={d.consumers}
                  sub="View directory →"
                  onClick={() => nav('/admin/consumers')} />
        <HeroCard icon="⚡" label="Today"
                  value={kwh(d.energy_today_kwh, 1)}
                  sub="Open analytics →"
                  onClick={() => nav('/admin/consumption')} />
        <HeroCard icon="⌬" label="Active Meters"
                  value={`${d.active_meters} / ${d.total_meters}`}
                  sub={`${meterCoverage}% online · view connections →`}
                  onClick={() => nav('/admin/connections')} />
        <HeroCard icon="₨" label="Invoices"
                  value={d.total_invoices}
                  sub={`${d.unpaid_invoices} unpaid · ${rs(d.unpaid_amount)}`}
                  onClick={() => nav('/admin/billing')} />
        <HeroCard icon="⚠" label="Alerts (24h)"
                  value={d.alerts_24h}
                  sub="View incidents →"
                  onClick={() => nav('/admin/alerts')} />
      </div>

      <div className="grid-2 fade-in">
        <div className="card">
          <h3 className="subtitle">Today at a glance</h3>
          <div className="stat-strip" style={{ marginTop: 4 }}>
            <div className="stat" style={{ padding: 0 }}>
              <div className="label">Energy delivered</div>
              <div className="value">{kwh(d.energy_today_kwh, 1)}</div>
            </div>
            <div className="stat" style={{ padding: 0 }}>
              <div className="label">Meter coverage</div>
              <div className="value" style={{ color: meterCoverage >= 90 ? 'var(--ok)' : meterCoverage >= 60 ? 'var(--warn)' : 'var(--danger)' }}>
                {meterCoverage}%
              </div>
            </div>
            <div className="stat" style={{ padding: 0 }}>
              <div className="label">Open incidents</div>
              <div className="value" style={{ color: d.alerts_24h > 0 ? 'var(--warn)' : 'var(--ok)' }}>
                {d.alerts_24h}
              </div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            Total billed to date: <strong style={{ color: 'var(--text)' }}>{rs(d.total_billed)}</strong>
          </p>
        </div>

        <div className="card">
          <h3 className="subtitle">Quick actions</h3>
          <div className="row" style={{ marginTop: 4 }}>
            <button onClick={() => nav('/admin/billing')}>Run Billing</button>
            <button className="ghost" onClick={() => nav('/admin/consumption')}>Open Analytics</button>
            <button className="ghost" onClick={() => nav('/admin/alerts')}>View Alerts</button>
          </div>
          <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            Use the cards above as quick navigation — every metric links to its full detail screen.
          </p>
        </div>
      </div>
    </Layout>
  );
}
