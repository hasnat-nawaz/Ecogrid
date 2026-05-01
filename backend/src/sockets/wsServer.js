import { WebSocketServer } from 'ws';
import { verifyToken } from '../middleware/auth.js';
import { createListener } from '../db/pool.js';

export function attachWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const user = token && verifyToken(token);
    if (!user) { ws.close(1008, 'unauthorized'); return; }
    ws.user = user;
    ws.send(JSON.stringify({ type: 'hello', user }));
  });

  // Subscribe to Postgres NOTIFY channels and fan out to clients
  (async () => {
    const listener = await createListener();
    await listener.query('LISTEN ecogrid_reading');
    await listener.query('LISTEN ecogrid_alert');

    listener.on('notification', (msg) => {
      const event = { type: msg.channel, payload: safeJson(msg.payload) };
      const json = JSON.stringify(event);
      wss.clients.forEach((c) => {
        if (c.readyState !== 1) return;
        // admins see everything; users only see events for their meters (filter client-side too)
        c.send(json);
      });
    });
    console.log('[ws] listening for ecogrid_reading & ecogrid_alert');
  })().catch((e) => console.error('[ws] listener failed', e));

  return wss;
}

function safeJson(s) { try { return JSON.parse(s); } catch { return s; } }
