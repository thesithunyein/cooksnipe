import { useEffect, useMemo, useState } from 'react';
import { fetchConfig } from '../lib/api';
import { poolStats } from '../lib/curve';
import type { PricePoint } from './BondingChart';
import { Portfolio } from './Portfolio';
import { Radar } from './Radar';
import { TokenDetail } from './TokenDetail';
import { useLaunches } from './useLaunches';

type Tab = 'radar' | 'portfolio';

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

  const openPortfolio = () => {
    setSelectedPubkey(null);
    setTab('portfolio');
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      {/* Top bar */}
      <header className="h-16 shrink-0 border-b border-white/10 bg-black flex items-center justify-between px-4 sm:px-6">
        <button
          onClick={() => {
            window.location.hash = '';
          }}
          className="flex items-center gap-2.5 cursor-pointer"
          title="Back to landing"
        >
          <CrosshairMark />
          <span className="text-[15px] font-semibold tracking-tight">CookSnipe</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Radar / Portfolio switch — works on desktop and mobile */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-0.5">
            <button
              onClick={() => {
                setTab('radar');
                setSelectedPubkey(null);
              }}
              className={`px-4 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                tab === 'radar' ? 'bg-white text-black' : 'text-white/55 hover:text-white'
              }`}
            >
              Radar
            </button>
            <button
              onClick={openPortfolio}
              className={`px-4 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                tab === 'portfolio' ? 'bg-white text-black' : 'text-white/55 hover:text-white'
              }`}
            >
              Portfolio
            </button>
          </div>

          {tab === 'radar' && !selected && (
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
          )}

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

      {/* Single status line — error banner only when something is actually wrong */}
      {feed.demoMode && (
        <div className="shrink-0 bg-purple-500/15 border-b border-purple-500/20 px-6 py-2 text-[11px] text-purple-300 flex items-center gap-2">
          <span className="font-bold">DEMO MODE</span>
          <span className="text-purple-300/80">Simulated launches — for evaluation only.</span>
        </div>
      )}
      {!feed.demoMode && feed.status === 'error' && (
        <div className="shrink-0 bg-red-500/15 border-b border-red-500/20 px-6 py-2 text-[11px] text-red-300">
          Launchpad API unreachable ({feed.error}). Try again later or switch to Demo mode.
        </div>
      )}

      {/* Body */}
      {tab === 'portfolio' && !selected ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <Portfolio launches={feed.launches} demoMode={feed.demoMode} />
        </div>
      ) : selected ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <TokenDetail
            pool={selected}
            history={history}
            tradeFeeBps={tradeFeeBps}
            onBack={() => setSelectedPubkey(null)}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
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
            onEnableDemo={() => feed.setDemoMode(true)}
          />
        </div>
      )}
    </div>
  );
}

/** Crosshair/radar mark matching the CookSnipe brand. */
function CrosshairMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#3ddc84]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    </svg>
  );
}
