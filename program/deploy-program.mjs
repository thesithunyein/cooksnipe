/**
 * Deploy the CookSnipe claim-log program to Cookie Chain.
 *
 * Why this shells out to `solana program deploy` instead of hand-rolling the
 * BPF-loader instructions:
 *
 *   The previous version of this file built the buffer and program accounts
 *   itself and did not work. It imported `MAX_PERMIT_DATA_LENGTH` and
 *   `BPF_LOADER_BUFFER_PROGRAM_ID` from @solana/web3.js, and both were removed
 *   in web3.js 1.99 — they arrive here as `undefined`, so the program account
 *   was given `space: undefined` and its rent was computed from `NaN`. It also
 *   sized the program rent to 10 MB (~73 COOK) rather than to the ELF.
 *
 *   The CLI's deploy path is exercised by every Solana program in existence, it
 *   sizes the accounts to the artifact, and it is already verified against this
 *   chain: run with an unfunded payer it fails at exactly one line, reporting
 *   `insufficient funds for spend (0.22587288 SOL) + fee (0.00018 SOL)` — i.e.
 *   everything except the balance works.
 *
 * Measured on Cookie Chain with the 32,288-byte artifact:
 *   buffer rent       ~0.2259 COOK   (temporary; refunded when the buffer closes)
 *   program data rent ~0.2259 COOK   (permanent — this is the real cost)
 *   transaction fees  ~0.0002 COOK
 * So ~0.46 COOK funds a complete deploy and ~0.226 COOK is actually consumed.
 *
 * Requires: the Solana CLI on PATH, and a payer keypair holding ~0.5 COOK.
 *
 * Usage:
 *   cargo build-sbf
 *   node deploy-program.mjs
 *
 * Env overrides:
 *   RPC_URL        default https://rpc.cookiescan.io
 *   PAYER_KEYPAIR  default ~/.config/solana/id.json
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SO = join(HERE, 'target', 'deploy', 'cooksnipe_claimlog.so');
const PROGRAM_KEYPAIR = join(HERE, 'program-keypair.json');
const RPC = process.env.RPC_URL || 'https://rpc.cookiescan.io';
const PAYER = process.env.PAYER_KEYPAIR || `${process.env.HOME}/.config/solana/id.json`;

/** Minimum the CLI needs to start: buffer rent + fee, per the measured error. */
const REQUIRED_COOK = 0.46;

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function tryRun(cmd, args) {
  try {
    return run(cmd, args);
  } catch (e) {
    return ((e.stdout || '') + (e.stderr || '')).trim();
  }
}

function main() {
  if (!existsSync(SO)) {
    throw new Error(`No artifact at ${SO}\nRun: cd program && cargo build-sbf`);
  }
  if (!existsSync(PAYER)) {
    throw new Error(`No payer keypair at ${PAYER}\nSet PAYER_KEYPAIR=/path/to/id.json`);
  }

  const elfBytes = readFileSync(SO).length;

  // solana-keygen refuses to overwrite, so only create the program keypair once.
  // Losing this file means losing the ability to upgrade the program, and it is
  // the program's secret key — it is gitignored deliberately.
  let programAddress;
  if (existsSync(PROGRAM_KEYPAIR)) {
    programAddress = run('solana-keygen', ['pubkey', PROGRAM_KEYPAIR]);
    console.log('program keypair:  existing');
  } else {
    run('solana-keygen', ['new', '--outfile', PROGRAM_KEYPAIR, '--no-bip39-passphrase', '--silent']);
    programAddress = run('solana-keygen', ['pubkey', PROGRAM_KEYPAIR]);
    console.log('program keypair:  generated (program/program-keypair.json — gitignored)');
  }

  const payer = run('solana-keygen', ['pubkey', PAYER]);
  const balance = Number(run('solana', ['balance', payer, '--url', RPC]).split(/\s+/)[0]);

  console.log('rpc:             ', RPC);
  console.log('payer:           ', payer, `(${balance} COOK)`);
  console.log('program:         ', programAddress);
  console.log('artifact:        ', elfBytes, 'bytes');
  console.log('needs:           ', `~${REQUIRED_COOK} COOK to complete`);

  if (balance < REQUIRED_COOK) {
    throw new Error(
      `Payer holds ${balance} COOK; the deploy needs about ${REQUIRED_COOK}. ` +
        `Send COOK to ${payer} on Cookie Chain and re-run — this script resumes.`,
    );
  }

  // Idempotent: the CLI itself no-ops if this program is already deployed.
  const out = tryRun('solana', [
    'program',
    'deploy',
    SO,
    '--url',
    RPC,
    '--keypair',
    PAYER,
    '--program-id',
    PROGRAM_KEYPAIR,
  ]);
  console.log(out);

  // Trust the chain, not the CLI's exit message. `solana account --output json`
  // nests everything under `account`, and exits non-zero when the account is
  // missing, so both the lookup and the field need guarding.
  const raw = tryRun('solana', ['account', programAddress, '--url', RPC, '--output', 'json']);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Could not read the program account back from the chain:\n${raw}`);
  }
  if (!parsed.account?.executable) {
    throw new Error(`Account ${programAddress} exists but is not executable — deploy failed.`);
  }

  console.log('\nexecutable:       true');
  console.log('owner:           ', parsed.account.owner);
  console.log('PROGRAM ADDRESS:', programAddress);
  console.log('explorer:        ', `https://cookiescan.io/address/${programAddress}`);
}

try {
  main();
} catch (e) {
  console.error('DEPLOY FAILED:', e.message);
  process.exit(1);
}
