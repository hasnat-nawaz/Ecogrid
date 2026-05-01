import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveStream } from '../hooks/useLiveStream';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { connected } = useLiveStream();

  const adminLinks = [
    ['/admin', 'Overview'],
    ['/admin/consumers', 'Consumers'],
    ['/admin/billing', 'Billing'],
    ['/admin/alerts', 'Alerts'],
  ];
  const userLinks = [
    ['/dashboard', 'Usage'],
    ['/billing', 'Billing'],
  ];
  const links = user?.role === 'admin' ? adminLinks : userLinks;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>⚡ EcoGrid</h1>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="row" style={{ padding: '0 12px', fontSize: 12, color: 'var(--muted)' }}>
          <span className="live-dot" style={{ background: connected ? 'var(--primary)' : 'var(--danger)' }} />
          {connected ? 'live' : 'offline'}
        </div>
        <div style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: 12 }}>{user?.email}</div>
        <button className="ghost" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
      </aside>
      <main>{children}</main>
    </div>
  );
}
