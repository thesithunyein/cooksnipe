import { useEffect, useMemo, useState } from 'react';
import { fetchConfig } from '../lib/api';
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

const TABS: Array<[Tab, string]> = [
  ['radar', 'Radar'],
  ['portfolio', 'Portfolio'],
  ['claims', 'Claims'],
];

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
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--paper)' }}>
      {/* Chrome — fixed, paper, hairline under it */}
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 sm:px-8 py-3 sm:py-4 hair-b">
        <button onClick={() => goTab('radar')} className="flex items-center gap-2.5 cursor-pointer min-w-0">
          <img
            src="/cooksnipe.png"
            alt=""
            className="w-9 h-9 rounded-full"
            draggable={false}
          />
          <span className="text-[15px] font-medium tracking-[-0.012em] hidden sm:inline">CookSnipe</span>
        </button>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="tabs shrink-0">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => goTab(id)}
                className={`tab ${tab === id ? 'tab-on' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'radar' && !selected && (
            <select
              value={feed.pollMs}
              onChange={(e) => feed.setPollMs(Number(e.target.value))}
              aria-label="Poll interval"
              className="hidden sm:block h-9 rounded-full border border-[color:var(--rule)] bg-white/60 px-3 text-[12px] text-[color:var(--ink-soft)] outline-none cursor-pointer"
            >
              <option value={3000}>every 3s</option>
              <option value={5000}>every 5s</option>
              <option value={10000}>every 10s</option>
              <option value={30000}>every 30s</option>
            </select>
          )}

          <WalletButton wallet={wallet} />
        </div>
      </header>

      {/* Status lines — only when something is actually wrong or unusual */}
      {feed.demoMode && (
        <div className="shrink-0 alert-warn mx-5 sm:mx-8 mt-3 px-3.5 py-2 text-[11.5px] flex items-center gap-2">
          <span className="font-medium">Demo mode</span>
          <span className="opacity-80">Simulated launches — trading is disabled.</span>
        </div>
      )}
      {!feed.demoMode && feed.status === 'error' && (
        <div className="shrink-0 alert-danger mx-5 sm:mx-8 mt-3 px-3.5 py-2 text-[11.5px]">
          Launchpad API unreachable ({feed.error}). Retrying every {feed.pollMs / 1000}s.
        </div>
      )}
      {!feed.demoMode && feed.status === 'live' && feed.skipped > 0 && (
        <div className="shrink-0 mx-5 sm:mx-8 mt-3 px-3.5 py-2 text-[11px] text-[color:var(--ink-faint)] hair-b pb-3">
          The launchpad API could not decode {feed.skipped} pool{feed.skipped === 1 ? '' : 's'} in this response, so they
          are missing below. Pool detail is still reachable by address.
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden mt-4">
        {selected ? (
          <TokenDetail
            pool={selected}
            history={history}
            tradeFeeBps={tradeFeeBps}
            wallet={wallet}
            onBack={() => setSelectedPubkey(null)}
            onTraded={feed.refresh}
            onOpenClaims={() => goTab('claims')}
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

      {/* Footer — where every number on this screen came from */}
      <footer className="shrink-0 hair-t px-5 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10.5px] tracking-[0.02em] text-[color:var(--ink-faint)]">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--live)' }} />
          Cookie Chain · rpc.cookiescan.io
        </span>
        <span className="flex items-center gap-4">
          <a href="https://cookiescan.io" target="_blank" rel="noreferrer" className="link">
            Cookiescan
          </a>
          <a href="https://hyperlane.cookiescan.io" target="_blank" rel="noreferrer" className="link">
            Bridge
          </a>
          <a href="https://cookiescan.io" target="_blank" rel="noreferrer" className="link hidden sm:inline">
            Explorer
          </a>
        </span>
      </footer>
    </div>
  );
}
