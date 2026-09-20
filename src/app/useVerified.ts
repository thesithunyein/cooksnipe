import { useEffect, useState } from 'react';
import { fetchVerifiedTokens, type VerifiedToken } from '../lib/cookieswap';

/**
 * CookieSwap's verified tokens, loaded once.
 *
 * Deliberately silent and non-blocking: this only decorates the radar, so a
 * failure must never surface as a feed error or hold up the launches. One retry
 * a minute is enough for something that changes when a project gets vetted.
 */
export function useVerified(): Map<string, VerifiedToken> {
  const [verified, setVerified] = useState<Map<string, VerifiedToken>>(() => new Map());

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    const load = async () => {
      try {
        const map = await fetchVerifiedTokens();
        if (alive) setVerified(map);
      } catch {
        /* decoration only — the radar keeps working without it */
      }
    };

    load();
    timer = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return verified;
}
