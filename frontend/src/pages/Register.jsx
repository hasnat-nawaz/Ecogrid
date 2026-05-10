import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))   score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const strengthLabels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['#d6486b', '#e0834a', '#d99524', '#7eb43c', '#2da46c'];

  function validate() {
    if (!email.trim()) return 'Please enter your email address.';
    if (!EMAIL_RE.test(email.trim())) return 'Please enter a valid email address.';
    if (!password) return 'Please choose a password.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password.length > 100) return 'Password is too long (max 100 characters).';
    if (confirm !== password) return 'Passwords do not match.';
    return '';
  }

  async function submit(e) {
    e.preventDefault();
    const v = validate();
    if (v) { setErr(v); return; }
    setErr(''); setBusy(true);
    try {
      await register(email.trim(), password);
      nav('/dashboard');
    } catch (e) {
      const m = (e.message || '').toLowerCase();
      if (m.includes('already')) setErr('That email is already registered. Try signing in instead.');
      else if (m.includes('invalid input')) setErr('Email or password didn\'t pass validation. Use a valid email and a 6+ char password.');
      else setErr(e.message || 'Sign-up failed.');
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <aside className="auth-hero">
        <div className="hero-brand">
          <Logo size={40} tone="dark" />
          <div className="name">EcoGrid</div>
        </div>

        <div className="hero-copy">
          <h1>Join the smarter grid.</h1>
          <p>Create your EcoGrid account to view live consumption, manage invoices, and link your smart meters in seconds.</p>
          <div className="hero-stats">
            <div className="item"><div className="v">Free</div><div className="l">For consumers</div></div>
            <div className="item"><div className="v">Secure</div><div className="l">Encrypted login</div></div>
            <div className="item"><div className="v">Instant</div><div className="l">Live readings</div></div>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
          © {new Date().getFullYear()} EcoGrid · Smart Grid Management
        </div>
      </aside>

      <div className="auth-form-wrap">
        <form className="card auth-card fade-in" onSubmit={submit} autoComplete="off" noValidate>
          <div className="row" style={{ gap: 12, marginBottom: 18 }}>
            <Logo size={42} />
            <div>
              <h2 style={{ margin: 0 }}>Create account</h2>
              <p style={{ margin: 0 }} className="muted">Sign up as a consumer.</p>
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
                placeholder="At least 6 characters"
                required
                minLength={6}
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
            {/* Strength meter */}
            {password.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{
                      height: 4, flex: 1, borderRadius: 4,
                      background: i < strength ? strengthColors[strength] : 'rgba(34,51,84,0.10)',
                      transition: 'background 0.18s ease',
                    }} />
                  ))}
                </div>
                <div className="input-note" style={{ color: strengthColors[strength], marginTop: 6 }}>
                  {strengthLabels[strength]}
                </div>
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              required
            />
            {confirm && confirm !== password && (
              <p className="input-note warn" style={{ color: 'var(--danger)' }}>Passwords don&apos;t match.</p>
            )}
          </div>

          {err && <p className="error">{err}</p>}

          <button style={{ width: '100%', marginTop: 14 }} disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>

          <p className="muted" style={{ marginTop: 18, textAlign: 'center' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
