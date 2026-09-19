import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import {
  buildClaimCreatorFeesTx,
  buildClaimTx,
  fetchPendingCreatorFees,
  fetchPools,
  fetchPosition,
  fetchWinnerProof,
} from '../lib/api';
import { explorerTx } from '../lib/chain';
import { cookPriceUsd } from '../lib/das';
import { shortAddr } from '../lib/format';
import type { ClaimKind, LaunchRow } from '../lib/types';
import { VISIBLE_STAGES, useTx } from './useTx';
import type { WalletState } from './useWallet';

const COOK_RAW = 1e9;
const SHARE_RAW = 1e6;
const cookUi = (raw: string | number | bigint | undefined) => Number(raw ?? 0) / COOK_RAW;

type ClaimAction = ClaimKind | 'creator_fees';

interface Obligation {
  key: string;
  pool: LaunchRow;
  action: ClaimAction;
  /** What it is, in one line. */
  title: string;
  /** Why this wallet can claim it. */
  reason: string;
  amountCook: number | null; // null = program decides (graduated SPL tokens)
  /** Raw amount for winner claims — the builder requires it. */
  rawAmount?: string;
  proof?: number[][];
}

export interface ClaimsProps {
  wallet: WalletState;
  /** Pre-filled address, e.g. from the connected wallet or a deep link. */
  initialAddress?: string;
  /** Scan as soon as the view opens (used by /app?tab=claims&address=…). */
  autoScan?: boolean;
}

interface ScanResult {
  obligations: Obligation[];
  poolsChecked: number;
  livePools: number;
  scannedAt: number;
}

/**
 * Everything the MomoSwap launchpad owes an address, in one place.
 *
 * The program tracks four separate kinds of obligation (pro-rata refunds on a
 * fair-mode pool that expired, merkle payouts for jackpot/survivor settlements,
 * real SPL tokens for pools that graduated, and creator vest + accumulated trade
 * fees for whoever launched the pool), and there is no single endpoint that lists
 * them. So this walks every pool, asks what this address is owed on each, and
 * shows the ones with something behind them.
 */
