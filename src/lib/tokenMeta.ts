// Each launch's official logo comes from the pool's own `uri` field: an
// ipfs:// metadata JSON the creator set at launch. CookieSwap's registry only
// covers tokens it has vetted, so this is what puts a real image on the other
// rows instead of generated initials.
//
// The image URL is still untrusted third-party data: it goes through the same
// scheme guard as CookieSwap's logos, so `javascript:` or `data:` can never
// reach an <img src>.

import { safeUrl, alternateGateway } from './cookieswap';

const GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
const TIMEOUT_MS = 12_000;

/** ipfs:// paths become gateway URLs; everything else passes through. */
export function ipfsToHttp(url: string): string {
  const v = url.trim();
  if (v.toLowerCase().startsWith('ipfs://')) return GATEWAY + v.slice(7);
  return v;
}

/**
 * The image URL a metadata document advertises, or null when it advertises
 * nothing safe to render. One retry through another gateway covers the public
 * gateways' habit of rate-limiting a CID one at a time.
 */
async function imageFromUri(uri: string): Promise<string | null> {
  const tryGateway = async (url: string): Promise<string | null> => {
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`metadata ${res.status}`);
    const body = (await res.json()) as { image?: string; properties?: { image?: string } };
    const raw = body.image ?? body.properties?.image;
    if (!raw) return null;
    return safeUrl(ipfsToHttp(raw));
  };

  const first = ipfsToHttp(uri);
  try {
    return await tryGateway(first);
  } catch {
    const next = alternateGateway(first);
    if (next === first) return null;
    try {
      return await tryGateway(next);
    } catch {
      return null;
    }
  }
}

// Resolved once per uri and remembered for the session: the radar re-renders
// every poll, and re-fetching metadata each time would hammer the gateway for
// URLs that cannot change.
const cache = new Map<string, Promise<string | null>>();

export function tokenImage(uri: string | undefined | null): Promise<string | null> {
  const key = (uri ?? '').trim();
  if (!key) return Promise.resolve(null);
  let p = cache.get(key);
  if (!p) {
    p = imageFromUri(key).catch(() => null);
    cache.set(key, p);
  }
  return p;
}
