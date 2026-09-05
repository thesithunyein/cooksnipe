import { useCallback, useMemo, useState } from 'react';
import { fetchPools, fetchPosition } from '../lib/api';
import { estimateSell } from '../lib/curve';
import { formatCook, formatPrice, shortAddr } from '../lib/format';
import type { LaunchRow, LaunchpadPosition } from '../lib/types';

interface PortfolioProps {
  launches: LaunchRow[];
  demoMode: boolean;
}

interface PositionRow {
  pool: LaunchRow;
  pos: LaunchpadPosition;
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic demo positions for an address — clearly demo-only. */
function demoPositions(owner: string, launches: LaunchRow[]): PositionRow[] {
  const rows: PositionRow[] = [];
  for (const pool of launches) {
    if (pool.status !== 'live') continue;
    const h = hashStr(owner + pool.pubkey);
    if (h % 3 === 0) continue; // skip some pools
    const shares = (h % 4_000_000) + 50_000; // whole tokens
    const totalPaymentIn = Math.round(shares * 0.0002 * 1e9); // ~rough entry price
    rows.push({
      pool,
      pos: {
        pool: pool.pubkey,
        owner,
        shares: String(shares * 1_000_000),
        totalPaymentIn: String(totalPaymentIn),
        totalPaymentOut: '0',
        claimed: false,
        winnerClaimed: false,
        graduatedTokensClaimed: false,
      },
    });
  }
  return rows;
}

export function Portfolio({ launches, demoMode }: PortfolioProps) {
  const [owner, setOwner] = useState('');
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const addr = owner.trim();
    if (!addr) {
      setPositions([]);
      return;
    }
    setLoading(true);
    setPosError(null);
    try {
      if (demoMode) {
        setPositions(demoPositions(addr, launches));
      } else {
        const pools = (await fetchPools('all')).filter((p) => p.status === 'live' || p.status === 'graduated');
        const found: PositionRow[] = [];
        const batch = pools.slice(0, 60);
        for (const pool of batch) {
          try {
            const pos = await fetchPosition(pool.pubkey, addr);
            if (pos) found.push({ pool, pos });
          } catch {
            // skip pools that fail individually — surface the overall error below
          }
        }
        setPositions(found);
      }
    } catch (e) {
      setPosError(e instanceof Error ? e.message : 'failed to load positions');
    } finally {
      setLoading(false);
    }
  }, [owner, demoMode, launches]);

  const totalValue = useMemo(
    () =>
      positions.reduce((sum, { pool, pos }) => {
        try {
          const est = estimateSell(pool, BigInt(pos.shares), pool.tradeFeeBps ?? 100);
          return sum + Number(est.netRaw) / 1e9;
        } catch {
          return sum;
        }
      }, 0),
    [positions],
  );

  const totalPnl = useMemo(
    () =>
      positions.reduce((sum, { pos }) => {
        const value = Number(pos.totalPaymentIn) / 1e9;
        return sum - value;
      }, totalValue),
    [positions, totalValue],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 py-5 border-b border-white/8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/55 mb-3">
          Portfolio — read only
        </div>
        <div className="flex items-center gap-2.5">
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Cookie Chain wallet address"
            spellCheck={false}
            className="flex-1 bg-black/40 border border-white/10 rounded px-3.5 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#3ddc84]/50"
          />
          <button
            onClick={load}
            disabled={loading || !owner.trim()}
            className="px-4 py-2.5 rounded bg-white text-black text-[12px] font-semibold disabled:opacity-40 cursor-pointer hover:bg-white/90 transition-colors"
          >
            {loading ? '…' : 'Load'}
          </button>
        </div>
        <div className="text-[10px] text-white/35 mt-2 leading-relaxed">
          Curve positions are program-tracked shares (not SPL tokens) until a pool graduates.
        </div>
      </div>

      {posError && (
        <div className="mx-6 mt-4 px-3.5 py-2.5 rounded border border-red-500/30 bg-red-500/10 text-[11px] text-red-300">
          {posError}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!owner.trim() && (
          <div className="px-6 py-16 text-center text-white/35 text-[12px]">
            Paste a Cookie Chain address to see its MomoSwap curve positions and live PnL.
          </div>
        )}
        {owner.trim() && !loading && positions.length === 0 && !posError && (
          <div className="px-6 py-16 text-center text-white/35 text-[12px]">
            {demoMode
              ? 'This address has no positions in the demo feed.'
              : 'No curve positions found for this address.'}
          </div>
        )}

        {positions.map(({ pool, pos }) => {
          let value = 0;
          try {
            const est = estimateSell(pool, BigInt(pos.shares), pool.tradeFeeBps ?? 100);
            value = Number(est.netRaw) / 1e9;
          } catch {
            value = 0;
          }
          const paid = Number(pos.totalPaymentIn) / 1e9;
          const pnl = value - paid;
          return (
            <div key={pool.pubkey} className="px-6 py-4 flex items-center gap-4 border-b border-white/5 last:border-b-0">
              <div
                className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-black"
                style={{ backgroundColor: `hsl(${hueOf(pool.pubkey)} 70% 65%)` }}
              >
                {initials(pool.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[14px] font-semibold text-white truncate">{pool.name}</span>
                  <span className="shrink-0 text-[11px] text-white/40">${pool.symbol}</span>
                  {pool.demo && (
                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-purple-400/20 text-purple-300 font-bold">DEMO</span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-white/40 truncate">
                  {(Number(pos.shares) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })} curve shares · {shortAddr(pool.pubkey)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] text-white font-semibold">
                  {formatCook(String(Math.round(value * 1e9)))} <span className="text-[10px] font-normal text-white/45">COOK</span>
                </div>
                <div className={`mt-0.5 text-[11px] ${pnl >= 0 ? 'text-[#3ddc84]' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : ''}{formatPrice(Math.abs(pnl) || 0)} COOK ({((pnl / (paid || 1)) * 100).toFixed(0)}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {positions.length > 0 && (
        <div className="shrink-0 px-6 py-3.5 border-t border-white/10 bg-white/[0.02] text-[12px] flex items-center justify-between">
          <span className="text-white/50">Total value</span>
          <span className="font-semibold text-white">
            {formatCook(String(Math.round(totalValue * 1e9)))} COOK
            <span className={`ml-2.5 font-normal ${totalPnl >= 0 ? 'text-[#3ddc84]' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatCook(String(Math.round(totalPnl * 1e9)))} ({((totalPnl / (totalValue - totalPnl || 1)) * 100).toFixed(0)}%)
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
