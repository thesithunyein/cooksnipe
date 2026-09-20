import { createHash } from 'node:crypto';
import { Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { humanizeError, TxRefused, verifyAgainstExpectation } from './tx';
import type { TxExpectation } from './types';

const PROGRAM = new PublicKey('11111111111111111111111111111111');
const sha = (bytes: Uint8Array) => createHash('sha256').update(Buffer.from(bytes)).digest('hex');

/** A one-instruction transaction plus the description the API would return for it. */
function fixture(data = Buffer.from([7, 1, 2, 3])) {
  const payer = Keypair.generate().publicKey;
  const ix = new TransactionInstruction({
    programId: PROGRAM,
    keys: [{ pubkey: payer, isSigner: true, isWritable: true }],
    data,
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = payer;
  const expectation: TxExpectation = {
    feePayer: payer.toBase58(),
    instructions: [
      {
        programId: PROGRAM.toBase58(),
        accounts: [{ pubkey: payer.toBase58(), signer: true, writable: true }],
        dataHash: sha(data),
      },
    ],
  };
  return { payer, tx, expectation, data };
}

describe('verifyAgainstExpectation', () => {
  it('accepts a transaction that matches the description', async () => {
    const { tx, expectation } = fixture();
    await expect(verifyAgainstExpectation(tx, expectation)).resolves.toBe(true);
  });

  it('refuses when there is no description at all', async () => {
    const { tx } = fixture();
    await expect(verifyAgainstExpectation(tx, undefined)).rejects.toBeInstanceOf(TxRefused);
  });

  it('allows an undescribed transaction only when the caller opts in', async () => {
    const { tx } = fixture();
    await expect(verifyAgainstExpectation(tx, undefined, true)).resolves.toBe(false);
  });

  it('refuses when a different program would be called', async () => {
    const { tx, expectation } = fixture();
    const tampered = { ...expectation, instructions: [{ ...expectation.instructions[0], programId: Keypair.generate().publicKey.toBase58() }] };
    await expect(verifyAgainstExpectation(tx, tampered)).rejects.toBeInstanceOf(TxRefused);
  });

  it('refuses when the instruction data was changed after the description was issued', async () => {
    const { tx, expectation } = fixture();
    // Same accounts, same program, one byte of data different.
    const tampered = {
      ...expectation,
      instructions: [{ ...expectation.instructions[0], dataHash: sha(Buffer.from([7, 1, 2, 4])) }],
    };
    await expect(verifyAgainstExpectation(tx, tampered)).rejects.toBeInstanceOf(TxRefused);
  });

  it('refuses when the transaction would be paid for by someone else', async () => {
    const { tx, expectation } = fixture();
    await expect(
      verifyAgainstExpectation(tx, { ...expectation, feePayer: Keypair.generate().publicKey.toBase58() }),
    ).rejects.toBeInstanceOf(TxRefused);
  });

  it('refuses when an account would gain signer or writable rights', async () => {
    const { tx, expectation, payer } = fixture();
    const tampered: TxExpectation = {
      ...expectation,
      instructions: [
        {
          ...expectation.instructions[0],
          accounts: [{ pubkey: payer.toBase58(), signer: false, writable: false }],
        },
      ],
    };
    await expect(verifyAgainstExpectation(tx, tampered)).rejects.toBeInstanceOf(TxRefused);
  });
});

describe('humanizeError', () => {
  it('explains an empty wallet in plain words', () => {
    expect(humanizeError(new Error('custom program error: 0x1'))).toMatch(/not enough cook/i);
  });

  it('explains a wallet that has never been funded', () => {
    // What the RPC actually returns when the fee payer account does not exist yet:
    // an unfunded wallet fails simulation before it can ever be signed.
    expect(humanizeError('AccountNotFound')).toMatch(/no cook yet/i);
    expect(humanizeError(new Error('Transaction simulation failed: AccountNotFound'))).toMatch(
      /no cook yet/i,
    );
  });

  it('explains a declined signature', () => {
    expect(humanizeError(new Error('User rejected the request'))).toMatch(/declined/i);
  });

  it('explains an expired blockhash', () => {
    expect(humanizeError(new Error('Blockhash not found'))).toMatch(/expired/i);
  });

  it('reads program logs, not just the error message', () => {
    expect(humanizeError(new Error('Transaction simulation failed'), ['Program log: sold out'])).toMatch(
      /not enough tokens left/i,
    );
  });

  it('passes an unrecognised error through instead of inventing a cause', () => {
    expect(humanizeError(new Error('some unmapped failure'))).toBe('some unmapped failure');
  });
});
