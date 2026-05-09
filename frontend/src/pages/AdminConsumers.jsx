import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { shortDate } from '../lib/format';

export default function AdminConsumers() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const { data, loading } = usePoll(
    () => api(`/api/admin/consumers${search ? `?q=${encodeURIComponent(search)}` : ''}`),
    3000,
    [search]
  );
  const rows = data?.consumers || [];

  function submit(e) { e.preventDefault(); setSearch(q.trim()); }

  return (
    <Layout>
      <div className="toolbar">
        <h2 className="section-title" style={{ margin: 0 }}>Consumers</h2>
        <span className="muted">{rows.length} shown</span>
      </div>

      <form onSubmit={submit} className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div className="search-bar">
          <span style={{ color: 'var(--muted)' }}>🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Search by name, email, or consumer ID…" />
          <button className="small">Search</button>
          {search && <button type="button" className="ghost small" onClick={() => { setQ(''); setSearch(''); }}>Clear</button>}
        </div>
      </form>

      {loading && !data ? <Loader label="Loading consumers…" /> : (
        <div className="card fade-in">
          <table>
            <thead>
              <tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Connections</th><th>Joined</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.consumer_id} className="clickable"
                    onClick={() => nav(`/admin/consumers/${c.consumer_id}`)}>
                  <td>#{c.consumer_id}</td>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.email}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.connections}</td>
                  <td>{shortDate(c.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="6" className="muted" style={{ textAlign: 'center', padding: 30 }}>
                  No consumers match.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
