import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { fetchConfig } from '../lib/api';
import { COOKIE_EXPLORER } from '../lib/chain';
import { poolStats } from '../lib/curve';
import type { PricePoint } from './BondingChart';
import { Claims } from './Claims';
import { Portfolio } from './Portfolio';
import { Radar } from './Radar';
import { TokenDetail } from './TokenDetail';
import { useLaunches } from './useLaunches';
import { useWallet } from './useWallet';
import { WalletButton } from './WalletButton';

type Tab = 'radar' | 'portfolio' | 'claims';

export function AppView() {
  const feed = useLaunches();
  const wallet = useWallet();
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

  const goTab = (next: Tab) => {
    setTab(next);
    setSelectedPubkey(null);
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      {/* Top bar */}
      {/* Wraps to two rows on narrow screens rather than squeezing the tabs into
          each other — a shrunk flex item keeps its padding and overflows its text. */}
      <header className="shrink-0 border-b border-white/10 bg-black flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6 sm:h-16 sm:py-0">
        <button
          onClick={() => goTab('radar')}
          className="flex items-center gap-2.5 cursor-pointer min-w-0"
          title="CookSnipe"
        >
          <img
            src="/cooksnipe.png"
            alt="CookSnipe"
            className="w-9 h-9 rounded-full ring-1 ring-white/15 shadow-[0_0_22px_rgba(255,60,110,0.35)]"
            draggable={false}
          />
          <span className="text-[15px] font-semibold tracking-tight hidden sm:inline">CookSnipe</span>
        </button>

        <div className="flex items-center gap-3 min-w-0 flex-wrap justify-end">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-0.5 shrink-0">
            {(
              [
                ['radar', 'Radar'],
                ['portfolio', 'Portfolio'],
                ['claims', 'Claims'],
              ] as Array<[Tab, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => goTab(id)}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  tab === id ? 'bg-white text-black' : 'text-white/55 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'radar' && !selected && (
            <select
              value={feed.pollMs}
              onChange={(e) => feed.setPollMs(Number(e.target.value))}
              className="hidden sm:block bg-white/5 border border-white/10 rounded px-2.5 py-2 text-[11px] text-white/70 outline-none cursor-pointer"
              title="Poll interval"
            >
              <option value={3000} className="bg-black">3s</option>
              <option value={5000} className="bg-black">5s</option>
              <option value={10000} className="bg-black">10s</option>
              <option value={30000} className="bg-black">30s</option>
            </select>
          )}

          <WalletButton wallet={wallet} />
        </div>
      </header>

      {/* Status lines — only when something is actually wrong or unusual */}
      {feed.demoMode && (
        <div className="shrink-0 bg-purple-500/15 border-b border-purple-500/20 px-4 sm:px-6 py-2 text-[11px] text-purple-300 flex items-center gap-2">
          <span className="font-bold">DEMO MODE</span>
          <span className="text-purple-300/80">Simulated launches — trading is disabled.</span>
        </div>
      )}
      {!feed.demoMode && feed.status === 'error' && (
        <div className="shrink-0 bg-red-500/15 border-b border-red-500/20 px-4 sm:px-6 py-2 text-[11px] text-red-300">
          Launchpad API unreachable ({feed.error}). The radar will keep retrying every {feed.pollMs / 1000}s.
        </div>
      )}
      {!feed.demoMode && feed.status === 'live' && feed.skipped > 0 && (
        <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 sm:px-6 py-1.5 text-[10.5px] text-amber-300/90">
          The launchpad API could not decode {feed.skipped} pool{feed.skipped === 1 ? '' : 's'} in this response, so they
          are missing below. Pool detail is still reachable by address.
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {selected ? (
          <TokenDetail
            pool={selected}
            history={history}
            tradeFeeBps={tradeFeeBps}
            wallet={wallet}
            onBack={() => setSelectedPubkey(null)}
            onTraded={feed.refresh}
          />
        ) : tab === 'portfolio' ? (
          <Portfolio feed={feed} wallet={wallet} onOpenPool={(p) => setSelectedPubkey(p.pubkey)} />
        ) : tab === 'claims' ? (
          <Claims wallet={wallet} initialAddress={wallet.address ?? ''} />
        ) : (
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
        )}
      </div>

      {/* Network strip — where every number on this screen came from */}
      <footer className="shrink-0 h-8 border-t border-white/10 bg-black px-4 sm:px-6 flex items-center justify-between text-[10px] text-white/35">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3ddc84]" />
          Cookie Chain · rpc.cookiescan.io
        </span>
        <span className="flex items-center gap-3">
          <a href="https://cookiescan.io" target="_blank" rel="noreferrer" className="hover:text-white inline-flex items-center gap-1">
            Cookiescan <ExternalLink size={9} />
          </a>
          <a href="https://hyperlane.cookiescan.io" target="_blank" rel="noreferrer" className="hover:text-white inline-flex items-center gap-1">
            Bridge <ExternalLink size={9} />
          </a>
          <a href={COOKIE_EXPLORER} target="_blank" rel="noreferrer" className="hover:text-white hidden sm:inline-flex items-center gap-1">
            Explorer <ExternalLink size={9} />
          </a>
        </span>
      </footer>
    </div>
  );
}
