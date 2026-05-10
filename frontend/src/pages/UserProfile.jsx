import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import Loader from '../components/Loader';
import { usePoll } from '../hooks/usePoll';
import { dateTime } from '../lib/format';

function Field({ k, v }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>{k}</div>
      <div style={{ fontWeight: 500, marginTop: 4 }}>{v ?? '—'}</div>
    </div>
  );
}

export default function UserProfile() {
  const nav = useNavigate();
  const { data, loading } = usePoll(() => api('/api/user/me'), 10000);

  if (loading && !data) return <Layout><Loader label="Loading your profile…" /></Layout>;

  const c = data?.consumer;
  if (!c) {
    return (
      <Layout>
        <div className="empty"><div className="ico">👤</div>
          <p>No consumer profile is linked to your account yet.</p>
        </div>
      </Layout>
    );
  }

  const fullAddress = [c.street, c.city].filter(Boolean).join(', ') || '—';
  const region     = [c.parent_region_name, c.region_name].filter(Boolean).join(' · ') || '—';

  return (
    <Layout>
      <div className="page-head fade-in">
        <div>
          <button className="ghost small" style={{ marginBottom: 10 }} onClick={() => nav('/dashboard')}>← Dashboard</button>
          <div className="eyebrow">My account · #{c.consumer_id}</div>
          <h2>{c.name}</h2>
        </div>
      </div>

      <div className="grid-2 fade-in">
        <div className="card">
          <h3 className="subtitle">Profile</h3>
          <div className="big-card">
            <div className="row-info">
              <Field k="Name"        v={c.name} />
              <Field k="Consumer ID" v={`#${c.consumer_id}`} />
              <Field k="Email"       v={c.email} />
              <Field k="Phone"       v={c.phone} />
              <Field k="Joined"      v={dateTime(c.created_at)} />
              <Field k="Meters"      v={(data?.connections?.length ?? 0)} />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="subtitle">Address</h3>
          <div className="big-card">
            <div className="row-info">
              <Field k="Street" v={c.street} />
              <Field k="City"   v={c.city} />
              <Field k="Region" v={c.region_name} />
              <Field k="Parent Region" v={c.parent_region_name} />
              <Field k="Full Address"  v={fullAddress} />
              <Field k="Region Path"   v={region} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
