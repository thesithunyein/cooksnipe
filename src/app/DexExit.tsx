import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Loader2, Route } from 'lucide-react';
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
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
          <Route size={12} /> Exit via Cookiebox
        </div>
        {balance !== null && (
          <div className="text-[10.5px] text-white/40">
            balance {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.symbol}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <input
          inputMode="decimal"
          placeholder={`$${pool.symbol} to sell`}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          className="flex-1 bg-black/40 border border-white/10 rounded px-3.5 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#3ddc84]/50"
        />
        <select
          value={slippageBps}
          onChange={(e) => setSlippageBps(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded px-2 py-2.5 text-[11px] text-white/70 outline-none cursor-pointer"
          title="Slippage tolerance"
        >
          {SLIPPAGE.map((s) => (
            <option key={s} value={s} className="bg-black">
              {(s / 100).toFixed(1)}% slip
            </option>
          ))}
        </select>
      </div>

      {balance !== null && balance > 0 && (
        <button
          onClick={() => setAmount(String(balance))}
          className="mt-2 text-[10.5px] text-[#3ddc84] hover:underline cursor-pointer"
        >
          Sell everything ({balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.symbol})
        </button>
      )}

      {quoting && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/45">
          <Loader2 size={12} className="animate-spin" /> Asking Cookiebox for a route…
        </div>
      )}

      {quote && !quoting && (
        <div className="mt-3 text-[12px] text-white/75 space-y-1 border-t border-white/5 pt-3">
          <div className="flex justify-between">
            <span className="text-white/45">You receive (est.)</span>
            <span>{outCook.toLocaleString(undefined, { maximumFractionDigits: 4 })} COOK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Minimum after slippage</span>
            <span>{minOut.toLocaleString(undefined, { maximumFractionDigits: 4 })} COOK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Router fee</span>
            <span>
              {quote.feePct.toFixed(2)}% · {Number(quote.feeAmount) / 1e9 > 0 ? `${(Number(quote.feeAmount) / 1e9).toFixed(4)} COOK` : 'included'}
            </span>
          </div>
          {quote.priceImpactPct !== null && (
            <div className="flex justify-between">
              <span className="text-white/45">Price impact</span>
              <span className={quote.priceImpactPct > 5 ? 'text-amber-300' : ''}>
                {quote.priceImpactPct.toFixed(2)}%
              </span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-white/45 shrink-0">Route</span>
            <span className="text-right text-[11px] text-white/60 truncate" title={quote.path.join(' → ')}>
              {quote.isSplit ? `${quote.segments.length}-way split · ` : ''}
              {quote.segments.map((s) => s.venue).join(' → ') || 'direct'}
            </span>
          </div>
        </div>
      )}

      {quoteError && (
        <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-300/90">
          <AlertTriangle size={12} className="mt-[2px] shrink-0" />
          {quoteError}
        </div>
      )}

      {overBalance && (
        <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-300/90">
          <AlertTriangle size={12} className="mt-[2px] shrink-0" />
          You hold {balance?.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.symbol}. Claim graduated
          tokens first if you have curve shares left.
        </div>
      )}

      <button
        onClick={() => void sell()}
        disabled={!canSell}
        className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-lg bg-[#3ddc84] text-black py-2.5 text-[12.5px] font-semibold hover:bg-[#54e79b] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default"
      >
        {tx.busy ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />}
        {tx.busy ? 'Working…' : 'Sell on the DEX'}
      </button>

      {(tx.busy || tx.error || tx.result) && (
        <div className="mt-3.5 border-t border-white/5 pt-3.5 space-y-2">
          {VISIBLE_STAGES.map((s) => (
            <div key={s.stage} className="flex items-start gap-2.5 text-[12px]">
              <span className="w-4 h-4 mt-[2px] shrink-0 flex items-center justify-center">
                {tx.progress.status[s.stage] === 'ok' && <Check size={13} className="text-[#3ddc84]" />}
                {tx.progress.status[s.stage] === 'fail' && <span className="text-red-400 text-[12px]">×</span>}
                {tx.progress.status[s.stage] === 'start' && <Loader2 size={13} className="text-white/60 animate-spin" />}
              </span>
              <span className="min-w-0">
                <span className={tx.progress.status[s.stage] ? 'text-white/85' : 'text-white/30'}>{s.label}</span>
                {tx.progress.detail[s.stage] && (
                  <span className="block text-[10.5px] text-white/40 mt-0.5 break-words">
                    {tx.progress.detail[s.stage]}
                  </span>
                )}
              </span>
            </div>
          ))}
          {tx.error && (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300 leading-relaxed">
              {tx.error}
            </div>
          )}
          {tx.result && (
            <a
              href={explorerTx(tx.result.signature)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-[#3ddc84]/30 bg-[#3ddc84]/10 px-3 py-2 text-[11px] text-[#3ddc84] break-all hover:underline"
            >
              <Check size={12} className="shrink-0" /> Swapped — {tx.result.signature.slice(0, 18)}…
              <ExternalLink size={10} className="shrink-0" />
            </a>
          )}
        </div>
      )}

      <div className="mt-3 text-[10px] text-white/35 leading-relaxed">
        Routed by Cookiebox (agg.cookiebox.app). The router returns no instruction description, so this path is verified
        by simulation rather than byte comparison — the pipeline says so at the check step above.
      </div>
    </div>
  );
}
