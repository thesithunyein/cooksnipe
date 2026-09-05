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

export function Radar({ launches, newKeys, selectedPubkey, onSelect, demoMode, status, error, lastUpdated, onRefresh }: RadarProps) {
  const sorted = useMemo(() => {
    const rank = (p: LaunchRow) => (p.status === 'live' ? 0 : p.status === 'upcoming' ? 1 : 2);
    return [...launches].sort((a, b) => rank(a) - rank(b) || b.launchTs - a.launchTs);
  }, [launches]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Pane header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'live' ? 'bg-[#3ddc84]' : status === 'error' ? 'bg-red-500' : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">
            {status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Feed error' : demoMode ? 'Demo feed' : 'Live feed'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated != null && <span className="text-[10px] text-white/30">{timeAgo(Math.floor(lastUpdated / 1000))}</span>}
          <button
            onClick={onRefresh}
            className="text-[10px] text-white/50 hover:text-white transition-colors cursor-pointer"
            title="Refresh now"
          >
            ⟳ refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 px-3.5 py-2.5 rounded border border-red-500/30 bg-red-500/10 text-[11px] text-red-300">
          {error}
        </div>
      )}

      {/* Launch list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="text-[13px] text-white/60 mb-2">
              {status === 'error'
                ? 'Could not reach the MomoSwap launchpad API.'
                : demoMode
                  ? 'Demo feed starting…'
                  : 'No live launches on Cookie Chain right now.'}
            </p>
            {!demoMode && status !== 'error' && (
              <p className="text-[11px] text-white/35 leading-relaxed">
                The launchpad is live and polling every few seconds — the chain is just quiet.
                <br />
                Flip on <span className="text-white/60">Demo mode</span> (top right) to see the radar with simulated launches.
              </p>
            )}
          </div>
        )}

        {sorted.map((p) => {
          const selected = p.pubkey === selectedPubkey;
          const isNew = newKeys.has(p.pubkey);
          const { price, progress, raised } = poolStats(p);
          return (
            <button
              key={p.pubkey}
              onClick={() => onSelect(p)}
              className={`w-full text-left border-l-2 transition-colors cursor-pointer ${
                selected ? 'bg-white/[0.05] border-l-[#3ddc84]' : 'border-l-transparent hover:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center gap-4 px-6 py-4">
                <div
                  className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-black"
                  style={{ backgroundColor: `hsl(${hueOf(p.pubkey)} 70% 65%)` }}
                >
                  {initials(p.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[14px] font-semibold text-white truncate">{p.name}</span>
                    <span className="shrink-0 text-[11px] text-white/40">${p.symbol}</span>
                    {isNew && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-[#3ddc84]/20 text-[#3ddc84] font-bold">
                        NEW
                      </span>
                    )}
                    {p.antiSnipe && p.status === 'live' && (
                      <span className="hidden sm:inline shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 font-semibold">
                        ANTI-SNIPE
                      </span>
                    )}
                    {p.status === 'graduated' && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-semibold">
                        GRADUATED
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
                    <span className="text-[12px] text-white">{formatPrice(price)}</span>
                    <span className="text-white/35">COOK</span>
                    <span className="text-white/15">·</span>
                    <span className="text-white/50">
                      {raised > 0 ? `${formatCook(String(Math.round(raised * 1e9)))} COOK raised` : 'no sales yet'}
                    </span>
                    <span className="text-white/15">·</span>
                    <span className="text-white/50">{Number(p.participantCount || 0).toLocaleString()} buyers</span>
                  </div>

                  <div className="mt-2.5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${progress >= 99 ? 'bg-[#3ddc84]' : 'bg-[#3ddc84]/75'}`}
                      style={{ width: `${Math.max(2, progress)}%` }}
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer strip */}
      <div className="shrink-0 px-6 py-2.5 border-t border-white/8 text-[10px] text-white/30 flex items-center justify-between">
        <span>{demoMode ? 'Simulated feed — for evaluation only' : 'MomoSwap launchpad · on-chain data'}</span>
        <span>
          {sorted.length} launch{sorted.length === 1 ? '' : 'es'}
        </span>
      </div>
    </div>
  );
}
