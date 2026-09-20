// CookieSwap's verified-token registry.
//
// CookieSwap (cookieswap.fun) is the AMM front end for Cookie Chain, and its
// `/api/verify/tokens` endpoint publishes the tokens the ecosystem has actually
// vetted: project name, logo, and the socials to check them against. Unlike the
// launchpad API it sends `Access-Control-Allow-Origin: *`, so the browser reads
// it directly rather than through a proxy.
//
// This is the only place in the app that treats a symbol as trustworthy. Every
// launch on the radar looks identical otherwise, and a verified launch should
// not: it means a human looked at it.
export interface VerifiedToken {
  tokenMint: string;
  projectName?: string;
  symbol?: string;
  description?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  website?: string;
  x?: string;
  telegram?: string;
  discord?: string;
  ownerWallet?: string;
  verifiedAt?: string;
}

const ENDPOINT = 'https://cookieswap.fun/api/verify/tokens';

/** Public IPFS gateways rate-limit independently of each other, and verified
 *  logos are pinned as IPFS URLs. The two most-used gateways were both returning
 *  429 for a CID that Pinata served fine, so a single retry is worth having.
 *
 *  Ordered by measured reliability, NOT as a rotation: `cloudflare-ipfs.com`
 *  failed to connect at all and is deliberately absent, since hopping onto a dead
 *  gateway would waste the one retry the caller allows. */
const GATEWAYS = ['gateway.pinata.cloud', 'ipfs.io', 'dweb.link'];

/** The best gateway other than the one already in use, or `url` unchanged. */
export function alternateGateway(url: string): string {
  try {
    const u = new URL(url);
    if (!u.pathname.startsWith('/ipfs/')) return url;
    const next = GATEWAYS.find((g) => g !== u.hostname);
    if (!next) return url;
    u.hostname = next;
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Only `http`/`https` survive.
 *
 * Everything in this module is third-party data rendered straight into the DOM,
 * so a URL from it is untrusted input: `javascript:` in an `href` is script
 * execution, and `data:` can carry a document. Anything that is not plainly a
 * web link is dropped rather than escaped, because there is no useful case for
 * the alternatives here.
 */
export function safeUrl(url?: string | null): string | null {
  const v = (url ?? '').trim();
  if (v.length === 0) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A logo can only be rendered if it resolves to a real web URL. */
export function safeLogo(url?: string | null): string | null {
  return safeUrl(url);
}

/**
 * Verified tokens keyed by mint.
 *
 * Throws on network failure so the caller can decide to retry; an empty map is
 * a perfectly good answer (nothing is verified yet) and must not be treated as
 * an error.
 */
export async function fetchVerifiedTokens(): Promise<Map<string, VerifiedToken>> {
  const res = await fetch(ENDPOINT, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`CookieSwap returned ${res.status}`);
  const body = (await res.json()) as { tokens?: VerifiedToken[] };
  const map = new Map<string, VerifiedToken>();
  for (const t of body.tokens ?? []) {
    // Sanitise once at the boundary so every consumer gets clean data.
    if (t?.tokenMint) map.set(t.tokenMint, { ...t, logoUrl: safeLogo(t.logoUrl), bannerUrl: safeLogo(t.bannerUrl) });
  }
  return map;
}

/** The socials a verified token publishes, in the order worth showing.
 *  Every URL is scheme-checked; anything unsafe is silently dropped. */
export function verifiedLinks(t: VerifiedToken): Array<{ label: string; url: string }> {
  const candidates: Array<[string, string | undefined]> = [
    ['X', t.x],
    ['website', t.website],
    ['telegram', t.telegram],
    ['discord', t.discord],
  ];
  const out: Array<{ label: string; url: string }> = [];
  for (const [label, raw] of candidates) {
    const url = safeUrl(raw);
    if (url) out.push({ label, url });
  }
  return out;
}
