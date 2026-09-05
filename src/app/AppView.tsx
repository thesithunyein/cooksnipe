import { useEffect, useMemo, useState } from 'react';
import { fetchConfig } from '../lib/api';
import { poolStats } from '../lib/curve';
import { timeAgo } from '../lib/format';
import type { PricePoint } from './BondingChart';
import { Portfolio } from './Portfolio';
import { Radar } from './Radar';
import { TokenDetail } from './TokenDetail';
import { useLaunches } from './useLaunches';

type Tab = 'radar' | 'portfolio';

function DetailHint() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-10 text-center">
      <div className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center text-[20px] text-white/40">
        ↗
      </div>
      <p className="mt-6 text-[14px] text-white/80">Select a launch to inspect it</p>
      <p className="mt-2 text-[12px] text-white/40 leading-relaxed max-w-[300px]">
        Curve stats, a live price chart, safety checks, and a simulated buy quote — all pulled from the
        MomoSwap launchpad.
      </p>
    </div>
  );
}

export function AppView() {
  const feed = useLaunches();
  const [tab, setTab] = useState<Tab>('radar');
  const [selectedPubkey, setSelectedPubkey] = useState<string | null>(null);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [tradeFeeBps, setTradeFeeBps] = useState(100);

  // Live launchpad config (fee schedule, defaults).
  useEffect(() => {
    let cancelled = false;
    fetchConfig()
      .then((cfg) => {
        if (!cancelled) setTradeFeeBps(cfg.tradeFeeBps);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => feed.launches.find((l) => l.pubkey === selectedPubkey) ?? null,
    [feed.launches, selectedPubkey],
  );

  // Reset the price history when switching tokens or toggling demo mode.
  useEffect(() => {
    setHistory([]);
  }, [selectedPubkey, feed.demoMode]);

  // Accumulate live price samples for the selected pool.
  useEffect(() => {
    if (!selected) return;
    const { price } = poolStats(selected);
    if (!(price > 0)) return;
    const t = Date.now() / 1000;
    setHistory((h) => {
      if (h.length === 0) return [{ time: t, price }];
      const last = h[h.length - 1];
      if (t - last.time < 1.5) return [...h.slice(0, -1), { time: t, price }];
      return [...h, { time: t, price }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.pubkey, selected?.tokensSold, selected?.paymentRaisedNet]);

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      {/* Top bar */}
      <header className="h-16 shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6">
        <button
          onClick={() => {
            window.location.hash = '';
          }}
          className="flex items-center gap-2 cursor-pointer"
        >
          <SynapseXMark />
          <span className="text-[15px] font-semibold tracking-tight">CookSnipe</span>
          <span className="text-[11px] text-white/40 hidden sm:inline">/ app</span>
        </button>

        <div className="flex items-center gap-3">
          <select
            value={feed.pollMs}
            onChange={(e) => feed.setPollMs(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded px-2.5 py-2 text-[11px] text-white/70 outline-none cursor-pointer"
            title="Poll interval"
          >
            <option value={3000} className="bg-black">3s</option>
            <option value={5000} className="bg-black">5s</option>
            <option value={10000} className="bg-black">10s</option>
            <option value={30000} className="bg-black">30s</option>
          </select>

          <button
            onClick={() => feed.setDemoMode(!feed.demoMode)}
            className={`text-[11px] px-4 py-2 rounded-full font-semibold cursor-pointer transition-colors ${
              feed.demoMode
                ? 'bg-purple-400/25 text-purple-300 border border-purple-400/40'
                : 'bg-white/5 text-white/60 border border-white/10 hover:text-white hover:bg-white/10'
            }`}
          >
            {feed.demoMode ? '● DEMO' : 'Demo mode'}
          </button>
        </div>
      </header>

      {/* Status banner */}
      {feed.demoMode && (
        <div className="shrink-0 bg-purple-500/15 border-b border-purple-500/20 px-6 py-2 text-[11px] text-purple-300 flex items-center gap-2">
          <span className="font-bold">DEMO MODE</span>
          <span>Simulated launches for evaluation. Real feed: {feed.status === 'error' ? 'unreachable' : 'live, quiet chain'}.</span>
        </div>
      )}
      {!feed.demoMode && feed.status === 'error' && (
        <div className="shrink-0 bg-red-500/15 border-b border-red-500/20 px-6 py-2 text-[11px] text-red-300">
          Launchpad API unreachable ({feed.error}). Try again later or switch to Demo mode.
        </div>
      )}
      {!feed.demoMode && feed.status === 'live' && (
        <div className="shrink-0 px-6 py-2 text-[11px] text-white/40 flex items-center gap-2.5 border-b border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3ddc84]" />
          Live feed · api.momoswap.fun{feed.lastUpdated ? ` · last poll ${timeAgo(Math.floor(feed.lastUpdated / 1000))}` : ''} ·{' '}
          {feed.launches.length} live launch{feed.launches.length === 1 ? '' : 'es'}
        </div>
      )}

      {/* Mobile tabs */}
      <div className="shrink-0 flex md:hidden border-b border-white/8">
        {(['radar', 'portfolio'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === 'portfolio') setSelectedPubkey(null);
            }}
            className={`flex-1 py-3 text-[11px] uppercase tracking-[0.18em] cursor-pointer ${
              tab === t ? 'text-white border-b-2 border-[#3ddc84]' : 'text-white/40'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Body — radar left, detail/portfolio right on desktop; single pane on mobile */}
      <div className="flex-1 min-h-0 grid md:grid-cols-2">
        <div className={`min-h-0 flex-col ${tab === 'radar' && !selected ? 'flex' : 'hidden'} md:flex`}>
          <Radar
            launches={feed.launches}
            newKeys={feed.newKeys}
            selectedPubkey={selectedPubkey}
            onSelect={(p) => setSelectedPubkey(p.pubkey)}
            demoMode={feed.demoMode}
            status={feed.status}
            error={feed.error}
            lastUpdated={feed.lastUpdated}
            onRefresh={feed.refresh}
          />
        </div>
        <div className={`min-h-0 flex-col ${selected || tab === 'portfolio' ? 'flex' : 'hidden'} md:flex md:border-l md:border-white/10`}>
          {selected ? (
            <TokenDetail
              pool={selected}
              history={history}
              tradeFeeBps={tradeFeeBps}
              onBack={() => setSelectedPubkey(null)}
            />
          ) : tab === 'portfolio' ? (
            <Portfolio launches={feed.launches} demoMode={feed.demoMode} />
          ) : (
            <DetailHint />
          )}
        </div>
      </div>
    </div>
  );
}

/** Small inline SynapseX mark for the app top bar. */
function SynapseXMark() {
  return (
    <svg viewBox="-50 -50 100 100" className="w-6 h-6 text-white" fill="currentColor" aria-hidden="true">
      <path d="M 1.5,23 L 1.5,33 C 1.5,38.5 6,43 11.5,43 L 16.5,43 C 22,43 26.5,38.5 26.5,33 Q 28,28 33,26.5 C 38.5,26.5 43,22 43,16.5 L 43,11.5 C 43,6 38.5,1.5 33,1.5 L 23,1.5 Q 12,12 1.5,23 Z" />
      <path d="M 1.5,23 L 1.5,33 C 1.5,38.5 6,43 11.5,43 L 16.5,43 C 22,43 26.5,38.5 26.5,33 Q 28,28 33,26.5 C 38.5,26.5 43,22 43,16.5 L 43,11.5 C 43,6 38.5,1.5 33,1.5 L 23,1.5 Q 12,12 1.5,23 Z" transform="rotate(90)" />
      <path d="M 1.5,23 L 1.5,33 C 1.5,38.5 6,43 11.5,43 L 16.5,43 C 22,43 26.5,38.5 26.5,33 Q 28,28 33,26.5 C 38.5,26.5 43,22 43,16.5 L 43,11.5 C 43,6 38.5,1.5 33,1.5 L 23,1.5 Q 12,12 1.5,23 Z" transform="rotate(180)" />
      <path d="M 1.5,23 L 1.5,33 C 1.5,38.5 6,43 11.5,43 L 16.5,43 C 22,43 26.5,38.5 26.5,33 Q 28,28 33,26.5 C 38.5,26.5 43,22 43,16.5 L 43,11.5 C 43,6 38.5,1.5 33,1.5 L 23,1.5 Q 12,12 1.5,23 Z" transform="rotate(270)" />
    </svg>
  );
}
