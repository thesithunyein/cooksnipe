import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
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
          className="btn btn-ghost btn-sm num"
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--live)' }} />
          {short(wallet.address)}
          {copied ? <Check size={12} strokeWidth={1.75} style={{ color: 'var(--live)' }} /> : <Copy size={12} strokeWidth={1.75} className="opacity-45" />}
        </button>
        <a
          href={explorerAddress(wallet.address)}
          target="_blank"
          rel="noreferrer"
          title="View on Cookiescan"
          className="opacity-45 hover:opacity-100 transition-opacity"
        >
          <ExternalLink size={14} strokeWidth={1.75} />
        </a>
        <button
          onClick={() => void wallet.disconnect()}
          className="text-[11px] text-[color:var(--ink-faint)] hover:text-[color:var(--ink)] transition-colors cursor-pointer"
        >
          disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} disabled={wallet.connecting} className="btn btn-ink btn-sm">
        {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 card p-2 z-50 shadow-[0_18px_50px_rgba(13,12,11,0.14)] bg-white">
          {wallet.wallets.length === 0 ? (
            <div className="p-3 text-[12px] leading-relaxed text-[color:var(--ink-soft)]">
              No Solana wallet detected.
              <a
                href={NIGHTLY_INSTALL_URL}
                target="_blank"
                rel="noreferrer"
                className="link mt-2 flex items-center gap-1.5"
              >
                Install Nightly — Cookie Chain's supported wallet <ExternalLink size={11} strokeWidth={1.75} />
              </a>
              <p className="mt-2 text-[11px] text-[color:var(--ink-faint)]">
                Then set its RPC to <span className="text-[color:var(--ink-soft)]">rpc.cookiescan.io</span> in the
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
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-[rgba(13,12,11,0.04)] cursor-pointer"
              >
                {w.icon ? <img src={w.icon} alt="" className="w-5 h-5 rounded" /> : <span className="w-5" />}
                <span className="flex-1">{w.name}</span>
                {w.name.toLowerCase().includes('nightly') && <span className="chip chip-live">supported</span>}
              </button>
            ))
          )}
        </div>
      )}

      {wallet.error && (
        <div className="absolute right-0 mt-2 w-72 alert-danger px-3 py-2 text-[11px]">{wallet.error}</div>
      )}
    </div>
  );
}
