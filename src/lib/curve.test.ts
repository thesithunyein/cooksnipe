import { describe, expect, it } from 'vitest';
import { estimateBuy, estimateSell, poolStats, spotPrice } from './curve';
import type { LaunchRow } from './types';

/** A live-shaped pool: 360k COOK virtual against 1.073B tokens, 1% trade fee. */
const pool = (over: Partial<LaunchRow> = {}): LaunchRow =>
  ({
    pubkey: 'pool',
    paymentMint: 'So11111111111111111111111111111111111111112',
    tokenMint: 'token',
    status: 'live',
    expiryMode: 'fair',
    tradeFeeBps: 100,
    virtualPaymentReserve: '360000000000000',
    virtualTokenReserve: '1073000000000000',
    graduationTarget: '1000000000000000',
    paymentRaisedNet: '106170000000000',
    saleTokenSupply: '800000000000000',
    tokensSold: '305000000000000',
    minBuy: '0',
    maxBuyPerWallet: '0',
    ...over,
  }) as unknown as LaunchRow;

const COOK = 10n ** 9n;

describe('spotPrice', () => {
  it('reads COOK per token from the virtual reserves', () => {
    // 360000 (COOK) / 1.073e9 (tokens) = 0.0003355…
    expect(spotPrice(pool())).toBeCloseTo(360000 / 1_073_000_000, 12);
  });

  it('returns 0 instead of throwing on a degenerate pool', () => {
    expect(spotPrice(pool({ virtualTokenReserve: '0' }))).toBe(0);
    expect(spotPrice(pool({ virtualPaymentReserve: 'not a number' }))).toBe(0);
  });
});

describe('estimateBuy', () => {
  it('takes the fee off the payment, then prices the rest on the curve', () => {
    const { feeRaw, tokensOutRaw } = estimateBuy(pool(), 5000n * COOK, 100);
    expect(feeRaw).toBe(50n * COOK); // 1% of 5000 COOK
    // y - (k / (x + net)) with PRE-trade reserves, exactly as the program does it.
    const x = 360000000000000n;
    const y = 1073000000000000n;
    expect(tokensOutRaw).toBe(y - (x * y) / (x + 4950n * COOK));
    // Sanity: a 5,000 COOK buy lands near the spot price.
    expect(Number(tokensOutRaw) / 1e6).toBeGreaterThan(14_000_000);
    expect(Number(tokensOutRaw) / 1e6).toBeLessThan(15_000_000);
  });

  it('gives fewer tokens per COOK as size grows (price impact is real)', () => {
    const small = estimateBuy(pool(), 1000n * COOK, 100).tokensOutRaw;
    const big = estimateBuy(pool(), 100_000n * COOK, 100).tokensOutRaw;
    const perSmall = Number(small) / 1000;
    const perBig = Number(big) / 100_000;
    expect(perBig).toBeLessThan(perSmall);
  });

  it('charges no fee when the pool sets none', () => {
    expect(estimateBuy(pool(), 1000n * COOK, 0).feeRaw).toBe(0n);
  });
});

describe('estimateSell', () => {
  it('takes the fee off the proceeds rather than the input', () => {
    const { feeRaw, netRaw } = estimateSell(pool(), 5_000_000n * 10n ** 6n, 100);
    const gross = netRaw + feeRaw;
    expect(feeRaw).toBe(gross / 100n); // 1% of proceeds
    expect(netRaw).toBeGreaterThan(0n);
  });

  it('round-trips worse than it bought, because both directions charge the fee', () => {
    const bought = estimateBuy(pool(), 1000n * COOK, 100).tokensOutRaw;
    const back = estimateSell(pool(), bought, 100).netRaw;
    expect(back).toBeLessThan(1000n * COOK);
  });

  it('refuses to price a sell larger than the token reserve', () => {
    expect(estimateSell(pool(), 2_000_000_000_000_000n, 100).netRaw).toBe(0n);
  });
});

describe('poolStats', () => {
  it('computes graduation progress from net raised against the target', () => {
    const stats = poolStats(pool());
    expect(stats.raised).toBeCloseTo(106_170, 3);
    expect(stats.progress).toBeCloseTo(10.617, 3);
    expect(stats.price).toBeGreaterThan(0);
  });

  it('never reports more than 100% complete, and never throws on junk', () => {
    expect(poolStats(pool({ paymentRaisedNet: '9000000000000000' })).progress).toBe(100);
    expect(poolStats(pool({ graduationTarget: '0' })).progress).toBe(0);
    expect(poolStats(pool({ virtualPaymentReserve: 'x' })).price).toBe(0);
  });
});
