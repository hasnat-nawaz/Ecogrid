import Redis from 'ioredis';
import 'dotenv/config';

let client = null;

export function getRedis() {
  if (client) return client;
  if (!process.env.REDIS_URL) {
    console.warn('[redis] REDIS_URL not set — caching disabled');
    return null;
  }
  client = new Redis(process.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 2 });
  client.on('error', (e) => console.warn('[redis]', e.message));
  return client;
}

export async function cacheGet(key) {
  const r = getRedis(); if (!r) return null;
  try { const v = await r.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}

export async function cacheSet(key, value, ttlSec = 30) {
  const r = getRedis(); if (!r) return;
  try { await r.set(key, JSON.stringify(value), 'EX', ttlSec); } catch {}
}

export async function cacheDel(prefix) {
  const r = getRedis(); if (!r) return;
  try {
    const keys = await r.keys(`${prefix}*`);
    if (keys.length) await r.del(keys);
  } catch {}
}
