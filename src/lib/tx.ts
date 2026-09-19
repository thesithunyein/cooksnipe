// The transaction pipeline: build → verify → simulate → sign → send → confirm.
//
// Why it is shaped like this:
//  - The launchpad API hands back a partially signed legacy transaction plus an
//    `expectation` (fee payer, per-instruction program id, account order with
//    signer/writable flags, and a SHA-256 of each instruction's data). We decode
//    what we were given and compare it to that map, so a build that disagrees
//    with the request is refused before any wallet ever sees it.
//  - The wallet is asked to SIGN ONLY. If a wallet broadcasts through its own
//    RPC it lands the transaction on Solana mainnet, where it never confirms.
//  - Confirmation is tracked against the API's blockhash + lastValidBlockHeight
//    rather than a blind sleep, so an expired blockhash is reported as such.
import { Transaction } from '@solana/web3.js';
import type { BuiltTx, TxExpectation } from './types';
import { assertCookieChain, connection, explorerTx } from './chain';

export type Stage = 'prepare' | 'verify' | 'simulate' | 'sign' | 'send' | 'confirm' | 'done';
export type StageStatus = 'start' | 'ok' | 'fail';

export interface StageEvent {
  stage: Stage;
  status: StageStatus;
  detail?: string;
  signature?: string;
}

export type OnStage = (event: StageEvent) => void;

export class TxRefused extends Error {}
export class TxFailed extends Error {
  constructor(
    message: string,
    readonly logs: string[] = [],
  ) {
    super(message);
  }
}

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Compare the bytes we are about to sign against the API's own description of
them. Any disagreement is a refusal, not a warning: the whole point is that the
 * party that built the transaction does not get to be the party that checks it.
 *
 * `allowMissing` is for builders that genuinely cannot describe themselves (the
 * Cookiebox swap endpoint returns no account map). Those still get simulated and
 * still get sent by us, but the UI is told there is nothing to compare against.
 */
export async function verifyAgainstExpectation(
  tx: Transaction,
  expectation: TxExpectation | undefined,
  allowMissing = false,
): Promise<boolean> {
  if (!expectation) {
    if (allowMissing) return false;
    throw new TxRefused(
      'The launchpad did not return a transaction description, so there is nothing to verify. Refusing to sign.',
    );
  }
  const feePayer = tx.feePayer?.toBase58();
  if (feePayer !== expectation.feePayer) {
    throw new TxRefused(`This transaction would be paid for by ${feePayer}, not by you. Refusing to sign.`);
  }
  if (tx.instructions.length !== expectation.instructions.length) {
    throw new TxRefused(
      `Expected ${expectation.instructions.length} instructions but the transaction has ${tx.instructions.length}. Refusing to sign.`,
    );
  }
  for (let i = 0; i < tx.instructions.length; i++) {
    const ix = tx.instructions[i];
    const want = expectation.instructions[i];
    const programId = ix.programId.toBase58();
    if (programId !== want.programId) {
      throw new TxRefused(`Instruction ${i} targets ${programId} instead of ${want.programId}. Refusing to sign.`);
    }
    const hash = await sha256Hex(ix.data);
    if (hash !== want.dataHash) {
      throw new TxRefused(`Instruction ${i} does not match the one the launchpad described. Refusing to sign.`);
    }
    if (ix.keys.length !== want.accounts.length) {
      throw new TxRefused(`Instruction ${i} lists ${ix.keys.length} accounts, not ${want.accounts.length}. Refusing to sign.`);
    }
    for (let k = 0; k < ix.keys.length; k++) {
      const key = ix.keys[k];
      const expected = want.accounts[k];
      if (key.pubkey.toBase58() !== expected.pubkey) {
        throw new TxRefused(`Instruction ${i}, account ${k} is not the account the launchpad described. Refusing to sign.`);
      }
      if (Boolean(key.isSigner) !== Boolean(expected.signer) || Boolean(key.isWritable) !== Boolean(expected.writable)) {
        throw new TxRefused(`Instruction ${i}, account ${k} has different permissions than described. Refusing to sign.`);
      }
    }
  }
  return true;
}

