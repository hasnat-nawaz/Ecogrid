import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('ecogrid_user');
    if (raw) setUser(JSON.parse(raw));
    setReady(true);
  }, []);

  async function login(email, password) {
    const { token, user } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('ecogrid_token', token);
    localStorage.setItem('ecogrid_user', JSON.stringify(user));
    setUser(user);
    return user;
  }

  async function register(email, password) {
    const { token, user } = await api('/api/auth/register', { method: 'POST', body: { email, password } });
    localStorage.setItem('ecogrid_token', token);
    localStorage.setItem('ecogrid_user', JSON.stringify(user));
    setUser(user);
    return user;
  }

  function logout() {
    localStorage.removeItem('ecogrid_token');
    localStorage.removeItem('ecogrid_user');
    setUser(null);
  }

  return <Ctx.Provider value={{ user, ready, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
