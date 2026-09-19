// Data layer types for the MomoSwap launchpad on Cookie Chain (SVM).
// Field names mirror the public API at api.momoswap.fun/v1/launchpad.

/** Pool lifecycle as the API reports it. `ended` = past end_ts but not yet settled:
 *  nothing left to trade, and usually something to claim. */
export type PoolStatus = 'upcoming' | 'live' | 'ended' | 'graduated' | 'expired';
export type ExpiryMode = 'fair' | 'jackpot' | 'survivor' | 'dead';

export interface LaunchpadConfig {
  paymentMint: string;
  treasuryPayment: string;
  buybackPayment: string;
  tradeFeeBps: number;
  paused: boolean;
  momoReady?: number;
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
  winnerClaimedTotal?: string;
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

/** A wallet's bonding-curve position. `shares` are program-tracked, NOT SPL tokens. */
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

/** Off-chain token metadata JSON pinned to IPFS by the launchpad. */
export interface LaunchpadMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
}

/** A built, partial-signed legacy transaction plus the blockhash window. */
export interface BuiltTx {
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
  /** create-pool only: the leased `momo` mint the token will be created at. */
  mint?: string;
  /** A decoded map of the transaction the API says it built. Used to verify the
   *  bytes we are about to hand a wallet — see lib/tx.ts. */
  expectation?: TxExpectation;
}

export interface TxExpectation {
  feePayer: string;
  instructions: Array<{
    programId: string;
    accounts: Array<{ pubkey: string; signer?: boolean; writable?: boolean }>;
    /** SHA-256 of the instruction data, hex. Verified against the built bytes. */
    dataHash: string;
  }>;
}

export type ClaimKind = 'fair' | 'winner' | 'graduated_tokens' | 'creator_vest';

export interface WinnerProof {
  amount: string;
  proof: number[][];
}
