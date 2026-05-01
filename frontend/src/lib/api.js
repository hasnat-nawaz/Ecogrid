const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function tokenHeader() {
  const t = localStorage.getItem('ecogrid_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const API_BASE = API;
export const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';
