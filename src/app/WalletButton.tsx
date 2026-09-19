import { useState } from 'react';
import { Check, Copy, ExternalLink, Wallet } from 'lucide-react';
import { explorerAddress } from '../lib/chain';
import { NIGHTLY_INSTALL_URL } from '../lib/wallet';
import type { WalletState } from './useWallet';

export const short = (address: string, size = 4) =>
  `${address.slice(0, size)}…${address.slice(-size)}`;

export function WalletButton({ wallet }: { wallet: WalletState }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (wallet.address) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(wallet.address as string);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          title={wallet.address}
          className="flex items-center gap-2 shrink-0 whitespace-nowrap rounded-full bg-white/5 border border-white/10 px-3.5 py-2 text-[12px] text-white/80 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#3ddc84]" />
          {short(wallet.address)}
          {copied ? <Check size={12} className="text-[#3ddc84]" /> : <Copy size={12} className="text-white/40" />}
        </button>
        <a
          href={explorerAddress(wallet.address)}
          target="_blank"
          rel="noreferrer"
          title="View on Cookiescan"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={() => void wallet.disconnect()}
          className="text-[11px] text-white/40 hover:text-white transition-colors cursor-pointer"
        >
          disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={wallet.connecting}
        className="flex items-center gap-2 shrink-0 whitespace-nowrap rounded-full bg-[#3ddc84] text-black px-4 py-2 text-[12px] font-semibold hover:bg-[#54e79b] transition-colors cursor-pointer disabled:opacity-60"
      >
        <Wallet size={14} />
        {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-black/95 backdrop-blur p-2 z-50">
          {wallet.wallets.length === 0 ? (
            <div className="p-3 text-[12px] text-white/60 leading-relaxed">
              No Solana wallet detected.
              <a
                href={NIGHTLY_INSTALL_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-1.5 text-[#3ddc84] hover:underline"
              >
                Install Nightly — Cookie Chain's supported wallet <ExternalLink size={11} />
              </a>
              <p className="mt-2 text-[11px] text-white/40">
                Then add the Cookie Chain RPC (<span className="text-white/60">rpc.cookiescan.io</span>) in its
                network settings and reload this page.
              </p>
            </div>
          ) : (
            wallet.wallets.map((w) => (
              <button
                key={w.name}
                onClick={() => {
                  void wallet.connect(w);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-white/80 hover:bg-white/10 cursor-pointer"
              >
                {w.icon ? (
                  <img src={w.icon} alt="" className="w-5 h-5 rounded" />
                ) : (
                  <Wallet size={16} />
                )}
                <span className="flex-1">{w.name}</span>
                {w.name.toLowerCase().includes('nightly') && (
                  <span className="text-[9px] uppercase tracking-wider text-[#3ddc84]">supported</span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {wallet.error && <div className="absolute right-0 mt-2 w-64 text-[11px] text-red-300">{wallet.error}</div>}
    </div>
  );
}
