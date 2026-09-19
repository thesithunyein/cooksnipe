// Wallet discovery, sign-only.
//
// Nightly is the wallet Cookie Chain actually supports, and it registers through
// the Wallet Standard, so we discover wallets from the standard registry and fall
// back to an injected provider. We never call signAndSendTransaction: a wallet
// broadcasts via its own RPC, which on this chain points at Solana mainnet, so
// the transaction would silently never land. See lib/tx.ts for the send path.
import { Transaction } from '@solana/web3.js';
import { getWallets } from '@wallet-standard/app';

export interface CookieWalletAccount {
  address: string;
  chain: string;
}

export interface CookieWallet {
  name: string;
  icon?: string;
  installed: true;
  /** 'standard' = Wallet Standard registration, 'injected' = legacy provider. */
  kind: 'standard' | 'injected';
  connect(): Promise<CookieWalletAccount>;
  disconnect(): Promise<void>;
  /** Returns signed transaction bytes. Never broadcasts. */
  signTransaction(bytes: Uint8Array): Promise<Uint8Array>;
}

type Features = Record<string, any>;

function fromStandard(wallet: { name: string; icon?: string; features: Features }): CookieWallet | null {
  const connectFeature = wallet.features['standard:connect'];
  const signFeature = wallet.features['solana:signTransaction'];
  if (!connectFeature || !signFeature) return null;

  let account: any = null;
  let chain = '';

  return {
    name: wallet.name,
    icon: wallet.icon,
    installed: true,
    kind: 'standard',
    async connect() {
      const res = await connectFeature.connect();
      account = res?.accounts?.[0];
      if (!account?.address) throw new Error(`${wallet.name} did not return an account.`);
      chain = account.chains?.find((c: string) => c.startsWith('solana:')) ?? 'solana:mainnet';
      return { address: account.address, chain };
    },
    async disconnect() {
      try {
        await wallet.features['standard:disconnect']?.disconnect();
      } catch {
        /* some wallets have nothing to clean up */
      }
    },
    async signTransaction(bytes: Uint8Array) {
      if (!account) throw new Error('Connect the wallet first.');
      const [signed] = await signFeature.signTransaction({ transaction: bytes, account, chain });
      if (!signed?.signedTransaction) throw new Error(`${wallet.name} returned no signed transaction.`);
      return signed.signedTransaction as Uint8Array;
    },
  };
}

function fromInjected(name: string, provider: any): CookieWallet | null {
  if (!provider || typeof provider.signTransaction !== 'function') return null;
  return {
    name,
    installed: true,
    kind: 'injected',
    async connect() {
      const res = await provider.connect();
      const address = res?.publicKey?.toBase58?.() ?? provider.publicKey?.toBase58?.();
      if (!address) throw new Error(`${name} did not return an address.`);
      return { address, chain: `solana:mainnet` };
    },
    async disconnect() {
      await provider.disconnect?.();
    },
    async signTransaction(bytes: Uint8Array) {
      const tx = Transaction.from(bytes);
      const signed = await provider.signTransaction(tx);
      return signed.serialize({ requireAllSignatures: false, verifySignatures: false });
    },
  };
}

/** Every wallet we can currently see, standard registrations first. */
export function discoverWallets(): CookieWallet[] {
  const found: CookieWallet[] = [];
  const seen = new Set<string>();

  try {
    for (const wallet of getWallets().get()) {
      const adapter = fromStandard(wallet as any);
      if (adapter && !seen.has(adapter.name)) {
        found.push(adapter);
        seen.add(adapter.name);
      }
    }
  } catch {
    /* registry unavailable (very old browser) — the injected path still works */
  }

  const win = window as any;
  const injected: Array<[string, any]> = [
    ['Nightly', win.nightly?.solana ?? win.nightly],
    ['Phantom', win.phantom?.solana],
    ['Backpack', win.backpack?.solana],
    ['Solflare', win.solflare],
  ];
  for (const [name, provider] of injected) {
    if (name && provider && !seen.has(name)) {
      const adapter = fromInjected(name, provider);
      if (adapter) {
        found.push(adapter);
        seen.add(name);
      }
    }
  }

  return found;
}

/** Re-scan when a wallet extension registers itself after page load. */
export function onWalletsChanged(cb: () => void): () => void {
  try {
    const registry = getWallets();
    const offRegister = registry.on('register', cb);
    const offUnregister = registry.on('unregister', cb);
    return () => {
      offRegister();
      offUnregister();
    };
  } catch {
    return () => {};
  }
}

export const NIGHTLY_INSTALL_URL = 'https://nightly.app';
