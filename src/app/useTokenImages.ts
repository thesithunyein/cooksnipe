import { useEffect, useState } from 'react';
import { tokenImage } from '../lib/tokenMeta';
import type { LaunchRow } from '../lib/types';

/**
 * Official logo image per pool pubkey, resolved from each launch's own
 * metadata uri.
 *
 * Deliberately silent and non-blocking, exactly like `useVerified`: the radar
 * works fine with initials underneath, so this only ever adds decoration and
 * must never surface an error or delay a row. Resolution happens per uri once
 * per session (tokenMeta caches), so re-renders from polling are free.
 */
export function useTokenImages(launches: LaunchRow[]): Map<string, string> {
  const [images, setImages] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let alive = true;

    // Rows without a uri resolve to null once inside tokenImage's cache, so
    // the fan-out below never repeats work for them either.
    const missing = launches.filter((p) => p.uri && !images.has(p.pubkey));
    if (missing.length === 0) return;

    (async () => {
      const pairs = await Promise.all(
        missing.map(async (p) => [p.pubkey, await tokenImage(p.uri)] as const),
      );
      if (!alive) return;
      const next = new Map(images);
      let added = 0;
      for (const [key, url] of pairs) {
        next.set(key, url ?? '');
        if (url) added += 1;
      }
      // Only re-render when something actually resolved; '' means "no image,
      // don't retry", which is cached but not worth a render.
      if (added > 0) setImages(next);
    })();

    return () => {
      alive = false;
    };
  }, [launches, images]);

  return images;
}
