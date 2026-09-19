// HTTP client for the MomoSwap launchpad API, called same-origin via /api
// (proxied by Vite in dev and a Vercel rewrite in production) because the
// upstream API sends no CORS headers.
//
// Everything money-moving in here only *builds* a transaction. Nothing in this
// file signs, sends, or holds funds — see lib/tx.ts for the pipeline.
import type {
  BuiltTx,
  ClaimKind,
  LaunchRow,
  LaunchpadConfig,
  LaunchpadPosition,
  WinnerProof,
} from './types';

const BASE = '/api/v1/launchpad';

interface Envelope {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

/** `T` describes the payload the endpoint returns alongside the envelope. */
async function request<T = Envelope>(path: string, init?: RequestInit): Promise<Envelope & T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new Error(`Could not reach the launchpad API (${path}). Check your connection.`);
  }
  let body: Envelope;
  try {
    body = (await res.json()) as Envelope;
  } catch {
    throw new Error(`The launchpad API returned a non-JSON response (${res.status}).`);
  }
  if (!res.ok || body.success === false) {
    throw new Error(body.error || `Launchpad API ${res.status} on ${path}`);
  }
  return body as Envelope & T;
}

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function fetchConfig(): Promise<LaunchpadConfig> {
  const body = await request('/config');
  const cfg = (body as { config?: LaunchpadConfig }).config;
  if (!cfg) throw new Error('Launchpad config missing from the response.');
  return cfg;
}

/**
 * Every pool.
 *
 * The live deployment ignores `limit`/`offset` and returns the whole set in one
 * response, so this is a single request rather than a page walk. `skipped` is how
 * many rows the server itself could not decode — surfaced so the radar can say so
 * instead of silently under-reporting.
 */
export async function fetchPools(
  status: 'all' | 'live' | 'upcoming' | 'graduated' | 'expired' = 'all',
): Promise<{ pools: LaunchRow[]; skipped: number }> {
  const body = await request(`/pools?status=${status}`);
  return {
    pools: (body as { pools?: LaunchRow[] }).pools ?? [],
    skipped: Number((body as { skipped?: number }).skipped ?? 0),
  };
}

export async function fetchPool(pubkey: string): Promise<LaunchRow> {
  const body = await request(`/pools/${pubkey}`);
  const pool = (body as { pool?: LaunchRow }).pool;
  if (!pool) throw new Error('Pool not found.');
  return pool;
}

/** A wallet's curve position, or null when it never bought on this pool.
 *  The route is pool-scoped: /pools/<pool>/position/<owner>. */
export async function fetchPosition(
  poolPubkey: string,
  owner: string,
): Promise<LaunchpadPosition | null> {
  const body = await request(`/pools/${poolPubkey}/position/${owner}`);
  return (body as { position?: LaunchpadPosition | null }).position ?? null;
}

/** Unclaimed creator fees sitting in the pool's creator_fee_vault, in UI COOK. */
export async function fetchPendingCreatorFees(pool: string): Promise<number> {
  const body = await request(`/creator-fees/${pool}`);
  return Number((body as { pendingCook?: number }).pendingCook ?? 0);
}

/** Merkle payout + proof for a Jackpot/Survivor settlement, or null if not a winner. */
export async function fetchWinnerProof(pool: string, owner: string): Promise<WinnerProof | null> {
  try {
    const body = await request(`/pools/${pool}/winner/${owner}`);
    const amount = (body as { amount?: string }).amount;
    const proof = (body as { proof?: number[][] }).proof;
    return amount && proof ? { amount, proof } : null;
  } catch {
    return null;
  }
}

// --- transaction builders (unsigned; the caller signs locally) ----------------

export async function buildBuyTx(args: {
  buyer: string;
  pool: string;
  paymentAmount: string; // base units, 9 decimals
  referrer?: string | null;
}): Promise<BuiltTx> {
  return request<BuiltTx>('/tx/buy', jsonPost(args));
}

export async function buildSellTx(args: {
  seller: string;
  pool: string;
  tokenShares: string; // base units, 6 decimals
  unwrap?: boolean;
}): Promise<BuiltTx> {
  return request<BuiltTx>('/tx/sell', jsonPost(args));
}

export async function buildClaimTx(args: {
  kind: ClaimKind;
  claimant: string;
  pool: string;
  amount?: string;
  proof?: number[][];
}): Promise<BuiltTx> {
  return request<BuiltTx>('/tx/claim', jsonPost(args));
}

export async function buildClaimCreatorFeesTx(args: {
  creator: string;
  pool: string;
  unwrap?: boolean;
}): Promise<BuiltTx> {
  return request<BuiltTx>('/tx/claim-creator-fees', jsonPost(args));
}
