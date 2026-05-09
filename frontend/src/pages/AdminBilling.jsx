import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { rs, kwh, shortDate } from '../lib/format';

export default function AdminBilling() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState(''); // YYYY-MM

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (search) sp.set('q', search);
    if (status) sp.set('status', status);
    if (month) sp.set('month', month);
    return sp.toString();
  }, [search, status, month]);

  const { data: invData, loading } = usePoll(() => api(`/api/admin/billing?${qs}`), 3000, [qs]);
  const { data: statData } = usePoll(
    () => api(`/api/admin/billing/stats${month ? `?month=${month}` : ''}`),
    3000,
    [month]
  );

  const rows = invData?.invoices || [];
  const stats = statData || {};
  const monthly = stats.monthly || [];
  const byStatus = stats.by_status || [];
  const tm = stats.this_month || {};

  const statusBars = ['paid', 'unpaid', 'overdue'].map(s => {
    const r = byStatus.find(x => x.status === s) || { count: 0, amount: 0 };
    return { status: s, count: r.count, amount: r.amount };
  });

  const monthSeries = monthly.map(m => ({ month: m.month, invoices: m.invoices, amount: m.amount }));

  function submit(e) { e.preventDefault(); setSearch(q.trim()); }

  return (
    <Layout>
      <div className="toolbar">
        <h2 className="section-title" style={{ margin: 0 }}>Invoices</h2>
        <span className="muted">Currency: PKR (Rs)</span>
        <div className="spacer" />
        <button onClick={() => nav('/admin/billing/generate')}>Generate Invoice</button>
      </div>

      {/* Search + filters */}
      <form onSubmit={submit} className="card" style={{ padding: 14, marginBottom: 18 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
            <span style={{ color: 'var(--muted)' }}>🔍</span>
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="Search by user ID, name, or email…" />
            <button className="small">Search</button>
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 160 }}>
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
          </select>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 180 }} />
          {(search || status || month) && (
            <button type="button" className="ghost small"
                    onClick={() => { setQ(''); setSearch(''); setStatus(''); setMonth(''); }}>Reset</button>
          )}
        </div>
      </form>

      {/* Statistics */}
      <div className="stat-strip" style={{ marginBottom: 18 }}>
        <div className="card stat">
          <div className="label">This Month — Generated</div>
          <div className="value">{rs(tm.amount || 0)}</div>
          <div className="muted">{tm.invoices || 0} invoices</div>
        </div>
        <div className="card stat">
          <div className="label">This Month — Paid</div>
          <div className="value" style={{ color: 'var(--ok)' }}>{rs(tm.paid || 0)}</div>
        </div>
        {statusBars.map((b) => (
          <div key={b.status} className="card stat">
            <div className="label" style={{ textTransform: 'capitalize' }}>{b.status}</div>
            <div className="value">{b.count}</div>
            <div className="muted">{rs(b.amount)}</div>
          </div>
        ))}
      </div>

      <div className="grid-2 fade-in" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3 className="subtitle">Invoices by Status</h3>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={statusBars}>
                <CartesianGrid stroke="#1f3566" strokeDasharray="3 3" />
                <XAxis dataKey="status" stroke="#8fa2cf" fontSize={11} />
                <YAxis stroke="#8fa2cf" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0f1d3d', border: '1px solid #1f3566' }} />
                <Bar dataKey="count" fill="#3fa9f5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3 className="subtitle">Revenue Trend (last 12 months)</h3>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={monthSeries}>
                <CartesianGrid stroke="#1f3566" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#8fa2cf" fontSize={11} />
                <YAxis stroke="#8fa2cf" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0f1d3d', border: '1px solid #1f3566' }}
                         formatter={(v, n) => n === 'amount' ? rs(v) : v} />
                <Line type="monotone" dataKey="amount" stroke="#3fa9f5" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {loading && !invData ? <Loader label="Loading invoices…" /> : (
        <div className="card fade-in">
          <table>
            <thead>
              <tr><th>Consumer</th><th>Period</th><th>Units</th><th>Amount</th><th>Generated</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.invoice_id} className="clickable"
                    onClick={() => nav(`/admin/consumers/${i.consumer_id}`)}>
                  <td>
                    <strong>{i.consumer_name}</strong>
                    <div className="muted" style={{ fontSize: 11 }}>{i.consumer_email} · #{i.consumer_id}</div>
                  </td>
                  <td>{shortDate(i.period_start)} → {shortDate(i.period_end)}</td>
                  <td>{kwh(i.total_units)}</td>
                  <td><strong>{rs(i.total_amount)}</strong></td>
                  <td className="muted">{shortDate(i.generated_at)}</td>
                  <td><span className={`badge ${i.status}`}>{i.status}</span></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="6" className="muted" style={{ textAlign: 'center', padding: 30 }}>
                  No invoices match.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
