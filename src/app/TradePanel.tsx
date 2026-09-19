import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownUp, Check, ExternalLink, Loader2, X } from 'lucide-react';
import { buildBuyTx, buildSellTx, fetchPosition } from '../lib/api';
import { estimateBuy, estimateSell } from '../lib/curve';
import { explorerTx } from '../lib/chain';
import { formatCook } from '../lib/format';
import type { StageStatus } from '../lib/tx';
import type { LaunchRow, LaunchpadPosition } from '../lib/types';
import { VISIBLE_STAGES, useTx } from './useTx';
import type { WalletState } from './useWallet';

const COOK_RAW = 1e9;
const SHARE_RAW = 1e6;

interface TradePanelProps {
  pool: LaunchRow;
  wallet: WalletState;
  onDone: () => void;
}

type Mode = 'buy' | 'sell';

function StageRow({ status, detail, label }: { status?: StageStatus; detail?: string; label: string }) {
  return (
    <div className="flex items-start gap-2.5 text-[12px]">
      <span className="w-4 h-4 mt-[2px] shrink-0 flex items-center justify-center">
        {status === 'ok' && <Check size={13} className="text-[#3ddc84]" />}
        {status === 'fail' && <X size={13} className="text-red-400" />}
        {status === 'start' && <Loader2 size={13} className="text-white/60 animate-spin" />}
      </span>
      <span className="min-w-0">
        <span className={status ? 'text-white/85' : 'text-white/30'}>{label}</span>
        {detail && <span className="block text-[10.5px] text-white/40 mt-0.5 break-words">{detail}</span>}
      </span>
    </div>
  );
}

/**
 * Buy and sell against a bonding curve, live.
 *
 * The quote shown here is computed locally with the same maths the program runs
 * (lib/curve.ts, a BigInt port of the reference implementation) so the numbers on
 * screen are checkable; the amount that actually gets signed is whatever the pool
 * accepts, and the pipeline refuses to sign anything it cannot verify.
 */