/** Turn raw RPC/program noise into something a person can act on. */
export function humanizeError(err: unknown, logs: string[] = []): string {
  const raw = err instanceof Error ? err.message : String(err);
  const all = `${raw}\n${logs.join('\n')}`;
  if (/insufficient (lamports|funds)|0x1\b/.test(all)) {
    return 'Not enough COOK in this wallet to cover the amount plus network fees.';
  }
  if (/blockhash not found|BlockhashNotFound/i.test(all)) {
    return 'The transaction expired before it was sent. Try again — the next build gets a fresh blockhash.';
  }
  if (/User rejected|rejected the request|declined/i.test(all)) {
    return 'You declined the signature request in your wallet.';
  }
  if (/custom program error: 0x0|Error Code: PoolNotLive|not live/i.test(all)) {
    return 'The pool is not open for trading right now.';
  }
  if (/exceed|cap|Cap/.test(all) && /buy|payment/i.test(all)) {
    return 'That amount is over a limit this pool set (minimum buy, per-wallet cap, or total raise).';
  }
  if (/sold out|SaleSupply|enough tokens/i.test(all)) {
    return 'There are not enough tokens left on the curve for that amount.';
  }
  if (/failed to simulate|Transaction simulation failed/i.test(all)) {
    const code = all.match(/custom program error: (0x[0-9a-f]+|\d+)/i);
    return `The chain rejected the transaction before it was sent${code ? ` (${code[1]})` : ''}.`;
  }
  if (/Wrong network/i.test(raw)) return raw;
  return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
}

export interface SendResult {
  signature: string;
  explorerUrl: string;
}

/**
 * Sign one already-built transaction, send it through the Cookie Chain RPC, and
 * confirm it. `signTransaction` must not broadcast.
 */
export async function signSendConfirm(args: {
  built: BuiltTx;
  signTransaction: (txBytes: Uint8Array) => Promise<Uint8Array>;
  onStage: OnStage;
  /** Skip the description check when the builder cannot return one. */
  allowUndescribed?: boolean;
}): Promise<SendResult> {
  const { built, signTransaction, onStage, allowUndescribed } = args;

  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(built.transactionBase64, 'base64'));
  } catch {
    throw new TxRefused('The launchpad returned a transaction that could not be decoded. Refusing to sign.');
  }

  onStage({ stage: 'verify', status: 'start', detail: 'Checking the transaction matches what was requested' });
  const verified = await verifyAgainstExpectation(tx, built.expectation, allowUndescribed);
  onStage({
    stage: 'verify',
    status: 'ok',
    detail: verified
      ? 'Every instruction matches the description'
      : 'This router returns no description — simulation is the only check available',
  });

  onStage({ stage: 'simulate', status: 'start', detail: 'Simulating on Cookie Chain' });
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    const logs = sim.value.logs ?? [];
    onStage({ stage: 'simulate', status: 'fail', detail: humanizeError(sim.value.err, logs) });
    throw new TxFailed(humanizeError(sim.value.err, logs), logs);
  }
  onStage({
    stage: 'simulate',
    status: 'ok',
    detail: sim.value.unitsConsumed ? `${sim.value.unitsConsumed.toLocaleString()} compute units` : undefined,
  });

  onStage({ stage: 'sign', status: 'start', detail: 'Waiting for your wallet' });
  const signed = await signTransaction(
    tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
  );
  onStage({ stage: 'sign', status: 'ok' });

  onStage({ stage: 'send', status: 'start', detail: 'Broadcasting to Cookie Chain' });
  const signature = await connection.sendRawTransaction(signed, {
    skipPreflight: true,
    maxRetries: 3,
  });
  onStage({ stage: 'send', status: 'ok', signature });

  onStage({ stage: 'confirm', status: 'start', detail: 'Waiting for confirmation' });
  const confirmation = await Promise.race([
    connection.confirmTransaction(
      { signature, blockhash: built.blockhash, lastValidBlockHeight: built.lastValidBlockHeight },
      'confirmed',
    ),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out waiting for confirmation.')), 90_000),
    ),
  ]);
  if (confirmation.value.err) {
    const message = humanizeError(confirmation.value.err);
    onStage({ stage: 'confirm', status: 'fail', detail: message });
    throw new TxFailed(message);
  }

  const explorerUrl = explorerTx(signature);
  onStage({ stage: 'done', status: 'ok', signature, detail: 'Confirmed' });
  return { signature, explorerUrl };
}

/** Convenience: guard the network, then run a built transaction through the pipeline. */
export async function runBuiltTx(args: {
  built: BuiltTx;
  signTransaction: (txBytes: Uint8Array) => Promise<Uint8Array>;
  onStage: OnStage;
  allowUndescribed?: boolean;
}): Promise<SendResult> {
  await assertCookieChain();
  return signSendConfirm(args);
}
