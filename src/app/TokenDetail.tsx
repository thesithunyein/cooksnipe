import { useMemo } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { BondingChart, CurveVisual, type PricePoint } from './BondingChart';
import { DexExit } from './DexExit';
import { poolStats } from '../lib/curve';
import { explorerToken } from '../lib/chain';
import { formatCook, formatPrice, formatTime, pct } from '../lib/format';
import type { LaunchRow } from '../lib/types';
import { TradePanel } from './TradePanel';
import type { WalletState } from './useWallet';

interface TokenDetailProps {
  pool: LaunchRow;
  history: PricePoint[];
  tradeFeeBps: number;
  wallet: WalletState;
  onBack: () => void;
  /** Called after a confirmed transaction so the feed re-reads the pool. */
  onTraded: () => void;
  onOpenClaims?: () => void;
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-3.5 py-3">
      <div className="label mb-1.5">{label}</div>
      <div className="text-[13.5px] truncate num" title={value}>
        {value}
      </div>
    </div>
  );
}

export function TokenDetail({ pool, history, tradeFeeBps, wallet, onBack, onTraded, onOpenClaims }: TokenDetailProps) {
  const { price, raised, marketCap: mc, progress } = poolStats(pool);

  const changePct = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0].price;
    const last = history[history.length - 1].price;
    if (first <= 0) return null;
    return ((last - first) / first) * 100;
  }, [history]);

  const safety: Array<{ ok: boolean; label: string }> = [
    { ok: !pool.antiSnipe, label: pool.antiSnipe ? 'Anti-snipe window — per-wallet buy caps at launch' : 'No anti-snipe restrictions' },
    { ok: pool.migratable, label: pool.migratable ? 'Migratable — DEX liquidity after graduation' : 'Non-migratable — no LP after graduation' },
    {
      ok: true,
      label:
        pool.expiryMode === 'fair'
          ? 'Fair mode — pro-rata refunds if it never graduates'
          : pool.expiryMode === 'jackpot'
            ? 'Jackpot mode — one settlement payout if it never graduates'
            : pool.expiryMode === 'survivor'
              ? 'Survivor mode — last holders settle if it never graduates'
              : 'Dead mode — no refund if it never graduates',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 sm:px-8 pb-4 hair-b flex items-center gap-3.5">
        <button onClick={onBack} aria-label="Back to the radar" className="opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
          <ArrowLeft size={17} strokeWidth={1.75} />
        </button>
        <div
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[11px] font-medium text-black/70"
          style={{ backgroundColor: `hsl(${hueOf(pool.pubkey)} 62% 78%)` }}
        >
          {initials(pool.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-[17px] font-medium tracking-[-0.016em] truncate">{pool.name}</h2>
            <span className="shrink-0 text-[12px] text-[color:var(--ink-faint)]">${pool.symbol}</span>
            {pool.demo && <span className="chip shrink-0">demo</span>}
            <span className={`chip shrink-0 ${pool.status === 'live' ? 'chip-live' : ''}`}>{pool.status}</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1 text-[11.5px] text-[color:var(--ink-faint)]">
            <a href={`https://momoswap.fun/pool/${pool.pubkey}`} target="_blank" rel="noreferrer" className="link">
              MomoSwap
            </a>
            <span className="text-[color:var(--rule)]">·</span>
            <a href={explorerToken(pool.tokenMint)} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
              token <ExternalLink size={10} strokeWidth={1.75} />
            </a>
            <span className="text-[color:var(--rule)]">·</span>
            <a href={`https://cookiescan.io/address/${pool.creator}`} target="_blank" rel="noreferrer" className="link">
              creator
            </a>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 py-5 flex flex-col gap-7 max-w-[880px] w-full mx-auto">
        {/* Price */}
        <div>
          <div className="flex items-end gap-3 flex-wrap">
            <span className="text-[clamp(34px,6vw,58px)] leading-[0.95] tracking-[-0.036em] num">{formatPrice(price)}</span>
            <span className="text-[13px] text-[color:var(--ink-faint)] mb-1.5">COOK / token</span>
            {changePct !== null && (
              <span className={`text-[12.5px] mb-1.5 num ${changePct >= 0 ? 'pos' : 'neg'}`}>
                {changePct >= 0 ? '+' : ''}
                {changePct.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-[color:var(--ink-faint)] mt-2">
            launched {formatTime(pool.launchTs)} · ends {formatTime(pool.endTs)}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat label="Market cap (virtual)" value={`${formatCook(String(mc * 1e9))} COOK`} />
          <Stat label="Raised" value={`${formatCook(String(raised * 1e9))} COOK`} />
          <Stat label="Buyers" value={Number(pool.participantCount || 0).toLocaleString()} />
          <Stat label="Trade fee" value={`${(tradeFeeBps / 100).toFixed(2)}%`} />
        </div>

        {/* Graduation progress — monochrome bar, like the rest of the chrome */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="label">Graduation progress</span>
            <span className="text-[12px] num">{pct(progress)}</span>
          </div>
          <div className="bar">
            <i style={{ width: `${Math.max(2, progress)}%` }} />
          </div>
          <div className="text-[10.5px] text-[color:var(--ink-faint)] mt-2 num">
            target {formatCook(pool.graduationTarget)} COOK raised · sale supply {formatCook(pool.saleTokenSupply, 6)} tokens
          </div>
        </div>

        {/* Trade — buy, sell, or exit once it graduated */}
        <TradePanel pool={pool} wallet={wallet} onDone={onTraded} />
        {pool.status === 'graduated' && <DexExit pool={pool} wallet={wallet} onDone={onTraded} />}

        {onOpenClaims && (
          <button onClick={onOpenClaims} className="btn btn-ghost w-full">
            Looking for a refund, a payout or creator fees? Open the Claim Center
          </button>
        )}

        {/* Bonding curve */}
        <CurveVisual pool={pool} />
        <BondingChart history={history} />

        {/* Safety */}
        <div>
          <div className="label mb-3">Safety checks</div>
          <div className="flex flex-col gap-2.5">
            {safety.map((s) => (
              <div key={s.label} className="flex items-start gap-3 text-[12.5px]">
                <span
                  className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: s.ok ? 'var(--live)' : 'var(--warn)' }}
                />
                <span className="text-[color:var(--ink-soft)]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