export function TradePanel({ pool, wallet, onDone }: TradePanelProps) {
  const [mode, setMode] = useState<Mode>('buy');
  const [amount, setAmount] = useState('');
  const [position, setPosition] = useState<LaunchpadPosition | null>(null);
  const [posLoading, setPosLoading] = useState(false);
  const tx = useTx(wallet);

  const feeBps = pool.tradeFeeBps ?? 100;
  const connected = Boolean(wallet.address);

  const loadPosition = async () => {
    if (!wallet.address || pool.demo) {
      setPosition(null);
      return;
    }
    setPosLoading(true);
    try {
      setPosition(await fetchPosition(pool.pubkey, wallet.address));
    } catch {
      setPosition(null); // the trade itself will surface a real error
    } finally {
      setPosLoading(false);
    }
  };

  useEffect(() => {
    void loadPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.address, pool.pubkey, pool.tokensSold]);

  const shares = useMemo(() => (position ? BigInt(position.shares || '0') : 0n), [position]);
  const sharesUi = Number(shares) / SHARE_RAW;

  const quote = useMemo(() => {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) return null;
    try {
      if (mode === 'buy') {
        const paymentRaw = BigInt(Math.round(value * COOK_RAW));
        const est = estimateBuy(pool, paymentRaw, feeBps);
        return {
          inCook: value,
          outTokens: Number(est.tokensOutRaw) / SHARE_RAW,
          feeCook: Number(est.feeRaw) / COOK_RAW,
        };
      }
      const tokenRaw = BigInt(Math.round(value * SHARE_RAW));
      const est = estimateSell(pool, tokenRaw, feeBps);
      return {
        inCook: Number(est.netRaw) / COOK_RAW,
        outTokens: value,
        feeCook: Number(est.feeRaw) / COOK_RAW,
      };
    } catch {
      return null;
    }
  }, [amount, mode, pool, feeBps]);

  // Limits straight from the pool: the program enforces these, so we say them first.
  const limitIssue = useMemo(() => {
    if (mode !== 'buy') return null;
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) return null;
    const minBuy = Number(BigInt(pool.minBuy || '0')) / COOK_RAW;
    const cap = Number(BigInt(pool.maxBuyPerWallet || '0')) / COOK_RAW;
    if (minBuy > 0 && value < minBuy) return `This pool requires at least ${formatCook(pool.minBuy)} COOK per buy.`;
    if (cap > 0 && value > cap) return `This pool caps each wallet at ${formatCook(pool.maxBuyPerWallet)} COOK.`;
    const remaining = Number(BigInt(pool.saleTokenSupply) - BigInt(pool.tokensSold)) / SHARE_RAW;
    if (quote && quote.outTokens > remaining) return 'That is more than the tokens left on the curve.';
    return null;
  }, [amount, mode, pool, quote]);

  const sellIssue = useMemo(() => {
    if (mode !== 'sell') return null;
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) return null;
    if (!position || shares === 0n) return 'This wallet has no curve position in this pool.';
    if (value > sharesUi) return `You hold ${sharesUi.toLocaleString(undefined, { maximumFractionDigits: 2 })} curve shares.`;
    return null;
  }, [amount, mode, position, shares, sharesUi]);

  const blocked = !connected
    ? 'Connect a wallet to trade.'
    : pool.demo
      ? 'Demo pools are simulated — trading is disabled.'
      : pool.status !== 'live'
        ? `This pool is ${pool.status}; nothing left to trade on the curve.`
        : null;

  const issue = limitIssue ?? sellIssue;
  const canSubmit = !blocked && !issue && Boolean(quote) && !tx.busy;

  const submit = async () => {
    const value = Number(amount);
    if (!wallet.address || !Number.isFinite(value) || value <= 0) return;
    const owner = wallet.address;
    const sent = await tx.run(() =>
      mode === 'buy'
        ? buildBuyTx({ buyer: owner, pool: pool.pubkey, paymentAmount: String(Math.round(value * COOK_RAW)) })
        : buildSellTx({ seller: owner, pool: pool.pubkey, tokenShares: String(Math.round(value * SHARE_RAW)) }),
    );
    if (sent) {
      setAmount('');
      await loadPosition();
      onDone();
    }
  };

  const stageState = (stage: (typeof VISIBLE_STAGES)[number]['stage']) => ({
    status: tx.progress.status[stage],
    detail: tx.progress.detail[stage],
  });

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3.5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Trade</div>
        <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-0.5">
          {(['buy', 'sell'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setAmount('');
                tx.reset();
              }}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold capitalize cursor-pointer transition-colors ${
                mode === m ? 'bg-white text-black' : 'text-white/55 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {position && (
        <div className="mb-3 flex items-center justify-between text-[11px] text-white/50">
          <span>Your curve shares</span>
          <span className="text-white/80">
            {posLoading ? '…' : sharesUi.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.symbol}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <div className="flex-1 relative">
          <input
            inputMode="decimal"
            placeholder={mode === 'buy' ? 'COOK to spend' : `$${pool.symbol} shares to sell`}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full bg-black/40 border border-white/10 rounded px-3.5 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#3ddc84]/50"
          />
          {mode === 'sell' && position && sharesUi > 0 && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              {[0.25, 0.5, 1].map((f) => (
                <button
                  key={f}
                  onClick={() => setAmount((sharesUi * f).toString())}
                  className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/70 hover:bg-white/20 cursor-pointer"
                >
                  {f === 1 ? 'MAX' : `${f * 100}%`}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-[12px] text-white/45 w-14 shrink-0">{mode === 'buy' ? 'COOK' : 'shares'}</span>
      </div>

      {quote && !issue && (
        <div className="mt-3 text-[12px] text-white/75 space-y-1 border-t border-white/5 pt-3">
          <div className="flex justify-between">
            <span className="text-white/45">{mode === 'buy' ? `You receive (est.)` : 'You receive (est.)'}</span>
            <span>
              {mode === 'buy'
                ? `${quote.outTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} $${pool.symbol}`
                : `${quote.inCook.toFixed(6)} COOK`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Trade fee ({(feeBps / 100).toFixed(2)}%)</span>
            <span>{quote.feeCook.toFixed(6)} COOK</span>
          </div>
        </div>
      )}

      {(blocked || issue) && (
        <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-300/90">
          <AlertTriangle size={12} className="mt-[2px] shrink-0" />
          <span>{issue ?? blocked}</span>
        </div>
      )}

      <button
        onClick={() => void submit()}
        disabled={!canSubmit}
        className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-lg bg-[#3ddc84] text-black py-2.5 text-[12.5px] font-semibold hover:bg-[#54e79b] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default"
      >
        {tx.busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownUp size={14} />}
        {tx.busy ? 'Working…' : mode === 'buy' ? `Buy $${pool.symbol}` : `Sell $${pool.symbol}`}
      </button>

      {(tx.busy || tx.error || tx.result) && (
        <div className="mt-3.5 border-t border-white/5 pt-3.5 space-y-2">
          {VISIBLE_STAGES.map((s) => (
            <StageRow key={s.stage} {...stageState(s.stage)} label={s.label} />
          ))}

          {tx.error && (
            <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300 leading-relaxed">
              {tx.error}
            </div>
          )}

          {tx.result && (
            <div className="mt-2 rounded border border-[#3ddc84]/30 bg-[#3ddc84]/10 px-3 py-2 text-[11px] text-[#3ddc84]">
              <div className="flex items-center gap-1.5 font-semibold">
                <Check size={12} /> Confirmed on Cookie Chain
              </div>
              <a
                href={explorerTx(tx.result.signature)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 break-all hover:underline"
              >
                {tx.result.signature.slice(0, 20)}… <ExternalLink size={10} className="shrink-0" />
              </a>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 text-[10px] text-white/35 leading-relaxed">
        You sign an unsigned transaction built by the launchpad API; CookSnipe verifies every instruction against the
        description it returned, simulates it, and broadcasts it over the Cookie Chain RPC itself — your wallet never
        sends it to another chain.
      </div>
    </div>
  );
}
