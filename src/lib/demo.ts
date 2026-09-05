// Demo-mode data generator. The MomoSwap launchpad is live on Cookie Chain but
// the chain is often quiet (zero pools), so this produces plausible,
// clearly-flagged launches so the radar UI can be evaluated.
// Every row carries `demo: true` and the UI shows a persistent DEMO banner.
import type { LaunchRow } from './types';

const COOK_MINT = 'So11111111111111111111111111111111111111112';
const VIRTUAL_PAYMENT_RESERVE = '176471000000000'; // 176,471 COOK (9 decimals)
const VIRTUAL_TOKEN_RESERVE = '1073000000000000'; // 1,073,000,000 tokens (6 decimals)
const TOTAL_SUPPLY = '1000000000000000'; // 1B tokens
const SALE_SUPPLY = '800000000000000'; // 800M tokens on the curve
const GRADUATION_TARGET = '500000000000000'; // 500K COOK raise -> graduate

const MEME_NAMES: Array<[string, string]> = [
  ['Cookie Monster', 'COOKIE'],
  ['SnipeLord', 'SNIPE'],
  ['ChipChomp', 'CHIP'],
  ['Oreo Degen', 'OREO'],
  ['Fortune Cookie', '4TUNE'],
  ['Crumb', 'CRUMB'],
  ['Dunkable', 'DUNK'],
  ['Jam Filled', 'JAM'],
  ['Midnight Snack', 'MNSK'],
  ['Cracked Cracker', 'CRKR'],
  ['Milk First', 'MLK1'],
  ['Bakers Dozen', 'DZN'],
  ['Gluten Gladiator', 'GLUT'],
  ['Choco Chip Rush', 'CHOC'],
];

function randomAddr(prefix: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = prefix;
  for (let i = 0; i < 38; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function makePool(i: number, launchTs: number, soldTokens: number, participants: number): LaunchRow {
  const [name, symbol] = MEME_NAMES[i % MEME_NAMES.length];
  const tokensSold = soldTokens * 1_000_000;
  // Curve math: price = 176471 / (1.073B - sold). Keep raised consistent with sold.
  const approxPrice = 176471 / (1_073_000_000 - soldTokens);
  const raisedNetUnits = Math.min(Number(GRADUATION_TARGET) * 0.98, soldTokens * approxPrice);
  return {
    pubkey: randomAddr('Dmo'),
    creator: randomAddr('Cr'),
    poolId: String(i + 1),
    name,
    symbol,
    uri: '',
    tokenMint: randomAddr('Tm'),
    paymentMint: COOK_MINT,
    tokenVault: randomAddr('Tv'),
    paymentVault: randomAddr('Pv'),
    launchTs,
    endTs: launchTs + 86_400,
    durationSecs: 86_400,
    expiryMode: i % 4 === 0 ? 'fair' : i % 4 === 1 ? 'jackpot' : 'dead',
    migratable: i % 7 !== 0,
    antiSnipe: i % 3 === 0,
    state: 'Open',
    status: 'live',
    minBuy: '1000000000',
    maxBuyPerWallet: '50000000000000',
    maxPaymentRaise: String(Number(GRADUATION_TARGET) * 2),
    totalTokenSupply: TOTAL_SUPPLY,
    saleTokenSupply: SALE_SUPPLY,
    virtualPaymentReserve: VIRTUAL_PAYMENT_RESERVE,
    virtualTokenReserve: VIRTUAL_TOKEN_RESERVE,
    tokensSold: String(tokensSold),
    totalActiveShares: String(tokensSold),
    paymentRaisedGross: String(Math.round(raisedNetUnits * 1e9 * 1.02)),
    paymentRaisedNet: String(Math.round(raisedNetUnits * 1e9)),
    participantCount: String(participants),
    expiryLiquidity: '0',
    totalExpiryShares: '0',
    settlementRootSet: false,
    graduatedAt: 0,
    creatorVestAmount: '0',
    creatorVestClaimed: '0',
    creatorVestStart: 0,
    creatorVestEnd: 0,
    graduationTarget: GRADUATION_TARGET,
    demo: true,
  };
}

export function seedDemo(): LaunchRow[] {
  const now = nowSec();
  const pools: LaunchRow[] = [];
  for (let i = 0; i < 8; i++) {
    const ageSec = [35, 180, 640, 1400, 3600, 7200, 14400, 26000][i] ?? 1000;
    const sold = Math.floor(8_000_000 * Math.pow(1.6, i)); // ~0.75%..20% of supply
    const participants = Math.floor(12 * Math.pow(1.9, i));
    pools.push(makePool(i, now - ageSec, sold, participants));
  }
  return pools;
}

/**
 * Advance demo state by one tick. Returns a NEW array so React re-renders.
 * Occasionally spawns a brand-new launch (exercises the NEW-flash path).
 */
export function advanceDemo(prev: LaunchRow[]): LaunchRow[] {
  const now = nowSec();
  const saleSupplyTokens = Number(SALE_SUPPLY) / 1e6; // whole tokens on the curve
  const next = prev.map((p) => {
    if (p.status !== 'live') return p;
    // All arithmetic in token BASE units (6 decimals), matching pool fields.
    const buy = Math.random() < 0.8;
    const sell = !buy && Math.random() < 0.3;
    let sold = Number(p.tokensSold);
    if (buy) sold += Math.floor((20_000 + Math.random() * 400_000) * (0.5 + Math.random())) * 1_000_000;
    if (sell) sold = Math.max(0, sold - Math.floor(Math.random() * 60_000) * 1_000_000);
    // Clamp so the curve can never invert, even with bad randomness.
    sold = Math.min(sold, saleSupplyTokens * 0.99 * 1_000_000);
    const soldStr = String(Math.floor(sold));
    const soldUi = sold / 1e6; // whole tokens
    const approxPrice = 176471 / (1_073_000_000 - soldUi);
    const raisedNet = Math.min(Number(GRADUATION_TARGET) * 0.985, soldUi * approxPrice);
    const participants = Number(p.participantCount) + (Math.random() < 0.6 ? Math.floor(Math.random() * 3) : 0);
    const graduated = raisedNet >= Number(GRADUATION_TARGET) * 0.985;
    return {
      ...p,
      tokensSold: soldStr,
      totalActiveShares: soldStr,
      paymentRaisedGross: String(Math.round(raisedNet * 1e9 * 1.02)),
      paymentRaisedNet: String(Math.round(raisedNet * 1e9)),
      participantCount: String(participants),
      status: graduated ? ('graduated' as const) : ('live' as const),
      graduatedAt: graduated ? now : 0,
    };
  });
  // Occasional new launch
  if (Math.random() < 0.25) {
    const i = next.length;
    next.push(makePool(i, now, 300_000 + Math.floor(Math.random() * 900_000), 3 + Math.floor(Math.random() * 9)));
  }
  return next;
}