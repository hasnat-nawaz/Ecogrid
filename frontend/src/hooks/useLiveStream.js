import { useEffect, useRef, useState } from 'react';
import { WS_BASE } from '../lib/api';

export function useLiveStream() {
  const [last, setLast] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('ecogrid_token');
    if (!token) return;
    const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try { setLast(JSON.parse(e.data)); } catch {}
    };
    return () => ws.close();
  }, []);

  return { last, connected };
}
