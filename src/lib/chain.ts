// Cookie Chain connection: the only place that talks to the RPC.
//
// Two rules this file exists to enforce:
//  1. Never let a wallet broadcast. Wallets send through *their* RPC, which on a
//     custom SVM chain points at Solana mainnet — the transaction then never
//     lands on Cookie Chain and the user sees a silent failure. We ask the wallet
//     to sign only, and send from here.
//  2. Always confirm we are on Cookie Chain before asking for a signature.
import { Connection, PublicKey } from '@solana/web3.js';

export const COOKIE_RPC = 'https://rpc.cookiescan.io';
export const COOKIE_WS = 'wss://wss.cookiescan.io';
export const COOKIE_GENESIS = '9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2';
export const COOKIE_EXPLORER = 'https://cookiescan.io';

export const COOK_DECIMALS = 9;
export const TOKEN_DECIMALS = 6;
/** Native COOK is the wrapped-SOL mint string. The identical string is wSOL on
 *  Solana mainnet — always branch on the chain, never on the mint alone. */
export const COOK_MINT = 'So11111111111111111111111111111111111111112';

export const connection = new Connection(COOKIE_RPC, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60_000,
});

export const explorerTx = (signature: string) => `${COOKIE_EXPLORER}/tx/${signature}`;
export const explorerAddress = (address: string) => `${COOKIE_EXPLORER}/address/${address}`;
export const explorerToken = (mint: string) => `${COOKIE_EXPLORER}/token/${mint}`;

export async function lamports(address: string): Promise<number> {
  try {
    return await connection.getBalance(new PublicKey(address));
  } catch {
    return 0;
  }
}

let genesisCheck: Promise<void> | null = null;

/** Throws unless the RPC we are talking to is the Cookie Chain we expect. */
export function assertCookieChain(): Promise<void> {
  if (!genesisCheck) {
    genesisCheck = (async () => {
      const genesis = await connection.getGenesisHash();
      if (genesis !== COOKIE_GENESIS) {
        throw new Error(
          `Wrong network: the RPC reports genesis ${genesis.slice(0, 8)}…, not Cookie Chain. Refusing to sign.`,
        );
      }
    })().catch((e) => {
      genesisCheck = null; // let a later attempt retry
      throw e;
    });
  }
  return genesisCheck;
}
