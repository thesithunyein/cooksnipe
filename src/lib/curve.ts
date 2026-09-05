// Constant-product bonding-curve math for the MomoSwap launchpad.
// BigInt port of the on-chain program's rounding, credited to the MIT-licensed
// cookiechain/cookie-mcp reference implementation.
import type { LaunchRow } from './types';

const BPS = 10_000n;

/** Spot price: COOK UI units per 1 token (UI units). Never throws. */
export function spotPrice(pool: LaunchRow): number {
  try {
    const x = BigInt(pool.virtualPaymentReserve);
    const y = BigInt(pool.virtualTokenReserve);
    if (y <= 0n) return 0;
    // (x/1e9) COOK per (y/1e6) tokens  =>  x / (1000 * y)
    return Number(x) / Number(y) / 1000;
  } catch {
    return 0;
  }
}

/** Tokens out (base units) for a payment in (base units), before fees. */
function tokensForPayment(pool: LaunchRow, paymentRaw: bigint): bigint {
  const xOld = BigInt(pool.virtualPaymentReserve);
  const yOld = BigInt(pool.virtualTokenReserve);
  const xNew = xOld + paymentRaw;
  const k = xOld * yOld; // invariant uses PRE-trade reserves
  const yNew = k / xNew;
  return yOld - yNew;
}

/** COOK out (base units) for selling tokensRaw (base units), before fees. */
function paymentForTokens(pool: LaunchRow, tokensRaw: bigint): bigint {
  const xOld = BigInt(pool.virtualPaymentReserve);
  const yOld = BigInt(pool.virtualTokenReserve);
  const yNew = yOld - tokensRaw; // tokens leave the curve
  if (yNew <= 0n) return 0n; // cannot sell more than the reserve
  const k = xOld * yOld; // invariant uses PRE-trade reserves
  const xNew = k / yNew; // payment reserve grows on a sell
  return xNew - xOld;
}

export interface BuyEstimate {
  feeRaw: bigint;
  tokensOutRaw: bigint;
}

/** Buy quote including the protocol trade fee (fee taken from payment first). */
export function estimateBuy(pool: LaunchRow, paymentRaw: bigint, tradeFeeBps: number): BuyEstimate {
  const feeRaw = (paymentRaw * BigInt(tradeFeeBps)) / BPS;
  const netRaw = paymentRaw - feeRaw;
  const tokensOutRaw = tokensForPayment(pool, netRaw);
  return { feeRaw, tokensOutRaw };
}

export interface SellEstimate {
  feeRaw: bigint;
  netRaw: bigint;
}

/** Sell quote: fee taken from the COOK proceeds. */
export function estimateSell(pool: LaunchRow, tokensRaw: bigint, tradeFeeBps: number): SellEstimate {
  const grossRaw = paymentForTokens(pool, tokensRaw);
  const feeRaw = (grossRaw * BigInt(tradeFeeBps)) / BPS;
  return { feeRaw, netRaw: grossRaw - feeRaw };
}

export interface PoolStats {
  price: number; // COOK per token
  raised: number; // COOK UI units
  marketCap: number; // COOK UI units (virtual)
  progress: number; // 0..100 to graduation target
}

/** Safe aggregate stats for UI. Never throws on degenerate pools. */
export function poolStats(pool: LaunchRow): PoolStats {
  try {
    const price = spotPrice(pool);
    const raised = Number(BigInt(pool.paymentRaisedNet)) / 1e9;
    const marketCap = Number(BigInt(pool.virtualPaymentReserve)) / 1e9;
    const target = Number(BigInt(pool.graduationTarget)) / 1e9;
    const progress = target > 0 ? Math.min(100, (raised / target) * 100) : 0;
    return { price, raised, marketCap, progress };
  } catch {
    return { price: 0, raised: 0, marketCap: 0, progress: 0 };
  }
}