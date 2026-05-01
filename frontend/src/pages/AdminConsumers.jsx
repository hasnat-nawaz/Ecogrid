import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Layout from '../components/Layout';

export default function AdminConsumers() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api('/api/admin/consumers').then((x) => setRows(x.consumers)).catch(() => {}); }, []);
  return (
    <Layout>
      <h2 className="section-title">Consumers</h2>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Connections</th><th>Joined</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.consumer_id}>
                <td>{c.name}</td><td>{c.email}</td><td>{c.phone || '—'}</td>
                <td>{c.connections}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