export function Claims({ wallet, initialAddress, autoScan }: ClaimsProps) {
  const [owner, setOwner] = useState(initialAddress ?? '');
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const tx = useTx(wallet);

  useEffect(() => {
    void cookPriceUsd().then(setPrice);
  }, []);

  useEffect(() => {
    if (initialAddress && !owner) setOwner(initialAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddress]);

  const scanAddress = owner.trim();
  const canClaim = Boolean(wallet.address) && wallet.address === scanAddress;
  const claimableCook = (scan?.obligations ?? []).reduce((sum, o) => sum + (o.amountCook ?? 0), 0);

  const runScan = useCallback(async () => {
    const addr = scanAddress;
    if (!addr) return;
    setScanning(true);
    setScanError(null);
    tx.reset();
    try {
      const { pools } = await fetchPools('all');
      const real = pools.filter((p) => !p.demo);
      const found: Obligation[] = [];
      let live = 0;

      for (const pool of real) {
        const isCreator = pool.creator === addr;
        if (pool.status === 'live' || pool.status === 'upcoming') live += 1;

        let position = null;
        try {
          position = await fetchPosition(pool.pubkey, addr);
        } catch {
          /* one pool failing must not abort the scan */
        }

        // 1. Fair-mode refund: an expired pool that never graduated returns the
        //    whole raise, pro-rata by curve shares.
        if (
          position &&
          pool.status === 'expired' &&
          pool.expiryMode === 'fair' &&
          BigInt(position.shares || '0') > 0n &&
          !position.claimed
        ) {
          const shares = Number(position.shares) / SHARE_RAW;
          const total = Number(pool.totalExpiryShares || 0) / SHARE_RAW;
          const pot = cookUi(pool.expiryLiquidity);
          const share = total > 0 ? (pot * shares) / total : 0;
          found.push({
            key: `${pool.pubkey}:fair`,
            pool,
            action: 'fair',
            title: 'Refund — pool expired without graduating',
            reason: 'Fair mode returns the raise pro-rata to curve holders.',
            amountCook: share,
          });
        }

        // 2. Settlement payout (jackpot / survivor): needs the merkle proof.
        if (position && !position.winnerClaimed && pool.settlementRootSet) {
          const win = await fetchWinnerProof(pool.pubkey, addr);
          if (win) {
            found.push({
              key: `${pool.pubkey}:winner`,
              pool,
              action: 'winner',
              title: `Settlement payout — ${pool.expiryMode} pool`,
              reason: 'This address is in the settlement merkle root.',
              amountCook: cookUi(win.amount),
              rawAmount: win.amount,
              proof: win.proof,
            });
          }
        }

        // 3. Graduated pools owe the real SPL tokens, not curve shares.
        if (position && pool.status === 'graduated' && !position.graduatedTokensClaimed && BigInt(position.shares || '0') > 0n) {
          found.push({
            key: `${pool.pubkey}:graduated_tokens`,
            pool,
            action: 'graduated_tokens',
            title: 'Tokens — pool graduated to the DEX',
            reason: `${(Number(position.shares) / SHARE_RAW).toLocaleString(undefined, { maximumFractionDigits: 0 })} curve shares convert to SPL ${pool.symbol}.`,
            amountCook: null,
          });
        }

        // 4. Creator money: accumulated trade fees in the fee vault, and vest.
        if (isCreator) {
          try {
            const pending = await fetchPendingCreatorFees(pool.pubkey);
            if (pending > 0) {
              found.push({
                key: `${pool.pubkey}:creator_fees`,
                pool,
                action: 'creator_fees',
                title: `Creator trade fees — ${pending.toFixed(4)} COOK`,
                reason: 'Accumulated in the pool creator fee vault.',
                amountCook: pending,
              });
            }
          } catch {
            /* fees endpoint unavailable for this pool */
          }

          const vestRaw = BigInt(pool.creatorVestAmount || '0') - BigInt(pool.creatorVestClaimed || '0');
          const vestRemaining = Math.max(0, cookUi(vestRaw));
          const now = Date.now() / 1000;
          if (vestRemaining > 0 && now >= pool.creatorVestStart) {
            found.push({
              key: `${pool.pubkey}:creator_vest`,
              pool,
              action: 'creator_vest',
              title: `Creator vest — ${vestRemaining.toFixed(2)} COOK unvested`,
              reason:
                now >= pool.creatorVestEnd
                  ? 'The vest has fully unlocked.'
                  : `Unlocks until ${new Date(pool.creatorVestEnd * 1000).toLocaleDateString()}.`,
              amountCook: vestRemaining,
            });
          }
        }
      }

      found.sort((a, b) => (b.amountCook ?? 0) - (a.amountCook ?? 0));
      setScan({ obligations: found, poolsChecked: real.length, livePools: live, scannedAt: Date.now() });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Could not scan the launchpad for claimable balances.');
    } finally {
      setScanning(false);
    }
  }, [scanAddress, tx]);

  // A deep link that carries an address should just show the answer.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoScan || autoRan.current || !initialAddress) return;
    autoRan.current = true;
    void runScan();
  }, [autoScan, initialAddress, runScan]);

  /** Returns true when the claim confirmed, false on any failure. */
  const claim = async (o: Obligation): Promise<boolean> => {
    setClaimingKey(o.key);
    const sent = await tx.run(() =>
      o.action === 'creator_fees'
        ? buildClaimCreatorFeesTx({ creator: scanAddress, pool: o.pool.pubkey })
        : buildClaimTx({
            kind: o.action as ClaimKind,
            claimant: scanAddress,
            pool: o.pool.pubkey,
            amount: o.rawAmount,
            proof: o.proof,
          }),
    );
    if (sent) {
      setScan((prev) => (prev ? { ...prev, obligations: prev.obligations.filter((x) => x.key !== o.key) } : prev));
    }
    setClaimingKey(null);
    return Boolean(sent);
  };

  const claimAll = async () => {
    if (!scan) return;
    for (const o of [...scan.obligations]) {
      const ok = await claim(o);
      if (!ok) break; // stop the queue on the first failure so the error is readable
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="gutter pb-4 shrink-0">
        {/* Screen titles wear the landing's display type, so a tab and a hero
            read as the same voice. */}
        <h1 className="display text-[clamp(24px,3vw,34px)] mb-2.5">Claim center</h1>
        <p className="text-[13px] leading-relaxed text-[color:var(--ink-soft)] max-w-[68ch] mb-4">
          Refunds, settlement payouts, graduated tokens and creator earnings don't announce themselves — the launchpad
          shows a pool, an explorer shows an account, and your balance shows nothing until you claim. This scans every pool
          and puts what you're owed in one list.
        </p>
        <div className="flex items-center gap-3">
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runScan()}
            placeholder="Cookie Chain wallet address"
            spellCheck={false}
            className="field flex-1"
          />
          <button
            onClick={() => void runScan()}
            disabled={scanning || !scanAddress}
            className="btn btn-ink btn-sm h-[42px]"
          >
            {scanning ? <Loader2 size={13} className="animate-spin" /> : null}
            {scanning ? 'Scanning…' : 'Scan'}
          </button>
        </div>
        {wallet.address && wallet.address !== scanAddress && (
          <button onClick={() => setOwner(wallet.address as string)} className="link mt-2.5 text-[11px] cursor-pointer">
            Use connected wallet {shortAddr(wallet.address)}
          </button>
        )}
      </div>

      {scanError && <div className="gutter-x mb-3 alert-danger px-3.5 py-2.5 text-[12px]">{scanError}</div>}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!scan && !scanning && !scanError && (
          <div className="px-6 py-20 text-center text-[12.5px] text-[color:var(--ink-faint)]">
            Scan an address to see everything the launchpad owes it.
          </div>
        )}

        {scan && scan.obligations.length === 0 && (
          <div className="px-6 py-20 text-center text-[12.5px]">
            <div className="text-[15px] font-medium tracking-[-0.012em] mb-2">Nothing to claim</div>
            <div className="text-[color:var(--ink-soft)] max-w-[46ch] mx-auto leading-relaxed">
              {scan.poolsChecked} pools checked · {scan.livePools} still live. This address is not owed any refund,
              payout, graduated tokens or creator fees.
            </div>
            <div className="mt-2 text-[10.5px] text-[color:var(--ink-faint)] num">
              Scanned {new Date(scan.scannedAt).toLocaleTimeString()}
            </div>
          </div>
        )}

        {scan?.obligations.map((o) => (
          <div key={o.key} className="gutter py-4 flex items-start gap-4 hair-b">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[14.5px] font-medium tracking-[-0.012em] truncate">{o.pool.name}</span>
                <span className="shrink-0 text-[11.5px] text-[color:var(--ink-faint)]">${o.pool.symbol}</span>
                <span className="chip shrink-0">{o.pool.status}</span>
              </div>
              <div className="mt-1.5 text-[11.5px] text-[color:var(--ink-soft)]">{o.title}</div>
              <div className="mt-0.5 text-[10.5px] text-[color:var(--ink-faint)]">{o.reason}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[13.5px] whitespace-nowrap num">
                {o.amountCook === null ? (
                  <span className="text-[color:var(--ink-soft)]">SPL {o.pool.symbol}</span>
                ) : (
                  <>
                    {o.amountCook.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                    <span className="text-[10px] text-[color:var(--ink-faint)]">COOK</span>
                    {price && (
                      <div className="text-[10px] text-[color:var(--ink-faint)]">≈ ${(o.amountCook * price).toFixed(2)}</div>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={() => void claim(o)}
                disabled={!canClaim || tx.busy}
                title={canClaim ? 'Sign the claim' : 'Connect this wallet to sign the claim'}
                className="btn btn-ink btn-sm mt-2"
              >
                {claimingKey === o.key && tx.busy ? 'Claiming…' : 'Claim'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {(tx.busy || tx.error || tx.result) && (
        <div className="shrink-0 hair-t gutter py-4 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="label">Claim progress</span>
            {tx.error && (
              <span className="text-[11px] neg max-w-[52ch] truncate" title={tx.error}>
                {tx.error}
              </span>
            )}
            {tx.result && (
              <a
                href={explorerTx(tx.result.signature)}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] link inline-flex items-center gap-1.5"
                style={{ color: 'var(--live)' }}
              >
                <Check size={11} strokeWidth={2} /> confirmed on Cookiescan <ExternalLink size={10} strokeWidth={1.75} />
              </a>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
            {VISIBLE_STAGES.map((s) => {
              const status = tx.progress.status[s.stage];
              return (
                <div key={s.stage} className="flex items-start gap-2.5 text-[11.5px]">
                  <span className="w-3.5 h-3.5 mt-[2px] shrink-0 flex items-center justify-center">
                    {status === 'ok' && <Check size={11} strokeWidth={2} style={{ color: 'var(--live)' }} />}
                    {status === 'fail' && <span className="neg text-[11px]">×</span>}
                    {status === 'start' && <Loader2 size={10} className="animate-spin opacity-55" />}
                  </span>
                  <span className="min-w-0">
                    <span className={status ? '' : 'text-[color:var(--ink-faint)]'}>{s.label}</span>
                    {tx.progress.detail[s.stage] && (
                      <span className="block text-[10px] text-[color:var(--ink-faint)] break-words">
                        {tx.progress.detail[s.stage]}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {scan && scan.obligations.length > 0 && (
        <div className="shrink-0 hair-t gutter py-3.5 flex items-center justify-between gap-4">
          <span className="text-[12px] text-[color:var(--ink-soft)] num">
            {scan.obligations.length} claimable item{scan.obligations.length === 1 ? '' : 's'} across {scan.poolsChecked}{' '}
            pools
          </span>
          <div className="flex items-center gap-4">
            <span className="text-[12.5px] font-medium whitespace-nowrap num">
              {claimableCook.toLocaleString(undefined, { maximumFractionDigits: 2 })} COOK
              {price && <span className="text-[color:var(--ink-faint)] font-normal"> ≈ ${(claimableCook * price).toFixed(2)}</span>}
            </span>
            <button
              onClick={() => void claimAll()}
              disabled={!canClaim || tx.busy}
              title={canClaim ? 'Claim everything in sequence' : 'Connect this wallet to sign'}
              className="btn btn-ink btn-sm"
            >
              Claim all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
