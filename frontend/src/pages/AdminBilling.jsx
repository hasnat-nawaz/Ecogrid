import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Layout from '../components/Layout';

export default function AdminBilling() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  function load() { api('/api/admin/billing').then((x) => setRows(x.invoices)).catch(() => {}); }
  useEffect(load, []);

  async function runBilling() {
    setBusy(true);
    try { await api('/api/admin/billing/run', { method: 'POST', body: {} }); load(); }
    finally { setBusy(false); }
  }

  return (
    <Layout>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="section-title" style={{ margin: 0 }}>Billing</h2>
        <button onClick={runBilling} disabled={busy}>{busy ? 'Running…' : 'Run billing now'}</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Consumer</th><th>Period</th><th>Units</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.invoice_id}>
                <td>{i.consumer_name}<div className="muted" style={{ fontSize: 11 }}>{i.consumer_email}</div></td>
                <td>{i.period_start} → {i.period_end}</td>
                <td>{Number(i.total_units).toFixed(2)} kWh</td>
                <td>${Number(i.total_amount).toFixed(2)}</td>
                <td><span className={`badge ${i.status}`}>{i.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
