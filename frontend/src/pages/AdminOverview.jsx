import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Layout from '../components/Layout';

function Card({ label, value, suffix }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}{suffix && <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 6 }}>{suffix}</span>}</div>
    </div>
  );
}

export default function AdminOverview() {
  const [d, setD] = useState(null);
  useEffect(() => {
    let alive = true;
    const tick = () => api('/api/admin/overview').then((x) => alive && setD(x)).catch(() => {});
    tick(); const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!d) return <Layout><p>Loading…</p></Layout>;

  return (
    <Layout>
      <h2 className="section-title">System overview</h2>
      <div className="grid-cards">
        <Card label="Consumers" value={d.consumers} />
        <Card label="Active meters" value={d.active_meters} />
        <Card label="Energy today" value={d.energy_today_kwh.toFixed(1)} suffix="kWh" />
        <Card label="Unpaid invoices" value={d.unpaid_invoices} suffix={`($${d.unpaid_amount.toFixed(2)})`} />
        <Card label="Alerts (24h)" value={d.alerts_24h} />
      </div>
      <div className="card">
        <h2 className="section-title">About this dashboard</h2>
        <p className="muted">
          Data is refreshed every 5s. KPIs are cached in Redis for 15s.
          Real-time meter events stream over WebSockets from Postgres NOTIFY channels.
          ToU billing is computed by stored procedures and scheduled with pg_cron.
        </p>
      </div>
    </Layout>
  );
}
