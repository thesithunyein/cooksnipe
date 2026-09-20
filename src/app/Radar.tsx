import { useMemo, useState } from 'react';
import { poolStats } from '../lib/curve';
import { Mark } from './Mark';
import { useTokenImages } from './useTokenImages';
import { formatCook, formatPrice, timeAgo } from '../lib/format';
import { alternateGateway, type VerifiedToken } from '../lib/cookieswap';
import type { LaunchRow } from '../lib/types';

interface RadarProps {
  launches: LaunchRow[];
  newKeys: Set<string>;
  selectedPubkey: string | null;
  onSelect: (p: LaunchRow) => void;
  demoMode: boolean;
  status: 'connecting' | 'live' | 'error';
  error: string | null;
  lastUpdated: number | null;
  onRefresh: () => void;
  onEnableDemo: () => void;
  /** CookieSwap's verified tokens by mint. Decoration: may be empty. */
  verified?: Map<string, VerifiedToken>;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/** Obvious throwaway launches ("test", "TEST", "$FRND" frontend probes…) that
 *  would otherwise crowd the feed judges and traders see. Matched on symbol —
 *  case-insensitive, word-boundaried so "preTEST" style names survive. */
const TEST_SYMBOL = /^(test|tests|testing|frnd|frontend|dummy|demo|tmp|temp|sample)$/i;

function isTestLaunch(p: LaunchRow): boolean {
  return TEST_SYMBOL.test(p.symbol || '') || TEST_SYMBOL.test(p.name || '');
}

export function Radar({ launches, newKeys, selectedPubkey, onSelect, demoMode, status, error, lastUpdated, onRefresh, onEnableDemo, verified }: RadarProps) {
  // Hide obvious test launches by default; the toggle is honest about what it does.
  const [showTests, setShowTests] = useState(false);

  // Official per-pool logos, resolved from each launch's own metadata uri.
  const tokenImages = useTokenImages(launches);

  const testCount = useMemo(() => launches.filter(isTestLaunch).length, [launches]);

  const sorted = useMemo(() => {
    const visible = showTests ? launches : launches.filter((p) => !isTestLaunch(p));
    const rank = (p: LaunchRow) => (p.status === 'live' ? 0 : p.status === 'upcoming' ? 1 : 2);
    return [...visible].sort((a, b) => rank(a) - rank(b) || b.launchTs - a.launchTs);
  }, [launches, showTests]);

  const liveCount = sorted.filter((l) => l.status === 'live').length;
  const verifiedCount = useMemo(
    () => (verified ? sorted.filter((l) => verified.has(l.tokenMint)).length : 0),
    [sorted, verified],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Pane header — the landing's eyebrow row, carrying the feed's state. */}
      <div className="shrink-0 flex items-center justify-between gap-4 gutter pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              status === 'live' ? '' : status === 'error' ? 'bg-[color:var(--danger)]' : 'animate-pulse bg-[color:var(--warn)]'
            }`}
            style={status === 'live' ? { background: 'var(--live)' } : undefined}
          />
          <span className="label truncate">
            {status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Feed error' : demoMode ? 'Demo feed' : 'Live feed'}
          </span>
          {status === 'live' && !demoMode && sorted.length > 0 && (
            <span className="text-[11px] text-[color:var(--ink-faint)] num">
              · {liveCount} live / {sorted.length} total
            </span>
          )}
          {verifiedCount > 0 && (
            <span className="text-[11px] num text-[color:var(--live)]">
              · {verifiedCount} verified
            </span>
          )}
          {testCount > 0 && (
            <button
              onClick={() => setShowTests((v) => !v)}
              className="text-[10.5px] num transition-colors cursor-pointer text-[color:var(--ink-faint)] hover:text-[color:var(--ink)]"
              title={showTests ? 'Hide test launches' : 'Show test launches'}
            >
              {showTests ? 'hiding nothing' : `+ ${testCount} test`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {lastUpdated != null && (
            <span className="text-[10.5px] text-[color:var(--ink-faint)] num">{timeAgo(Math.floor(lastUpdated / 1000))}</span>
          )}
          <button onClick={onRefresh} className="text-[10.5px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] transition-colors cursor-pointer">
            refresh
          </button>
        </div>
      </div>

      {error && <div className="gutter-x mb-3 alert-danger px-3.5 py-2 text-[12px]">{error}</div>}

      {/* Launch list — full bleed rows on hairlines, the landing's rule weight. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center px-6 py-16 text-center">
            <Mark size={64} className="opacity-90" />
            <p className="mt-5 text-[15px] tracking-[-0.012em]">
              {status === 'error' ? 'Radar offline' : demoMode ? 'Demo feed starting…' : 'Radar is quiet'}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed max-w-[38ch] text-[color:var(--ink-soft)]">
              {status === 'error'
                ? 'Could not reach the MomoSwap launchpad API. It usually comes back — try a refresh.'
                : demoMode
                  ? 'Spawning simulated launches…'
                  : 'The launchpad is live and polling — no new launches on Cookie Chain right now.'}
            </p>
            {!demoMode && status !== 'error' && (
              <button onClick={onEnableDemo} className="btn btn-ghost btn-sm mt-6">
                See it with a demo feed
              </button>
            )}
          </div>
        )}

        {sorted.map((p) => {
          const isNew = newKeys.has(p.pubkey);
          const { price, progress, raised } = poolStats(p);
          const selected = p.pubkey === selectedPubkey;
          const v = verified?.get(p.tokenMint);
          const metaUrl = tokenImages.get(p.pubkey) || undefined;
          return (
            <button
              key={p.pubkey}
              onClick={() => onSelect(p)}
              className={`w-full text-left hair-b transition-colors cursor-pointer ${
                selected ? 'bg-white' : 'hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-4 gutter py-4">
                {/* Three layers, best source wins: the pool's own metadata
                    image (creator-set at launch), CookieSwap's verified logo
                    on top when it has vetted the mint, and the generated
                    initials underneath so any broken URL just falls back
                    rather than leaving a hole in the row. */}
                <div className="relative w-10 h-10 shrink-0">
                  <div
                    className="absolute inset-0 rounded-full flex items-center justify-center text-[11px] font-medium text-black/70"
                    style={{ backgroundColor: `hsl(${hueOf(p.pubkey)} 62% 78%)` }}
                  >
                    {initials(p.name)}
                  </div>
                  {metaUrl && !v?.logoUrl && (
                    <img
                      src={metaUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 w-10 h-10 rounded-full object-cover bg-white hair"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.retried) {
                          img.style.display = 'none';
                          return;
                        }
                        img.dataset.retried = '1';
                        const next = alternateGateway(img.src);
                        if (next === img.src) img.style.display = 'none';
                        else img.src = next;
                      }}
                    />
                  )}
                  {v?.logoUrl && (
                    <img
                      src={v.logoUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 w-10 h-10 rounded-full object-cover bg-white hair"
                      onError={(e) => {
                        // One hop to another gateway, then give up and let the
                        // generated initials underneath show through.
                        const img = e.currentTarget;
                        if (img.dataset.retried) {
                          img.style.display = 'none';
                          return;
                        }
                        img.dataset.retried = '1';
                        const next = alternateGateway(img.src);
                        if (next === img.src) img.style.display = 'none';
                        else img.src = next;
                      }}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[14.5px] font-medium tracking-[-0.012em] truncate">{p.name}</span>
                    <span className="shrink-0 text-[11.5px] text-[color:var(--ink-faint)]">${p.symbol}</span>
                    {v && (
                      <span
                        className="chip chip-live shrink-0"
                        title={`Verified by CookieSwap${v.projectName ? ` · ${v.projectName}` : ''}`}
                      >
                        verified
                      </span>
                    )}
                    {isNew && <span className="chip chip-ink shrink-0">new</span>}
                    {p.antiSnipe && p.status === 'live' && (
                      <span className="chip chip-warn shrink-0 hidden sm:inline-flex">anti-snipe</span>
                    )}
                    {p.status === 'graduated' && <span className="chip shrink-0">graduated</span>}
                    {p.status === 'expired' && <span className="chip chip-warn shrink-0">expired</span>}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] num">
                    <span className="text-[12.5px]">{formatPrice(price)}</span>
                    <span className="text-[color:var(--ink-faint)]">COOK</span>
                    <span className="text-[color:var(--rule)]">·</span>
                    <span className="text-[color:var(--ink-soft)]">
                      {raised > 0 ? `${formatCook(String(Math.round(raised * 1e9)))} COOK raised` : 'no sales yet'}
                    </span>
                    <span className="text-[color:var(--rule)]">·</span>
                    <span className="text-[color:var(--ink-soft)]">{Number(p.participantCount || 0).toLocaleString()} buyers</span>
                  </div>

                  <div className="mt-2.5 bar">
                    <i style={{ width: `${Math.max(2, progress)}%` }} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/*
        No footer strip of its own any more: the shell wears the landing's footer,
        and the live/total counts already sit in the eyebrow row above. Two
        stacked footers read as a mistake.
      */}
    </div>
  );
}
