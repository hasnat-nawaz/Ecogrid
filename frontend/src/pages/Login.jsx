import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!email.trim()) return setErr('Please enter your email.');
    if (!password)     return setErr('Please enter your password.');
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      nav(u.role === 'admin' ? '/admin' : '/dashboard');
    } catch (e) {
      const m = (e.message || '').toLowerCase();
      setErr(m.includes('invalid') ? 'Email or password is incorrect.' : (e.message || 'Sign-in failed.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      {/* Hero panel */}
      <aside className="auth-hero">
        <div className="hero-brand">
          <Logo size={40} tone="dark" />
          <div className="name">EcoGrid</div>
        </div>

        <div className="hero-copy">
          <h1>Energy clarity, simplified.</h1>
          <p>Track your consumption, manage invoices, and stay in control of your smart-grid connection — all from one elegant dashboard.</p>
          <div className="hero-stats">
            <div className="item"><div className="v">24/7</div><div className="l">Live monitoring</div></div>
            <div className="item"><div className="v">100%</div><div className="l">Cloud sync</div></div>
            <div className="item"><div className="v">Real‑time</div><div className="l">Insights</div></div>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
          © {new Date().getFullYear()} EcoGrid · Smart Grid Management
        </div>
      </aside>

      {/* Form panel */}
      <div className="auth-form-wrap">
        <form className="card auth-card fade-in" onSubmit={submit} autoComplete="off" noValidate>
          <div className="row" style={{ gap: 12, marginBottom: 18 }}>
            <Logo size={42} />
            <div>
              <h2 style={{ margin: 0 }}>Welcome back</h2>
              <p style={{ margin: 0 }} className="muted">Sign in to your EcoGrid workspace.</p>
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              autoComplete="off"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ paddingRight: 52 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
                className="ghost small"
                style={{
                  position: 'absolute', top: '50%', right: 6,
                  transform: 'translateY(-50%)', padding: '6px 10px', fontSize: 11,
                }}
              >{showPwd ? 'Hide' : 'Show'}</button>
            </div>
          </div>

          {err && <p className="error">{err}</p>}

          <button style={{ width: '100%', marginTop: 14 }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="muted" style={{ marginTop: 18, textAlign: 'center' }}>
            New here? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
