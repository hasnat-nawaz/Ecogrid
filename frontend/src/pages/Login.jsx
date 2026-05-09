import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@ecogrid.io');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const u = await login(email, password);
      nav(u.role === 'admin' ? '/admin' : '/dashboard');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card fade-in" onSubmit={submit}>
        <div className="row" style={{ gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'var(--gradient-blue)', display: 'grid', placeItems: 'center',
            boxShadow: '0 6px 14px rgba(26,108,201,0.45)', color: 'white', fontWeight: 700,
          }}>⚡</div>
          <div>
            <h2 style={{ margin: 0 }}>EcoGrid</h2>
            <p style={{ margin: 0 }} className="muted">Smart grid management — sign in</p>
          </div>
        </div>
        <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <p className="error">{err}</p>}
        <button style={{ width: '100%', marginTop: 8 }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted" style={{ marginTop: 14 }}>
          No account? <Link to="/register">Create one</Link>
        </p>
        <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
          Demo · admin@ecogrid.io / admin123 · user@ecogrid.io / user123
        </p>
      </form>
    </div>
  );
}
