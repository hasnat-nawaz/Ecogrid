import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AdminOverview from './pages/AdminOverview.jsx';
import AdminConsumers from './pages/AdminConsumers.jsx';
import AdminBilling from './pages/AdminBilling.jsx';
import AdminAlerts from './pages/AdminAlerts.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import UserBilling from './pages/UserBilling.jsx';

function Protect({ role, children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/admin"           element={<Protect role="admin"><AdminOverview /></Protect>} />
      <Route path="/admin/consumers" element={<Protect role="admin"><AdminConsumers /></Protect>} />
      <Route path="/admin/billing"   element={<Protect role="admin"><AdminBilling /></Protect>} />
      <Route path="/admin/alerts"    element={<Protect role="admin"><AdminAlerts /></Protect>} />

      <Route path="/dashboard" element={<Protect><UserDashboard /></Protect>} />
      <Route path="/billing"   element={<Protect><UserBilling /></Protect>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
