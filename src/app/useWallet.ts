import { useCallback, useEffect, useState } from 'react';
import { discoverWallets, onWalletsChanged, type CookieWallet } from '../lib/wallet';

export interface WalletState {
  wallets: CookieWallet[];
  wallet: CookieWallet | null;
  address: string | null;
  connecting: boolean;
  error: string | null;
  connect: (wallet: CookieWallet) => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useWallet(): WalletState {
  const [wallets, setWallets] = useState<CookieWallet[]>(() => discoverWallets());
  const [wallet, setWallet] = useState<CookieWallet | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extensions register after load, so keep the list fresh.
  useEffect(() => onWalletsChanged(() => setWallets(discoverWallets())), []);

  const connect = useCallback(async (next: CookieWallet) => {
    setConnecting(true);
    setError(null);
    try {
      const account = await next.connect();
      setWallet(next);
      setAddress(account.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not connect to ${next.name}.`);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await wallet?.disconnect();
    } catch {
      /* ignore */
    }
    setWallet(null);
    setAddress(null);
  }, [wallet]);

  return { wallets, wallet, address, connecting, error, connect, disconnect };
}
