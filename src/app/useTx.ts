import { useCallback, useRef, useState } from 'react';
import { humanizeError, runBuiltTx, TxRefused, type SendResult, type Stage, type StageEvent, type StageStatus } from '../lib/tx';
import type { BuiltTx } from '../lib/types';
import type { WalletState } from './useWallet';

/** The steps a user actually sees. `prepare` is local, the rest are the pipeline. */
export const VISIBLE_STAGES: Array<{ stage: Stage; label: string }> = [
  { stage: 'prepare', label: 'Asking the launchpad to build it' },
  { stage: 'verify', label: 'Checking it does only what it says' },
  { stage: 'simulate', label: 'Simulating on Cookie Chain' },
  { stage: 'sign', label: 'Waiting for your signature' },
  { stage: 'send', label: 'Broadcasting' },
  { stage: 'confirm', label: 'Confirming' },
];

export interface TxProgressState {
  status: Partial<Record<Stage, StageStatus>>;
  detail: Partial<Record<Stage, string>>;
}

export interface TxController {
  progress: TxProgressState;
  busy: boolean;
  error: string | null;
  result: SendResult | null;
  run: (build: () => Promise<BuiltTx>, opts?: { allowUndescribed?: boolean }) => Promise<SendResult | null>;
  reset: () => void;
}

/**
 * Drives one transaction at a time through build → verify → simulate → sign →
 * send → confirm, recording each step so the UI can show where it is rather than
 * a spinner. The wallet only ever signs; broadcasting happens in lib/tx.ts.
 */
export function useTx(wallet: WalletState): TxController {
  const [progress, setProgress] = useState<TxProgressState>({ status: {}, detail: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const runId = useRef(0);

  const reset = useCallback(() => {
    runId.current += 1;
    setProgress({ status: {}, detail: {} });
    setError(null);
    setResult(null);
    setBusy(false);
  }, []);

  const run = useCallback(
    async (build: () => Promise<BuiltTx>, opts?: { allowUndescribed?: boolean }): Promise<SendResult | null> => {
      const id = ++runId.current;
      const alive = () => runId.current === id;

      setBusy(true);
      setError(null);
      setResult(null);
      setProgress({ status: { prepare: 'start' }, detail: { prepare: 'Requesting an unsigned transaction' } });

      const onStage = ({ stage, status, detail }: StageEvent) => {
        if (!alive()) return;
        setProgress((p) => ({
          status: { ...p.status, [stage]: status },
          detail: { ...p.detail, ...(detail ? { [stage]: detail } : {}) },
        }));
      };

      try {
        if (!wallet.wallet || !wallet.address) {
          throw new TxRefused('Connect a wallet before trading.');
        }
        const built = await build();
        if (!alive()) return null;
        onStage({ stage: 'prepare', status: 'ok', detail: 'Transaction received' });

        const sent = await runBuiltTx({
          built,
          signTransaction: (bytes) => (wallet.wallet as NonNullable<WalletState['wallet']>).signTransaction(bytes),
          onStage,
          allowUndescribed: opts?.allowUndescribed,
        });
        if (alive()) setResult(sent);
        return sent;
      } catch (e) {
        if (alive()) setError(humanizeError(e));
        return null;
      } finally {
        if (alive()) setBusy(false);
      }
    },
    [wallet],
  );

  return { progress, busy, error, result, run, reset };
}
