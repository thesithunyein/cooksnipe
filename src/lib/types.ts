// Data layer types for the MomoSwap launchpad on Cookie Chain (SVM).
// Field names mirror the public API at api.momoswap.fun/v1/launchpad.

export type PoolStatus = 'upcoming' | 'live' | 'graduated' | 'expired';
export type ExpiryMode = 'fair' | 'jackpot' | 'survivor' | 'dead';

export interface LaunchpadConfig {
  paymentMint: string;
  treasuryPayment: string;
  buybackPayment: string;
  tradeFeeBps: number;
  paused: boolean;
  [key: string]: unknown;
}

export interface LaunchRow {
  pubkey: string;
  creator: string;
  poolId: string;
  name: string;
  symbol: string;
  uri: string;
  tokenMint: string;
  paymentMint: string;
  tokenVault: string;
  paymentVault: string;
  launchTs: number; // seconds
  endTs: number; // seconds
  durationSecs: number;
  expiryMode: ExpiryMode;
  migratable: boolean;
  antiSnipe: boolean;
  state: string;
  status: PoolStatus;
  minBuy: string; // base units (9 dec COOK)
  maxBuyPerWallet: string;
  maxPaymentRaise: string;
  totalTokenSupply: string; // base units (6 dec token)
  saleTokenSupply: string;
  virtualPaymentReserve: string;
  virtualTokenReserve: string;
  tokensSold: string;
  totalActiveShares: string;
  paymentRaisedGross: string;
  paymentRaisedNet: string;
  participantCount: string;
  expiryLiquidity: string;
  totalExpiryShares: string;
  settlementRootSet: boolean;
  graduatedAt: number;
  creatorVestAmount: string;
  creatorVestClaimed: string;
  creatorVestStart: number;
  creatorVestEnd: number;
  graduationTarget: string;
  tradeFeeBps?: number;
  /** true when the row comes from the local demo generator */
  demo?: boolean;
}

export interface LaunchpadPosition {
  pool: string;
  owner: string;
  shares: string; // base units (6 dec)
  totalPaymentIn: string; // base units (9 dec COOK)
  totalPaymentOut: string;
  claimed: boolean;
  winnerClaimed: boolean;
  graduatedTokensClaimed: boolean;
}