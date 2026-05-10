import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { rs, kwh, shortDate } from '../lib/format';

export default function UserBilling() {
  const { data, loading, refresh } = usePoll(() => api('/api/user/invoices'), 3000);
  const rows = data?.invoices || [];

  async function pay(id) {
    try {
      await api(`/api/user/invoices/${id}/pay`, { method: 'POST' });
      await refresh();
    } catch (e) { alert(e.message || 'Payment failed'); }
  }

  if (loading && !data) return <Layout><Loader label="Loading invoices…" /></Layout>;

  return (
    <Layout>
      <div className="page-head fade-in">
        <div>
          <div className="eyebrow">My account</div>
          <h2>Billing History</h2>
        </div>
        <span className="range-pill"><strong>{rows.length}</strong>&nbsp;invoice{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="card fade-in">
        <table>
          <thead><tr><th>Period</th><th>Units</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.invoice_id}>
                <td>{shortDate(i.period_start)} – {shortDate(i.period_end)}</td>
                <td>{kwh(i.total_units)}</td>
                <td><strong>{rs(i.total_amount)}</strong></td>
                <td><span className={`badge ${i.status}`}>{i.status}</span></td>
                <td>{i.status !== 'paid' && <button className="small" onClick={() => pay(i.invoice_id)}>Pay Now</button>}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="5" className="muted" style={{ textAlign: 'center', padding: 30 }}>
                No invoices yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
