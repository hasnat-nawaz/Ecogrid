import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { rs } from '../lib/format';

function defaultRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end   = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    period_start: start.toISOString().slice(0, 10),
    period_end:   end.toISOString().slice(0, 10),
  };
}

export default function AdminGenerateInvoice() {
  const nav = useNavigate();
  const def = defaultRange();
  const [periodStart, setPeriodStart] = useState(def.period_start);
  const [periodEnd, setPeriodEnd]     = useState(def.period_end);
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/admin/tariffs')
      .then((x) => setTariffs(x.tariffs.length ? x.tariffs : [
        { name: 'Off-Peak', rate_per_unit: 8.5,  start_time: '22:00', end_time: '06:00' },
        { name: 'Standard', rate_per_unit: 14.0, start_time: '06:00', end_time: '17:00' },
        { name: 'Peak',     rate_per_unit: 22.0, start_time: '17:00', end_time: '22:00' },
      ]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(idx, field, value) {
    setTariffs((t) => t.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  }

  async function run(e) {
    e.preventDefault();
    setBusy(true); setMsg(''); setErr('');
    try {
      const cleaned = tariffs.map(t => ({
        name: t.name,
        rate_per_unit: Number(t.rate_per_unit),
        start_time: (t.start_time || '00:00').slice(0, 5),
        end_time:   (t.end_time   || '23:59').slice(0, 5),
      }));
      await api('/api/admin/billing/run', {
        method: 'POST',
        body: { period_start: periodStart, period_end: periodEnd, tariffs: cleaned },
      });
      setMsg('Invoices generated successfully. Consumers with no readings in the period are billed Rs 0.');
      setTimeout(() => nav('/admin/billing'), 1200);
    } catch (e) {
      setErr(e.message || 'Failed to generate invoices');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Layout><Loader label="Loading tariff rates…" /></Layout>;

  return (
    <Layout>
      <div className="page-head fade-in">
        <div>
          <button className="ghost small" style={{ marginBottom: 10 }} onClick={() => nav('/admin/billing')}>← Back to invoices</button>
          <div className="eyebrow">Admin · Finance</div>
          <h2>Generate invoices</h2>
        </div>
      </div>

      <form onSubmit={run} className="grid-2 fade-in">
        <div className="card">
          <h3 className="subtitle">Billing Period</h3>
          <div className="grid-2">
            <div>
              <label>Period Start</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
            </div>
            <div>
              <label>Period End</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
            </div>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            Invoices are generated for every active connection. Consumers whose meters started
            after the period end are billed <strong>Rs 0.00</strong> automatically.
          </p>
        </div>

        <div className="card">
          <h3 className="subtitle">Tariff Rates (Rs / kWh)</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            These rates replace the active set before billing runs. Edit below to test scenarios.
          </p>
          <div className="col" style={{ gap: 10 }}>
            {tariffs.map((t, i) => (
              <div key={i} className="row" style={{ gap: 8 }}>
                <input style={{ flex: 1 }}     value={t.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Name" />
                <input style={{ width: 110 }}  type="time"   value={(t.start_time || '').slice(0,5)} onChange={(e) => update(i, 'start_time', e.target.value)} />
                <input style={{ width: 110 }}  type="time"   value={(t.end_time   || '').slice(0,5)} onChange={(e) => update(i, 'end_time',   e.target.value)} />
                <input style={{ width: 110 }}  type="number" step="0.01" value={t.rate_per_unit}
                       onChange={(e) => update(i, 'rate_per_unit', e.target.value)} placeholder="Rate" />
                <button type="button" className="ghost small"
                        onClick={() => setTariffs(arr => arr.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="ghost small"
                    onClick={() => setTariffs(t => [...t, { name: 'Custom', rate_per_unit: 10, start_time: '00:00', end_time: '23:59' }])}>
              + Add Tariff
            </button>
          </div>
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="row between">
            <div>
              <strong>Ready to generate?</strong>
              <div className="muted">All amounts will be saved in {rs(0).slice(0, 2)} (PKR).</div>
            </div>
            <div className="row">
              <button className="ghost" type="button" onClick={() => nav('/admin/billing')} disabled={busy}>Cancel</button>
              <button disabled={busy}>{busy ? 'Running…' : 'Run Billing Now'}</button>
            </div>
          </div>
          {msg && <p style={{ color: 'var(--ok)', marginTop: 12 }}>{msg}</p>}
          {err && <p className="error"  style={{ marginTop: 12 }}>{err}</p>}
        </div>
      </form>
    </Layout>
  );
}
