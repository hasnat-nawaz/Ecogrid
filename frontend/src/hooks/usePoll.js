import { useEffect, useRef, useState } from 'react';

/**
 * usePoll(fetcher, intervalMs)
 *   Runs `fetcher` immediately, then every `intervalMs` ms.
 *   Returns { data, error, loading, refresh }.
 *
 *   Safe by default: if a fetch throws we keep the last good `data`.
 */
export function usePoll(fetcher, intervalMs = 3000, deps = []) {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fetcher);
  fnRef.current = fetcher;

  async function tick() {
    try {
      const x = await fnRef.current();
      setData(x);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => { if (alive) await tick(); })();
    const id = setInterval(() => { if (alive) tick(); }, intervalMs);
    return () => { alive = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refresh: tick };
}
