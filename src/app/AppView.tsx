import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchConfig } from '../lib/api';
import { poolStats } from '../lib/curve';
import type { PricePoint } from './BondingChart';
import { Claims } from './Claims';
import { Mark } from './Mark';
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

/** Deep links: /app?pool=<pubkey>, /app?tab=claims, /app?tab=claims&address=<addr>. */
const initialParams = () => new URLSearchParams(window.location.search);

export function AppView() {
  const feed = useLaunches();
  const wallet = useWallet();
  const [params] = useState(initialParams);
  const [tab, setTab] = useState<Tab>(() => {
    const t = params.get('tab');
    return t === 'portfolio' || t === 'claims' ? t : 'radar';
  });
  const [selectedPubkey, setSelectedPubkey] = useState<string | null>(() => params.get('pool'));
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
    setScrollPct(0);
  };

  // Keep the URL in step so any screen is shareable and reloadable.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedPubkey) {
      url.searchParams.set('pool', selectedPubkey);
      url.searchParams.delete('tab');
    } else {
      url.searchParams.delete('pool');
      if (tab === 'radar') url.searchParams.delete('tab');
      else url.searchParams.set('tab', tab);
    }
    window.history.replaceState(null, '', url);
  }, [tab, selectedPubkey]);

  // The landing's boot bar, at app speed: it measures the first feed response,
  // with a hard cap so a slow API can never hold the screen.
  const [bootPct, setBootPct] = useState(0);
  const [bootDone, setBootDone] = useState(false);
  const feedReady = feed.status !== 'connecting';

  useEffect(() => {
    const started = performance.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - started) / 1800);
      setBootPct(Math.round(t * 90));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!feedReady) return;
    setBootPct(100);
    setBootDone(true);
  }, [feedReady]);

  // Hard cap: a slow or dead API must never hold the screen behind the bar.
  useEffect(() => {
    const cap = window.setTimeout(() => {
      setBootPct(100);
      setBootDone(true);
    }, 2600);
    return () => window.clearTimeout(cap);
  }, []);

  // Scroll meter, fed by whichever pane is scrolling (scroll doesn't bubble, so
  // the listener is registered in the capture phase on the shell).
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.scrollHeight !== 'number') return;
      const max = t.scrollHeight - t.clientHeight;
      setScrollPct(max > 0 ? Math.min(1, Math.max(0, t.scrollTop / max)) : 0);
    };
    el.addEventListener('scroll', onScroll, true);
    return () => el.removeEventListener('scroll', onScroll, true);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col paper-grain">
      <i className="meter" style={{ transform: `scaleX(${scrollPct})` }} />

      {/*
        * Chrome — the landing's header, carrying the app's navigation.
        *
        * Order follows the landing: brand hard left, everything else hard right.
        * Below lg the tabs (which the landing can simply hide, and we can't) drop
        * to a second full-width row rather than shrinking to unreadable type, so
        * the brand and the wallet pill keep the top-right corner to themselves.
        */}
      <header
        className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2.5 chrome-fade"
        style={{
          padding: `max(14px, calc(env(safe-area-inset-top, 0px) + 12px)) var(--edge) 14px`,
        }}
      >
        <button onClick={() => goTab('radar')} className="flex items-center gap-2.5 cursor-pointer min-w-0">
          <Mark size={26} />
          <span className="text-[15px] tracking-[-0.012em]">CookSnipe</span>
        </button>

        <nav
          className="app-nav order-3 lg:order-2 basis-full lg:basis-auto justify-start lg:justify-end lg:ml-auto"
          aria-label="Sections"
        >
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => goTab(id)}
              aria-current={tab === id && !selected ? 'page' : undefined}
              className={`nav-link ${tab === id && !selected ? 'nav-link-on' : ''}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="order-2 lg:order-3 ml-auto lg:ml-4 flex items-center gap-3 sm:gap-4">
          {tab === 'radar' && !selected && (
            <select
              value={feed.pollMs}
              onChange={(e) => feed.setPollMs(Number(e.target.value))}
              aria-label="Poll interval"
              className="hidden lg:block h-9 rounded-full border border-[color:var(--rule)] bg-white/60 px-3 text-[12.5px] text-[color:var(--ink-soft)] outline-none cursor-pointer"
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
        <div className="shrink-0 alert-warn gutter-x mt-1 px-3.5 py-2 text-[12px] flex items-center gap-2">
          <span className="font-medium">Demo mode</span>
          <span className="opacity-80">Simulated launches — trading is disabled.</span>
        </div>
      )}
      {!feed.demoMode && feed.status === 'error' && (
        <div className="shrink-0 alert-danger gutter-x mt-1 px-3.5 py-2 text-[12px]">
          Launchpad API unreachable ({feed.error}). Retrying every {feed.pollMs / 1000}s.
        </div>
      )}
      {!feed.demoMode && feed.status === 'live' && feed.skipped > 0 && (
        <div className="shrink-0 gutter-x mt-2 pb-2 text-[12px] tracking-[0.02em] text-[color:var(--ink-faint)]">
          The launchpad API could not decode {feed.skipped} pool{feed.skipped === 1 ? '' : 's'} in this response, so they
          are missing below. Pool detail is still reachable by address.
        </div>
      )}

      {/* Body */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-hidden mt-4">
        {selected ? (
          <TokenDetail
            pool={selected}
            history={history}
            tradeFeeBps={tradeFeeBps}
            wallet={wallet}
            onBack={() => {
              setSelectedPubkey(null);
              setScrollPct(0);
            }}
            onTraded={feed.refresh}
            onOpenClaims={() => goTab('claims')}
          />
        ) : tab === 'portfolio' ? (
          <Portfolio feed={feed} wallet={wallet} onOpenPool={(p) => setSelectedPubkey(p.pubkey)} />
        ) : tab === 'claims' ? (
          <Claims
            wallet={wallet}
            initialAddress={params.get('address') ?? wallet.address ?? ''}
            autoScan={Boolean(params.get('address'))}
          />
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

      {/* Footer — the landing's line, fading into the content above it */}
      <footer
        className="shrink-0 foot-fade flex flex-wrap justify-center items-center gap-x-2 gap-y-1 text-center text-[12px] leading-[1.45] tracking-[0.02em] text-[color:var(--ink-faint)]"
        style={{
          padding: `14px var(--edge) max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))`,
        }}
      >
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--live)' }} />
          Live on Cookie Chain
        </span>
        <span className="hidden sm:inline text-[color:var(--rule)]">·</span>
        <span className="hidden sm:inline">rpc.cookiescan.io</span>
        <span className="text-[color:var(--rule)]">·</span>
        <a href="https://cookiescan.io" target="_blank" rel="noreferrer" className="link">
          Cookiescan
        </a>
        <span className="text-[color:var(--rule)]">·</span>
        <a href="https://hyperlane.cookiescan.io" target="_blank" rel="noreferrer" className="link">
          Bridge
        </a>
        <span className="text-[color:var(--rule)]">·</span>
        <a href="/" className="link">
          About
        </a>
      </footer>

      {/* The same preloader the landing opens with. */}
      <div className={`boot ${bootDone ? 'done' : ''}`} aria-hidden={bootDone}>
        <div className="bar">
          <i style={{ transform: `scaleX(${bootPct / 100})` }} />
        </div>
        <p>LOADING {bootPct}%</p>
      </div>
    </div>
  );
}
