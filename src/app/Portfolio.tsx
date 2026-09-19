import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { fetchPools, fetchPosition } from '../lib/api';
import { COOK_MINT, explorerToken } from '../lib/chain';
import { estimateSell } from '../lib/curve';
import { getWalletAssets, type WalletAsset } from '../lib/das';
import { formatCook } from '../lib/format';
import type { LaunchRow, LaunchpadPosition } from '../lib/types';
import type { useLaunches } from './useLaunches';
import type { WalletState } from './useWallet';

type Feed = ReturnType<typeof useLaunches>;

interface PortfolioProps {
  feed: Feed;
  wallet: WalletState;
  onOpenPool: (pool: LaunchRow) => void;
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

/** Deterministic demo positions — clearly labelled as simulated. */
function demoPositions(owner: string, launches: LaunchRow[]): PositionRow[] {
  const rows: PositionRow[] = [];
  for (const pool of launches) {
    if (pool.status !== 'live') continue;
    const h = hashStr(owner + pool.pubkey);
    if (h % 3 === 0) continue;
    const shares = (h % 4_000_000) + 50_000;
    const totalPaymentIn = Math.round(shares * 0.0002 * 1e9);
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

/**
 * What a position is actually worth right now.
 *
 * Three different things can be true, and lumping them together is how a portfolio
 * ends up lying: the shares are still on a live curve (worth what the curve pays
 * out today), the pool graduated (the value moved into SPL tokens), or the pool
 * expired (the value is a claimable refund, or nothing at all in dead mode).
 */
function valueOf(pool: LaunchRow, pos: LaunchpadPosition): { cook: number | null; kind: 'curve' | 'claim' | 'tokens' | 'none'; note: string } {
  let shares = 0n;
  try {
    shares = BigInt(pos.shares || '0');
  } catch {
    shares = 0n;
  }

  if (pool.status === 'live' && shares > 0n) {
    try {
      const est = estimateSell(pool, shares, pool.tradeFeeBps ?? 100);
      return { cook: Number(est.netRaw) / 1e9, kind: 'curve', note: 'sellable now' };
    } catch {
      return { cook: 0, kind: 'curve', note: 'curve unavailable' };
    }
  }

  if (pool.status === 'graduated' && shares > 0n) {
    return {
      cook: null,
      kind: 'tokens',
      note: pos.graduatedTokensClaimed ? 'tokens claimed' : 'claim SPL tokens in the Claim Center',
    };
  }

  if ((pool.status === 'expired' || pool.status === 'ended') && shares > 0n && pool.expiryMode === 'fair') {
    const total = Number(pool.totalExpiryShares || 0);
    const pot = Number(pool.expiryLiquidity || 0) / 1e9;
    const share = total > 0 ? (pot * Number(shares)) / total : 0;
    return { cook: share, kind: 'claim', note: pos.claimed ? 'refund claimed' : 'refund claimable' };
  }

  return { cook: 0, kind: 'none', note: pool.expiryMode === 'dead' ? 'no refunds in dead mode' : 'closed' };
}

export function Portfolio({ feed, wallet, onOpenPool }: PortfolioProps) {
  const [owner, setOwner] = useState(wallet.address ?? '');
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [assets, setAssets] = useState<WalletAsset[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wallet.address) setOwner(wallet.address);
  }, [wallet.address]);

  const load = useCallback(async () => {
    const addr = owner.trim();
    if (!addr) {
      setPositions([]);
      setAssets(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (feed.demoMode) {
        setPositions(demoPositions(addr, feed.launches));
        setAssets(null);
      } else {
        const { pools } = await fetchPools('all');
        // Skip nothing: ended and expired pools are exactly where money waits.
        const candidates = pools.filter((p) => !p.demo);
        const found: PositionRow[] = [];
        for (const pool of candidates) {
          try {
            const pos = await fetchPosition(pool.pubkey, addr);
            if (pos) found.push({ pool, pos });
          } catch {
            /* one pool failing must not hide the rest */
          }
        }
        setPositions(found);
        setAssets(await getWalletAssets(addr));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this address.');
    } finally {
      setLoading(false);
    }
  }, [owner, feed.demoMode, feed.launches]);

  // Auto-load once the wallet connects: the common case is "what do I hold".
  useEffect(() => {
    if (wallet.address && !feed.demoMode) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.address, feed.launches.length]);

  const rows = useMemo(
    () =>
      positions.map(({ pool, pos }) => {
        const raw = (() => {
          try {
            return {
              invested: Number(BigInt(pos.totalPaymentIn || '0')) / 1e9,
              returned: Number(BigInt(pos.totalPaymentOut || '0')) / 1e9,
            };
          } catch {
            return { invested: 0, returned: 0 };
          }
        })();
        const value = valueOf(pool, pos);
        const net = raw.returned + (value.cook ?? 0) - raw.invested;
        return { pool, pos, invested: raw.invested, returned: raw.returned, value, net };
      }),
    [positions],
  );

  const totals = useMemo(() => {
    let open = 0;
    let invested = 0;
    let returned = 0;
    let claims = 0;
    for (const r of rows) {
      open += r.value.kind === 'curve' ? r.value.cook ?? 0 : 0;
      claims += r.value.kind === 'claim' ? r.value.cook ?? 0 : 0;
      invested += r.invested;
      returned += r.returned;
    }
    return { open, invested, returned, claims, net: returned + open - invested };
  }, [rows]);

  const tokens = (assets ?? []).filter((a) => a.mint !== COOK_MINT);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="gutter pb-4 shrink-0">
        <h1 className="display text-[clamp(24px,3vw,34px)] mb-3">Portfolio</h1>
        <div className="flex items-center gap-3">
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
            placeholder="Cookie Chain wallet address"
            spellCheck={false}
            className="field flex-1"
          />
          <button onClick={() => void load()} disabled={loading || !owner.trim()} className="btn btn-ink btn-sm h-[42px]">
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>
        <p className="text-[10.5px] text-[color:var(--ink-faint)] mt-2.5 leading-relaxed max-w-[70ch]">
          Curve positions are program-tracked shares, not SPL tokens. Invested and returned are read straight from the
          position account, so a closed position can't show a fake loss.
        </p>
      </div>

      {error && <div className="gutter-x mb-3 alert-danger px-3.5 py-2.5 text-[12px]">{error}</div>}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!owner.trim() && (
          <div className="px-6 py-20 text-center text-[12.5px] text-[color:var(--ink-faint)]">
            Connect a wallet, or paste an address, to see its curve positions and PnL.
          </div>
        )}

        {owner.trim() && !loading && positions.length === 0 && !error && (
          <div className="px-6 py-20 text-center text-[12.5px] text-[color:var(--ink-faint)]">
            {feed.demoMode ? 'This address has no positions in the demo feed.' : 'No curve positions in any pool for this address.'}
          </div>
        )}

        {rows.map(({ pool, pos, invested, returned, value, net }) => (
          <button
            key={pool.pubkey}
            onClick={() => onOpenPool(pool)}
            className="w-full text-left gutter py-4 flex items-center gap-4 hair-b hover:bg-white/60 transition-colors cursor-pointer"
          >
            <div
              className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[11px] font-medium text-black/70"
              style={{ backgroundColor: `hsl(${hueOf(pool.pubkey)} 62% 78%)` }}
            >
              {initials(pool.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[14.5px] font-medium tracking-[-0.012em] truncate">{pool.name}</span>
                <span className="shrink-0 text-[11.5px] text-[color:var(--ink-faint)]">${pool.symbol}</span>
                {pool.demo && <span className="chip shrink-0">demo</span>}
                <span className="chip shrink-0">{pool.status}</span>
              </div>
              <div className="mt-1 text-[11.5px] text-[color:var(--ink-soft)] truncate num">
                {(Number(pos.shares) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })} shares · in{' '}
                {formatCook(String(Math.round(invested * 1e9)))} COOK
                {returned > 0 && <> · out {formatCook(String(Math.round(returned * 1e9)))} COOK</>}
              </div>
              <div className="mt-0.5 text-[10.5px] text-[color:var(--ink-faint)]">{value.note}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[13.5px] whitespace-nowrap num">
                {value.cook === null ? (
                  <span className="text-[color:var(--ink-soft)]">SPL {pool.symbol}</span>
                ) : (
                  <>
                    {value.cook.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                    <span className="text-[10px] text-[color:var(--ink-faint)]">COOK</span>
                  </>
                )}
              </div>
              {invested > 0 && (
                <div className={`mt-0.5 text-[11.5px] num ${net >= 0 ? 'pos' : 'neg'}`}>
                  {net >= 0 ? '+' : ''}
                  {net.toLocaleString(undefined, { maximumFractionDigits: 2 })} net
                </div>
              )}
            </div>
          </button>
        ))}

        {assets !== null && (
          <div className="gutter py-6">
            <div className="label mb-3.5">
              Tokens in this wallet <span className="normal-case tracking-normal">· Cookiescan DAS</span>
            </div>
            {tokens.length === 0 ? (
              <div className="text-[11.5px] text-[color:var(--ink-faint)]">
                The index shows no SPL or Token-2022 balances for this address yet.
              </div>
            ) : (
              <div className="flex flex-col">
                {tokens.map((a) => (
                  <div key={a.mint} className="flex items-center gap-3 py-2 hair-b last:border-b-0">
                    <span className="flex-1 min-w-0 truncate text-[12.5px]">
                      {a.name} <span className="text-[color:var(--ink-faint)]">${a.symbol}</span>
                    </span>
                    <span className="text-[12.5px] whitespace-nowrap num">
                      {a.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                    <a
                      href={explorerToken(a.mint)}
                      target="_blank"
                      rel="noreferrer"
                      className="opacity-35 hover:opacity-100 transition-opacity shrink-0"
                      title={a.mint}
                    >
                      <ExternalLink size={12} strokeWidth={1.75} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="shrink-0 hair-t gutter py-3.5 text-[12.5px] flex flex-wrap items-center justify-between gap-2 num">
          <span className="text-[color:var(--ink-soft)]">
            Open {formatCook(String(Math.round(totals.open * 1e9)))} COOK
            {totals.claims > 0 && <> · claimable {formatCook(String(Math.round(totals.claims * 1e9)))} COOK</>}
            {' · '}invested {formatCook(String(Math.round(totals.invested * 1e9)))}
          </span>
          <span className={`font-medium ${totals.net >= 0 ? 'pos' : 'neg'}`}>
            {totals.net >= 0 ? '+' : ''}
            {formatCook(String(Math.round(totals.net * 1e9)))} COOK net
          </span>
        </div>
      )}
    </div>
  );
}
