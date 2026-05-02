// backend/src/sockets/wsServer.js
import { WebSocketServer } from 'ws';
import { verifyToken } from '../middleware/auth.js';
import { createListener } from '../db/pool.js';
import { cacheDel } from '../services/cache.js';

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

  (async () => {
    const listener = await createListener();
    await listener.query('LISTEN ecogrid_reading');
    await listener.query('LISTEN ecogrid_alert');

    listener.on('notification', async (msg) => {
      const payload = safeJson(msg.payload);

      if (msg.channel === 'ecogrid_reading') {
        // Bust the consumption cache for whichever consumer owns this meter.
        // The consumer_id comes from the NOTIFY payload (add it in your trigger).
        // Falls back to busting all consumption keys if payload is minimal.
        if (payload?.consumer_id) {
          await cacheDel(`consumer:${payload.consumer_id}:consumption:24h`);
        } else {
          await cacheDel('consumer:*:consumption:24h');
        }
        // Overview kwh_today changes with every reading — bust it too
        await cacheDel('admin:overview');
      }

      if (msg.channel === 'ecogrid_alert') {
        // Bust alert caches immediately so the next poll shows the new alert
        await cacheDel('admin:alerts', 'admin:overview');
      }

      // Fan-out to all connected WebSocket clients (unchanged from original)
      const event = { type: msg.channel, payload };
      const json = JSON.stringify(event);
      wss.clients.forEach((c) => {
        if (c.readyState === 1) c.send(json);
      });
    });

    console.log('[ws] listening for ecogrid_reading & ecogrid_alert');
  })().catch((e) => console.error('[ws] listener failed', e));

  return wss;
}

function safeJson(s) { try { return JSON.parse(s); } catch { return s; } }