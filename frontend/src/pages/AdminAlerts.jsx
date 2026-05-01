import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { useLiveStream } from '../hooks/useLiveStream';

export default function AdminAlerts() {
  const [rows, setRows] = useState([]);
  const { last } = useLiveStream();

  useEffect(() => { api('/api/admin/alerts').then((x) => setRows(x.alerts)).catch(() => {}); }, []);
  useEffect(() => {
    if (last?.type === 'ecogrid_alert') {
      setRows((r) => [{ alert_id: 'live-' + Date.now(), severity: last.payload.energy_consumed > 10 ? 'critical' : 'warning',
        meter_id: last.payload.meter_id, ts: last.payload.ts,
        message: `Live: meter ${last.payload.meter_id} drew ${Number(last.payload.energy_consumed).toFixed(2)} kWh`,
      }, ...r].slice(0, 100));
    }
  }, [last]);

  return (
    <Layout>
      <h2 className="section-title">Load alerts</h2>
      <div className="card">
        <table>
          <thead><tr><th>Severity</th><th>Meter</th><th>Time</th><th>Message</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.alert_id}>
                <td><span className={`badge ${a.severity}`}>{a.severity}</span></td>
                <td>#{a.meter_id}</td>
                <td>{new Date(a.ts).toLocaleString()}</td>
                <td>{a.message}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="4" className="muted">No alerts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
