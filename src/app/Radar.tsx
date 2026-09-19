import { useMemo } from 'react';
import { poolStats } from '../lib/curve';
import { formatCook, formatPrice, timeAgo } from '../lib/format';
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

export function Radar({ launches, newKeys, selectedPubkey, onSelect, demoMode, status, error, lastUpdated, onRefresh, onEnableDemo }: RadarProps) {
  const sorted = useMemo(() => {
    const rank = (p: LaunchRow) => (p.status === 'live' ? 0 : p.status === 'upcoming' ? 1 : 2);
    return [...launches].sort((a, b) => rank(a) - rank(b) || b.launchTs - a.launchTs);
  }, [launches]);

  const liveCount = sorted.filter((l) => l.status === 'live').length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Pane header */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-5 sm:px-8 pb-3">
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

      {error && <div className="mx-5 sm:mx-8 mb-3 alert-danger px-3.5 py-2 text-[11.5px]">{error}</div>}

      {/* Launch list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center px-6 py-16 text-center">
            <img src="/cooksnipe.png" alt="" className="w-16 h-16 rounded-full opacity-90" draggable={false} />
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
          return (
            <button
              key={p.pubkey}
              onClick={() => onSelect(p)}
              className={`w-full text-left hair-b transition-colors cursor-pointer ${
                selected ? 'bg-white' : 'hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-4 px-5 sm:px-8 py-4">
                <div
                  className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[11px] font-medium text-black/70"
                  style={{ backgroundColor: `hsl(${hueOf(p.pubkey)} 62% 78%)` }}
                >
                  {initials(p.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[14.5px] font-medium tracking-[-0.012em] truncate">{p.name}</span>
                    <span className="shrink-0 text-[11.5px] text-[color:var(--ink-faint)]">${p.symbol}</span>
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

      {/* Footer strip */}
      <div className="shrink-0 hair-t px-5 sm:px-8 py-2.5 text-[10.5px] text-[color:var(--ink-faint)] flex items-center justify-between">
        <span>{demoMode ? 'Simulated feed — for evaluation only' : 'MomoSwap launchpad · on-chain data'}</span>
        <span className="num">
          {sorted.length} launch{sorted.length === 1 ? '' : 'es'}
        </span>
      </div>
    </div>
  );
}
