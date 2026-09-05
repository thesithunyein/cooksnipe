import { useMemo, useState } from 'react';
import { BondingChart, CurveVisual, type PricePoint } from './BondingChart';
import { estimateBuy, poolStats } from '../lib/curve';
import { formatCook, formatPrice, formatTime, pct, shortAddr } from '../lib/format';
import type { LaunchRow } from '../lib/types';

interface TokenDetailProps {
  pool: LaunchRow;
  history: PricePoint[];
  tradeFeeBps: number;
  onBack: () => void;
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
    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3.5 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1.5">{label}</div>
      <div className="text-[13px] text-white truncate" title={value}>{value}</div>
    </div>
  );
}

export function TokenDetail({ pool, history, tradeFeeBps, onBack }: TokenDetailProps) {
  const [buyInput, setBuyInput] = useState('');

  const { price, raised, marketCap: mc, progress } = poolStats(pool);

  const changePct = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0].price;
    const last = history[history.length - 1].price;
    if (first <= 0) return null;
    return ((last - first) / first) * 100;
  }, [history]);

  const quote = useMemo(() => {
    if (!buyInput || Number.isNaN(Number(buyInput)) || Number(buyInput) <= 0) return null;
    try {
      const paymentRaw = BigInt(Math.round(Number(buyInput) * 1e9));
      const est = estimateBuy(pool, paymentRaw, tradeFeeBps);
      return {
        feeCook: Number(est.feeRaw) / 1e9,
        tokensOut: Number(est.tokensOutRaw) / 1e6,
      };
    } catch {
      return null;
    }
  }, [buyInput, pool, tradeFeeBps]);

  const safety: Array<{ ok: boolean; label: string }> = [
    { ok: !pool.antiSnipe, label: pool.antiSnipe ? 'Anti-snipe window — per-wallet buy caps at launch' : 'No anti-snipe restrictions' },
    { ok: pool.migratable, label: pool.migratable ? 'Migratable — DEX liquidity after graduation' : 'Non-migratable — no LP after graduation' },
    {
      ok: true,
      label:
        pool.expiryMode === 'fair'
          ? 'Fair mode — pro-rata refunds if it never graduates'
          : pool.expiryMode === 'jackpot'
            ? 'Jackpot mode — settlement payout if it never graduates'
            : pool.expiryMode === 'survivor'
              ? 'Survivor mode — last holders settle if it never graduates'
              : 'Dead mode — no refund if it never graduates',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3.5">
        <button onClick={onBack} className="text-white/50 hover:text-white text-[15px] cursor-pointer leading-none">←</button>
        <div
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-black"
          style={{ backgroundColor: `hsl(${hueOf(pool.pubkey)} 70% 65%)` }}
        >
          {initials(pool.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-[16px] text-white truncate">{pool.name}</h2>
            <span className="shrink-0 text-[12px] text-white/40">${pool.symbol}</span>
            {pool.demo && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-purple-400/20 text-purple-300 font-bold">DEMO</span>
            )}
            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${pool.status === 'live' ? 'bg-[#3ddc84]/20 text-[#3ddc84]' : 'bg-white/10 text-white/60'}`}>
              {pool.status.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-white/40">
            <a href={`https://momoswap.fun/pool/${pool.pubkey}`} target="_blank" rel="noreferrer" className="hover:text-white">MomoSwap</a>
            <span>·</span>
            <a href={`https://cookiescan.io/token/${pool.tokenMint}`} target="_blank" rel="noreferrer" className="hover:text-white">token</a>
            <span>·</span>
            <a href={`https://cookiescan.io/address/${pool.creator}`} target="_blank" rel="noreferrer" className="hover:text-white">creator {shortAddr(pool.creator)}</a>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-6">
        {/* Price */}
        <div>
          <div className="flex items-end gap-2.5">
            <span className="text-[30px] leading-none text-white tracking-tight">{formatPrice(price)}</span>
            <span className="text-[13px] text-white/40 mb-1">COOK / token</span>
            {changePct !== null && (
              <span className={`text-[12px] mb-1 ${changePct >= 0 ? 'text-[#3ddc84]' : 'text-red-400'}`}>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="text-[11px] text-white/40 mt-1.5">
            launched {formatTime(pool.launchTs)} · ends {formatTime(pool.endTs)}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Market cap (virtual)" value={`${formatCook(String(mc * 1e9))} COOK`} />
          <Stat label="Raised" value={`${formatCook(String(raised * 1e9))} COOK`} />
          <Stat label="Buyers" value={Number(pool.participantCount || 0).toLocaleString()} />
          <Stat label="Trade fee" value={`${(tradeFeeBps / 100).toFixed(2)}%`} />
        </div>

        {/* Graduation progress */}
        <div>
          <div className="flex justify-between text-[11px] text-white/45 mb-2">
            <span>Graduation progress</span>
            <span>{pct(progress)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#3ddc84] to-[#a3ffcb]" style={{ width: `${Math.max(2, progress)}%` }} />
          </div>
          <div className="text-[10px] text-white/40 mt-1.5">
            target: {formatCook(pool.graduationTarget)} COOK raised · sale supply: {formatCook(pool.saleTokenSupply, 6)} tokens
          </div>
        </div>

        {/* Bonding curve */}
        <CurveVisual pool={pool} />
        <BondingChart history={history} />

        {/* Safety */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-2.5">Safety checks</div>
          <div className="flex flex-col gap-2">
            {safety.map((s) => (
              <div key={s.label} className="flex items-start gap-2.5 text-[12px]">
                <span className={`mt-[3px] w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${s.ok ? 'bg-[#3ddc84]/20 text-[#3ddc84]' : 'bg-amber-400/20 text-amber-300'}`}>
                  {s.ok ? '✓' : '!'}
                </span>
                <span className="text-white/65">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Simulated buy quote */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-3">
            Simulated buy quote
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              placeholder="COOK amount"
              value={buyInput}
              onChange={(e) => setBuyInput(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded px-3.5 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#3ddc84]/50"
            />
            <span className="text-[12px] text-white/45">COOK</span>
          </div>
          {quote && (
            <div className="mt-3 text-[12px] text-white/75 space-y-1 border-t border-white/5 pt-3">
              <div className="flex justify-between"><span className="text-white/45">Tokens out (est.)</span><span>{quote.tokensOut.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${pool.symbol}</span></div>
              <div className="flex justify-between"><span className="text-white/45">Trade fee ({pct(tradeFeeBps / 100)})</span><span>{quote.feeCook.toFixed(4)} COOK</span></div>
            </div>
          )}
          <div className="mt-3 text-[10px] text-white/35 leading-relaxed">
            Client-side quote using the on-chain curve math. Signing & execution arrive with wallet support (next milestone).
          </div>
        </div>
      </div>
    </div>
  );
}
