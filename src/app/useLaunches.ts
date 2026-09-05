import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPools } from '../lib/api';
import { advanceDemo, seedDemo } from '../lib/demo';
import type { LaunchRow } from '../lib/types';

export type FeedStatus = 'connecting' | 'live' | 'error';

export function useLaunches() {
  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [pollMs, setPollMs] = useState(5000);
  const [demoMode, setDemoMode] = useState(false);
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const knownKeys = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const pools = await fetchPools('all');
      const fresh = new Set<string>();
      for (const p of pools) {
        if (!firstLoad.current && !knownKeys.current.has(p.pubkey)) fresh.add(p.pubkey);
        knownKeys.current.add(p.pubkey);
      }
      firstLoad.current = false;
      setNewKeys(fresh);
      setLaunches(pools);
      setStatus('live');
      setError(null);
      setLastUpdated(Date.now());
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'failed to reach launchpad API');
    }
  }, []);

  // Real feed polling
  useEffect(() => {
    if (demoMode) return;
    refresh();
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
  }, [demoMode, pollMs, refresh]);

  // Demo feed
  useEffect(() => {
    if (!demoMode) {
      setLaunches([]);
      knownKeys.current = new Set();
      firstLoad.current = true;
      return;
    }
    setLaunches(seedDemo());
    const id = window.setInterval(() => setLaunches((prev) => advanceDemo(prev)), 2500);
    return () => window.clearInterval(id);
  }, [demoMode]);

  return { launches, status, error, lastUpdated, pollMs, setPollMs, demoMode, setDemoMode, newKeys, refresh };
}
