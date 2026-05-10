import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveStream } from '../hooks/useLiveStream';
import Logo from './Logo';

const ICONS = {
  overview:    '◎',
  consumers:   '👥',
  connections: '⌬',
  consumption: '⚡',
  invoices:    '₨',
  alerts:      '⚠',
  usage:       '⚡',
  meters:      '⌬',
  billing:     '₨',
  profile:     '👤',
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { connected } = useLiveStream();
  const [open, setOpen] = useState(false);

  // close drawer on route change
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  // body scroll lock when drawer open (mobile)
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const adminLinks = [
    ['/admin',              'Overview',     ICONS.overview],
    ['/admin/consumers',    'Consumers',    ICONS.consumers],
    ['/admin/connections',  'Connections',  ICONS.connections],
    ['/admin/consumption',  'Consumption',  ICONS.consumption],
    ['/admin/billing',      'Invoices',     ICONS.invoices],
    ['/admin/alerts',       'Alerts',       ICONS.alerts],
  ];
  const userLinks = [
    ['/dashboard', 'My Usage',  ICONS.usage],
    ['/meters',    'My Meters', ICONS.meters],
    ['/billing',   'Billing',   ICONS.billing],
    ['/profile',   'Profile',   ICONS.profile],
  ];
  const links = user?.role === 'admin' ? adminLinks : userLinks;

  const initials = (user?.email || '?').slice(0, 1).toUpperCase();

  return (
    <div className="app-shell">
      {/* ── Header ── */}
      <header className="app-header">
        <button
          className="menu-btn"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          data-open={open}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="hamburger-icon"><span /><span /><span /></div>
        </button>

        <div className="brand" onClick={() => nav(user?.role === 'admin' ? '/admin' : '/dashboard')}
             style={{ cursor: 'pointer' }}>
          <Logo size={34} />
          <div>
            <div className="name">EcoGrid</div>
            <div className="tag">Smart Grid</div>
          </div>
        </div>

        <div className="center">
          <span className="live-pill">
            <span className="live-dot" style={{ background: connected ? 'var(--ok)' : 'var(--danger)' }} />
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
        </div>

        <div className="actions">
          {user ? (
            <>
              <span className="user-chip">
                <span className="avatar">{initials}</span>
                <span className="email-text">{user.email}</span>
              </span>
              <button className="ghost small" onClick={() => { logout(); nav('/login'); }}>
                Sign out
              </button>
            </>
          ) : (
            <button className="small" onClick={() => nav('/login')}>Sign in</button>
          )}
        </div>
      </header>

      {/* ── Hamburger drawer ── */}
      <div className={`drawer-backdrop ${open ? 'open' : ''}`}
           onClick={() => setOpen(false)} aria-hidden={!open} />
      <aside className={`drawer ${open ? 'open' : ''}`} role="dialog" aria-label="Main navigation">
        <div className="head">
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={30} />
            <div className="name" style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700 }}>EcoGrid</div>
          </div>
          <button className="close-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav>
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="spacer" />
        <div className="footer">
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <span className="live-dot" style={{ background: connected ? 'var(--ok)' : 'var(--danger)' }} />
            <span>{connected ? 'Live stream' : 'Offline'}</span>
          </div>
          {user && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user.email}</div>}
        </div>
      </aside>

      <main>{children}</main>
    </div>
  );
}
