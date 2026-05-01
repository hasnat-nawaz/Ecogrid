import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Layout from '../components/Layout';

export default function UserBilling() {
  const [rows, setRows] = useState([]);
  function load() { api('/api/user/invoices').then((x) => setRows(x.invoices)).catch(() => {}); }
  useEffect(load, []);

  async function pay(id) { await api(`/api/user/invoices/${id}/pay`, { method: 'POST' }); load(); }

  return (
    <Layout>
      <h2 className="section-title">Billing history</h2>
      <div className="card">
        <table>
          <thead><tr><th>Period</th><th>Units</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.invoice_id}>
                <td>{i.period_start} → {i.period_end}</td>
                <td>{Number(i.total_units).toFixed(2)} kWh</td>
                <td>${Number(i.total_amount).toFixed(2)}</td>
                <td><span className={`badge ${i.status}`}>{i.status}</span></td>
                <td>{i.status !== 'paid' && <button onClick={() => pay(i.invoice_id)}>Pay now</button>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="5" className="muted">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
