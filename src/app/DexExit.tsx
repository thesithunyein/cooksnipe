import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Route } from 'lucide-react';
import { buildAggSwapTx, quoteAgg, type AggQuote } from '../lib/cookiebox';
import { COOK_MINT, TOKEN_DECIMALS, explorerTx } from '../lib/chain';
import { getWalletAssets } from '../lib/das';
import type { LaunchRow } from '../lib/types';
import { VISIBLE_STAGES, useTx } from './useTx';
import type { WalletState } from './useWallet';

interface DexExitProps {
  pool: LaunchRow;
  wallet: WalletState;
  onDone: () => void;
}

const SLIPPAGE = [50, 100, 300];

/**
 * The exit that exists after graduation.
 *
 * Once a pool graduates and its tokens have real DEX liquidity, the bonding
 * curve is done: getting out means a swap. That is what Cookiebox's aggregator
 * is for, so this quotes the route through it (splitting across pools when it
 * pays to), shows the fee and price impact before anything is signed, and then
 * runs the swap through the same sign/confirm pipeline as every other action.
 */
export function DexExit({ pool, wallet, onDone }: DexExitProps) {
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(100);
  const [quote, setQuote] = useState<AggQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const tx = useTx(wallet);

  // The wallet's real SPL balance of this token, straight from the DAS index —
  // curve shares are not tokens, so we show the tokens that actually exist.
  useEffect(() => {
    let cancelled = false;
    setBalance(null);
    if (!wallet.address) return;
    getWalletAssets(wallet.address).then((assets) => {
      if (cancelled) return;
      const mine = assets.find((a) => a.mint === pool.tokenMint);
      setBalance(mine ? mine.balance : 0);
    });
    return () => {
      cancelled = true;
    };
  }, [wallet.address, pool.tokenMint]);

  const amountRaw = useMemo(() => {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) return null;
    return String(Math.round(value * 10 ** TOKEN_DECIMALS));
  }, [amount]);

  useEffect(() => {
    if (!amountRaw) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    setQuoteError(null);
    quoteAgg({
      inputMint: pool.tokenMint,
      outputMint: COOK_MINT,
      amount: amountRaw,
      slippageBps,
      owner: wallet.address ?? undefined,
    })
      .then((q) => {
        if (cancelled) return;
        if (!q) setQuoteError('Cookiebox has no route for this token — there may be no DEX liquidity yet.');
        setQuote(q);
      })
      .catch((e) => {
        if (!cancelled) setQuoteError(e instanceof Error ? e.message : 'Could not reach the Cookiebox router.');
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [amountRaw, slippageBps, pool.tokenMint, wallet.address]);

  const outCook = quote ? Number(quote.netOutAmount) / 1e9 : 0;
  const minOut = quote ? Number(quote.minOutAmount) / 1e9 : 0;
  const feeCook = quote ? Number(quote.feeAmount) / 1e9 : 0;
  const overBalance = balance !== null && Number(amount) > balance;

  const sell = async () => {
    if (!wallet.address || !amountRaw) return;
    const sent = await tx.run(
      async () => {
        const built = await buildAggSwapTx({
          inputMint: pool.tokenMint,
          outputMint: COOK_MINT,
          amount: amountRaw,
          slippageBps,
          owner: wallet.address as string,
        });
        return {
          transactionBase64: built.transactionBase64,
          blockhash: built.blockhash,
          lastValidBlockHeight: built.lastValidBlockHeight,
        };
      },
      { allowUndescribed: true },
    );
    if (sent) {
      setAmount('');
      onDone();
    }
  };

  const canSell = Boolean(wallet.address) && Boolean(quote) && !overBalance && !tx.busy;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3.5 gap-3">
        <span className="label inline-flex items-center gap-2">
          <Route size={12} strokeWidth={1.75} /> Exit via Cookiebox
        </span>
        {balance !== null && (
          <span className="text-[11px] text-[color:var(--ink-faint)] num">
            balance {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.symbol}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          inputMode="decimal"
          placeholder={`$${pool.symbol} to sell`}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          className="field flex-1 num"
        />
        <select
          value={slippageBps}
          onChange={(e) => setSlippageBps(Number(e.target.value))}
          aria-label="Slippage tolerance"
          className="h-[42px] rounded-[10px] border border-[color:var(--rule)] bg-white px-2.5 text-[11.5px] text-[color:var(--ink-soft)] outline-none cursor-pointer"
        >
          {SLIPPAGE.map((s) => (
            <option key={s} value={s}>
              {(s / 100).toFixed(1)}% slip
            </option>
          ))}
        </select>
      </div>

      {balance !== null && balance > 0 && (
        <button onClick={() => setAmount(String(balance))} className="link mt-2.5 text-[11px] cursor-pointer">
          Sell everything ({balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.symbol})
        </button>
      )}

      {quoting && (
        <div className="mt-4 flex items-center gap-2 text-[11.5px] text-[color:var(--ink-faint)]">
          <Loader2 size={12} className="animate-spin" /> Asking Cookiebox for a route…
        </div>
      )}

      {quote && !quoting && (
        <div className="mt-4 pt-3.5 border-t border-[color:var(--rule-soft)] space-y-1.5 text-[12.5px] num">
          <div className="flex justify-between">
            <span className="text-[color:var(--ink-soft)]">You receive (est.)</span>
            <span>{outCook.toLocaleString(undefined, { maximumFractionDigits: 4 })} COOK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[color:var(--ink-soft)]">Minimum after slippage</span>
            <span>{minOut.toLocaleString(undefined, { maximumFractionDigits: 4 })} COOK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[color:var(--ink-soft)]">Router fee</span>
            <span>{feeCook > 0 ? `${quote.feePct.toFixed(2)}% · ${feeCook.toFixed(6)} COOK` : 'included in route'}</span>
          </div>
          {quote.priceImpactPct !== null && (
            <div className="flex justify-between">
              <span className="text-[color:var(--ink-soft)]">Price impact</span>
              <span className={quote.priceImpactPct > 5 ? 'warnc' : ''}>{quote.priceImpactPct.toFixed(2)}%</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--ink-soft)] shrink-0">Route</span>
            <span
              className="text-right text-[11.5px] text-[color:var(--ink-faint)] truncate"
              title={quote.path.join(' → ')}
            >
              {quote.isSplit ? `${quote.segments.length}-way split · ` : ''}
              {quote.segments.map((s) => s.venue).join(' → ') || 'direct'}
            </span>
          </div>
        </div>
      )}

      {quoteError && <div className="mt-3.5 alert-warn px-3 py-2.5 text-[11.5px]">{quoteError}</div>}

      {overBalance && (
        <div className="mt-3.5 alert-warn px-3 py-2.5 text-[11.5px] leading-relaxed">
          You hold {balance?.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.symbol}. Claim graduated
          tokens first if you have curve shares left.
        </div>
      )}

      <button onClick={() => void sell()} disabled={!canSell} className="btn btn-ink w-full mt-4">
        {tx.busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {tx.busy ? 'Working…' : 'Sell on the DEX'}
      </button>

      {(tx.busy || tx.error || tx.result) && (
        <div className="mt-4 pt-4 border-t border-[color:var(--rule-soft)] space-y-2">
          {VISIBLE_STAGES.map((s) => (
            <div key={s.stage} className="flex items-start gap-2.5 text-[12px]">
              <span className="w-4 h-4 mt-[2px] shrink-0 flex items-center justify-center">
                {tx.progress.status[s.stage] === 'ok' && <Check size={12} strokeWidth={2} style={{ color: 'var(--live)' }} />}
                {tx.progress.status[s.stage] === 'fail' && <span className="neg text-[12px]">×</span>}
                {tx.progress.status[s.stage] === 'start' && <Loader2 size={11} className="animate-spin opacity-55" />}
              </span>
              <span className="min-w-0">
                <span className={tx.progress.status[s.stage] ? '' : 'text-[color:var(--ink-faint)]'}>{s.label}</span>
                {tx.progress.detail[s.stage] && (
                  <span className="block text-[10.5px] text-[color:var(--ink-faint)] mt-0.5 break-words">
                    {tx.progress.detail[s.stage]}
                  </span>
                )}
              </span>
            </div>
          ))}
          {tx.error && <div className="alert-danger px-3 py-2.5 text-[11.5px] leading-relaxed">{tx.error}</div>}
          {tx.result && (
            <a
              href={explorerTx(tx.result.signature)}
              target="_blank"
              rel="noreferrer"
              className="alert-live px-3 py-2.5 text-[11.5px] block break-all"
            >
              Swapped — {tx.result.signature}
            </a>
          )}
        </div>
      )}

      <p className="mt-4 text-[10.5px] leading-relaxed text-[color:var(--ink-faint)]">
        Routed by Cookiebox (agg.cookiebox.app). The router returns no instruction description, so this path is verified by
        simulation rather than byte comparison — the pipeline says so at the check step above.
      </p>
    </div>
  );
}
