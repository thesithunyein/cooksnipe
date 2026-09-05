// HTTP client for the MomoSwap launchpad API, called same-origin via /api
// (proxied by Vite in dev and a Vercel rewrite in production) because the
// upstream API sends no CORS headers.
import type { LaunchRow, LaunchpadConfig, LaunchpadPosition } from './types';

const BASE = '/api/v1/launchpad';

interface ApiBody {
  success: boolean;
  data?: unknown;
  error?: string;
}

async function getBody(path: string): Promise<ApiBody> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as ApiBody;
}

export async function fetchConfig(): Promise<LaunchpadConfig> {
  const body = await getBody('/config');
  if (!body.success) throw new Error(body.error || 'config request failed');
  const cfg = (body as unknown as { config?: LaunchpadConfig }).config ?? (body.data as LaunchpadConfig | undefined);
  if (!cfg) throw new Error('config missing in response');
  return cfg;
}

export async function fetchPools(status: 'all' | 'live' | 'upcoming' | 'graduated' = 'all'): Promise<LaunchRow[]> {
  const body = await getBody(`/pools?status=${status}&limit=100`);
  if (!body.success) throw new Error(body.error || 'pools request failed');
  const pools =
    (body as unknown as { pools?: LaunchRow[] }).pools ??
    ((body.data as { pools?: LaunchRow[] } | undefined)?.pools ?? []);
  return pools ?? [];
}

export async function fetchPosition(poolPubkey: string, owner: string): Promise<LaunchpadPosition | null> {
  try {
    const body = await getBody(`/position/${poolPubkey}/${owner}`);
    if (!body.success) return null;
    const pos =
      (body as unknown as { position?: LaunchpadPosition | null }).position ??
      ((body.data as LaunchpadPosition | null | undefined) ?? null);
    return pos ?? null;
  } catch {
    return null; // no position in this pool
  }
}