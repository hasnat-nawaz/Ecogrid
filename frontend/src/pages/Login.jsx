import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@ecogrid.io');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      const u = await login(email, password);
      nav(u.role === 'admin' ? '/admin' : '/dashboard');
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h2>⚡ EcoGrid</h2>
        <p>Smart grid management — sign in</p>
        <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <p className="error">{err}</p>}
        <button style={{ width: '100%', marginTop: 8 }}>Sign in</button>
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
