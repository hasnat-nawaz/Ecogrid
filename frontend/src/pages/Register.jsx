import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr('');
    try { await register(email, password); nav('/dashboard'); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h2>Create account</h2>
        <p>Sign up as a consumer.</p>
        <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <p className="error">{err}</p>}
        <button style={{ width: '100%', marginTop: 8 }}>Create account</button>
        <p className="muted" style={{ marginTop: 14 }}>
          Have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
