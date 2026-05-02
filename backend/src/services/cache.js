// backend/src/services/cache.js
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

/**
 * Delete one or more keys. Accepts exact keys or glob patterns (ending with *).
 *
 *   cacheDel('user:42:profile')
 *   cacheDel('user:42:profile', 'user:42:cons')
 *   cacheDel('admin:billing*')            ← pattern, uses SCAN (safe for prod)
 */
export async function cacheDel(...keys) {
  const r = getRedis(); if (!r) return;
  try {
    const toDelete = [];
    for (const k of keys.flat()) {
      if (k.includes('*')) {
        let cursor = '0';
        do {
          const [next, found] = await r.scan(cursor, 'MATCH', k, 'COUNT', 100);
          cursor = next;
          toDelete.push(...found);
        } while (cursor !== '0');
      } else {
        toDelete.push(k);
      }
    }
    if (toDelete.length) await r.del(toDelete);
  } catch {}
}

/**
 * Cache-aside helper — try cache, on miss call loader(), store and return result.
 *
 *   const rows = await withCache('admin:overview', 15, () => expensiveQuery());
 */
export async function withCache(key, ttlSec, loader) {
  const cached = await cacheGet(key);
  if (cached !== null) return cached;
  const fresh = await loader();
  if (fresh != null) await cacheSet(key, fresh, ttlSec);
  return fresh;
}