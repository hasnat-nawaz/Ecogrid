import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { useLiveStream } from '../hooks/useLiveStream';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function UserDashboard() {
  const [me, setMe] = useState(null);
  const [series, setSeries] = useState([]);
  const [live, setLive] = useState([]);
  const { last, connected } = useLiveStream();

  useEffect(() => {
    api('/api/user/me').then(setMe).catch(() => {});
    api('/api/user/consumption').then((x) => setSeries(x.series.map(r => ({
      t: new Date(r.bucket).toLocaleTimeString([], { hour: '2-digit' }),
      kWh: Number(r.kwh),
    })))).catch(() => {});
  }, []);

  const myMeterIds = useMemo(() => new Set((me?.connections || []).map((c) => c.meter_id)), [me]);

  useEffect(() => {
    if (last?.type === 'ecogrid_reading' && myMeterIds.has(last.payload.meter_id)) {
      setLive((arr) => [...arr.slice(-29), {
        t: new Date(last.payload.ts).toLocaleTimeString(),
        kWh: Number(last.payload.energy_consumed),
      }]);
    }
  }, [last, myMeterIds]);

  return (
    <Layout>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section-title" style={{ margin: 0 }}>My usage</h2>
        <div className="row"><span className="live-dot" style={{ background: connected ? 'var(--primary)' : 'var(--danger)' }} /> {connected ? 'live stream' : 'reconnecting…'}</div>
      </div>

      <div className="grid-cards" style={{ marginTop: 16 }}>
        <div className="card kpi">
          <div className="label">Account</div>
          <div className="value" style={{ fontSize: 18 }}>{me?.consumer?.name || '—'}</div>
          <div className="muted">{me?.consumer?.email}</div>
        </div>
        <div className="card kpi">
          <div className="label">Meters</div>
          <div className="value">{me?.connections?.length ?? 0}</div>
          <div className="muted">{me?.connections?.map((c) => c.serial_no).join(', ')}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">Live consumption</h2>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={live}>
              <CartesianGrid stroke="#233355" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#92a0c5" fontSize={11} />
              <YAxis stroke="#92a0c5" fontSize={11} />
              <Tooltip contentStyle={{ background: '#121a2c', border: '1px solid #233355' }} />
              <Line type="monotone" dataKey="kWh" stroke="#38d39f" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {live.length === 0 && <p className="muted">Waiting for meter readings… run <code>npm run simulate</code> in the backend.</p>}
      </div>

      <div className="card">
        <h2 className="section-title">Last 24 hours</h2>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={series}>
              <CartesianGrid stroke="#233355" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#92a0c5" fontSize={11} />
              <YAxis stroke="#92a0c5" fontSize={11} />
              <Tooltip contentStyle={{ background: '#121a2c', border: '1px solid #233355' }} />
              <Line type="monotone" dataKey="kWh" stroke="#5fa8ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  );
}
