// Cookiebox aggregator client (agg.cookiebox.app) — Cookie Chain's own routing
// service, the same one that powers cookiebox.app's trade page. Used here for the
// exit path: once a launchpad token graduates and has real DEX liquidity,
// graduating out of it means a swap, not a curve sell.
//
// The aggregator sends `Access-Control-Allow-Origin: *`, so the browser can call
// it directly (verified against the live endpoint) — no proxy needed.
//
// This endpoint does NOT return an instruction map, so unlike the launchpad
// builds there is nothing to check byte-for-byte. We still simulate before
// signing, and we never let the wallet broadcast.
import { COOK_MINT, TOKEN_DECIMALS } from './chain';

const AGG = 'https://agg.cookiebox.app';
const NATIVE_MINT = COOK_MINT;

export interface AggQuote {
  inAmount: string;
  outAmount: string;
  feePct: number;
  feeAmount: string;
  netOutAmount: string;
  minOutAmount: string;
  priceImpactPct: number | null;
  path: string[];
  isSplit: boolean;
  segments: Array<{ venue: string; pool: string; inAmount: string; outAmount: string; inputMint: string; outputMint: string }>;
  warnings?: Array<{ mint: string; title: string; detail: string }>;
}

export interface AggSwapTx {
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
  route: AggQuote;
}

/** Quote a swap. Returns null when the aggregator has no route for the pair. */
export async function quoteAgg(args: {
  inputMint: string;
  outputMint: string;
  amount: string; // base units of the input mint
  slippageBps: number;
  owner?: string;
}): Promise<AggQuote | null> {
  const q = new URLSearchParams({
    inputMint: args.inputMint,
    outputMint: args.outputMint,
    amount: args.amount,
    slippageBps: String(args.slippageBps),
    ...(args.owner ? { owner: args.owner } : {}),
  });
  const res = await fetch(`${AGG}/quote?${q}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cookiebox could not quote this pair (HTTP ${res.status}).`);
  const body = (await res.json()) as { route?: AggQuote };
  return body.route ?? null;
}

/** Ask Cookiebox to build the swap. The tx is unsigned apart from its ephemeral legs. */
export async function buildAggSwapTx(args: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  owner: string;
}): Promise<AggSwapTx> {
  const res = await fetch(`${AGG}/swap-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cookiebox could not build the swap (HTTP ${res.status})${text ? `: ${text.slice(0, 120)}` : ''}`);
  }
  return (await res.json()) as AggSwapTx;
}

/** UI COOK per token, from a raw quote pair. */
export function priceFromQuote(inputAmount: string, outputAmount: string, inputIsCook: boolean, outputIsCook: boolean, inputDecimals: number, outputDecimals: number): number {
  const inUi = Number(inputAmount) / 10 ** inputDecimals;
  const outUi = Number(outputAmount) / 10 ** outputDecimals;
  if (!inUi || !outUi) return 0;
  if (inputIsCook) return inUi / outUi;
  if (outputIsCook) return outUi / inUi;
  return 0;
}

export const NATIVE_COOK_MINT = NATIVE_MINT;
export { TOKEN_DECIMALS };
