/** Number formatting helpers for COOK amounts, prices, addresses, and times. */

/** Format a base-units COOK amount (9 decimals) as a compact UI string. */
export function formatCook(raw: string, decimals = 9): string {
  const n = Number(BigInt(raw)) / 10 ** decimals;
  return compact(n);
}

/** Compact human number: 1.2K / 34.5K / 1.23M — no giant digit walls. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Price formatting with adaptive precision. */
export function formatPrice(p: number): string {
  if (p === 0) return '0';
  if (p < 0.0001) return p.toExponential(2);
  if (p < 1) return p.toFixed(6);
  if (p < 1000) return p.toFixed(4);
  return compact(p);
}

/** Truncate a Solana-style address: head…tail. */
export function shortAddr(a: string, head = 4, tail = 4): string {
  if (!a) return '';
  if (a.length <= head + tail + 1) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

/** Seconds-based timestamp -> "3m ago" / "2h ago" / "5d ago". */
export function timeAgo(tsSec: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - tsSec);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Epoch seconds -> locale time string. */
export function formatTime(tsSec: number): string {
  return new Date(tsSec * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Percent with one decimal. */
export function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}