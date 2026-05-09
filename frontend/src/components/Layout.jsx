import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveStream } from '../hooks/useLiveStream';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { connected } = useLiveStream();

  const adminLinks = [
    ['/admin',              'System Overview', '◎'],
    ['/admin/consumers',    'Consumers',       '👥'],
    ['/admin/connections',  'Connections',     '⌬'],
    ['/admin/consumption',  'Consumption',     '⚡'],
    ['/admin/billing',      'Invoices',        '₨'],
    ['/admin/alerts',       'Alerts',          '⚠'],
  ];
  const userLinks = [
    ['/dashboard', 'My Usage',  '⚡'],
    ['/meters',    'My Meters', '⌬'],
    ['/billing',   'Billing',   '₨'],
    ['/profile',   'Profile',   '👤'],
  ];
  const links = user?.role === 'admin' ? adminLinks : userLinks;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">⚡</div>
          <div>
            <div className="name">EcoGrid</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Smart Grid Console</div>
          </div>
        </div>
        {links.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="row" style={{ padding: '0 12px', fontSize: 12, color: 'var(--muted)' }}>
          <span className="live-dot" style={{ background: connected ? 'var(--ok)' : 'var(--danger)' }} />
          {connected ? 'live' : 'offline'}
        </div>
        <div className="footer">{user?.email}</div>
        <button className="ghost" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
      </aside>
      <main>{children}</main>
    </div>
  );
}
