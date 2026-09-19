import { useId } from 'react';

/**
 * The CookSnipe mark.
 *
 * Inline rather than an <img> for two reasons: it inherits `currentColor`, so the
 * page inverts it on ink surfaces without a second file, and it is a vector at
 * 26px instead of a 512px raster being downscaled in the header.
 *
 * The bite and the chips are knocked out of the silhouette with a mask, so the
 * mark works on paper, on ink and in a 16px tab. Public/mark.svg is the same
 * shape for everything outside React — keep the two in step.
 */
export function Mark({ size = 26, className }: { size?: number; className?: string }) {
  // useId gives ":r0:"; colons are awkward inside url(#…), so strip them.
  const mask = `cooksnipe-mark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <defs>
        <mask id={mask}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="45" cy="9.5" r="9" fill="#000" />
          <circle cx="53.7" cy="16.8" r="8.5" fill="#000" />
          <circle cx="56.6" cy="27.7" r="6.5" fill="#000" />
          <circle cx="20" cy="21" r="4.2" fill="#000" />
          <circle cx="40" cy="45" r="3.2" fill="#000" />
          <circle cx="20" cy="43" r="2.6" fill="#000" />
        </mask>
      </defs>
      <circle cx="32" cy="32" r="28" fill="currentColor" mask={`url(#${mask})`} />
    </svg>
  );
}
