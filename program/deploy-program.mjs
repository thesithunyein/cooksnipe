/**
 * TEMPORARY deploy script for the CookSnipe claim-log program.
 *
 * Deploy path, deliberately CLI-free:
 *   1. a fresh program keypair is generated (or loaded from program-keypair.json)
 *   2. the payer is the existing WSL solana keypair (already funded)
 *   3. the .so is written to a BPF loader buffer account, then the program
 *      account is created from it with the loader's max data length
 *   4. verified with getAccountInfo + getProgramAccounts on rpc.cookiescan.io
 *
 * Usage: node deploy-program.mjs
 * Exits non-zero on any failure. Prints the program address on success.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  BPF_LOADER_PROGRAM_ID,
  BPF_LOADER_BUFFER_PROGRAM_ID,
  MAX_PERMIT_DATA_LENGTH,
} from '@solana/web3.js';

const RPC = 'https://rpc.cookiescan.io';
const connection = new Connection(RPC, 'confirmed');

// ---- load the payer (the WSL cli keypair, already funded) ----
function loadPayer() {
  const paths = [
    process.env.PAYER_KEYPAIR,
    '/home/sithu/.config/solana/id.json',
  ].filter(Boolean);
  for (const p of paths) {
    if (p && existsSync(p)) {
      const secret = new Uint8Array(JSON.parse(readFileSync(p, 'utf8')));
      return { kp: Keypair.fromSecretKey(secret), path: p };
    }
  }
  throw new Error(
    'No payer keypair found. Set PAYER_KEYPAIR=/path/to/id.json (must hold COOK for fees).'
  );
}

// ---- load or create the program keypair ----
function loadProgramKeypair() {
  const path = new URL('./program-keypair.json', import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, '$1'); // windows drive fix when run from /mnt/c
  if (existsSync(path)) {
    const secret = new Uint8Array(JSON.parse(readFileSync(path, 'utf8')));
    return { kp: Keypair.fromSecretKey(secret), path, fresh: false };
  }
  const kp = Keypair.generate();
  return { kp, path, fresh: true };
}

async function main() {
  const { kp: payer, path: payerPath } = loadPayer();
  const { kp: program, path: programPath, fresh } = loadProgramKeypair();
  const elf = readFileSync(new URL('./target/deploy/cooksnipe_claimlog.so', import.meta.url));

  console.log('payer:            ', payer.publicKey.toBase58(), `(${payerPath})`);
  console.log('program:          ', program.publicKey.toBase58(), fresh ? '(fresh keypair)' : '(existing)');
  console.log('program bytes:    ', elf.length, `(sha256 ${Buffer.from(await crypto.subtle.digest('SHA-256', elf)).toString('hex').slice(0, 16)}…)`);
  console.log('loader:           ', BPF_LOADER_PROGRAM_ID.toBase58());

  const bal = await connection.getBalance(payer.publicKey);
  console.log('payer balance:    ', bal / 1e9, 'COOK');
  if (bal < 1e9) throw new Error('Payer holds under 1 COOK — fund it first.');

  if (fresh) writeFileSync(programPath, JSON.stringify(Array.from(program.secretKey)));

  const existing = await connection.getAccountInfo(program.publicKey);
  if (existing && existing.executable) {
    console.log('Program already deployed and executable at', program.publicKey.toBase58());
    return;
  }

  // 1. create the buffer with the loader's maximum permitted size
  const bufferKeypair = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(
    elf.length + 8 // loader writes its own 8-byte meta prefix
  );
  const createBuffer = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: bufferKeypair.publicKey,
    lamports: rent,
    space: elf.length + 8,
    programId: BPF_LOADER_BUFFER_PROGRAM_ID,
  });
  const writeBuffer = new TransactionInstruction({
    keys: [
      { pubkey: bufferKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: false, isWritable: false },
    ],
    programId: BPF_LOADER_BUFFER_PROGRAM_ID,
    data: Buffer.concat([Buffer.from([0]), Buffer.from([0, 0, 0, 0]), elf]), // Write { offset: u32, bytes }
  });
  console.log('writing buffer…   ', bufferKeypair.publicKey.toBase58());
  await sendAndConfirmTransaction(connection, new Transaction().add(createBuffer, writeBuffer), [
    payer,
    bufferKeypair,
  ]);

  // 2. deploy the program from the buffer
  const lamports = await connection.getMinimumBalanceForRentExemption(
    MAX_PERMIT_DATA_LENGTH + 32
  );
  const createProgram = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: program.publicKey,
    lamports,
    space: MAX_PERMIT_DATA_LENGTH,
    programId: BPF_LOADER_PROGRAM_ID,
  });
  const deploy = new TransactionInstruction({
    keys: [
      { pubkey: bufferKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: program.publicKey, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: payer.publicKey, isSigner: false, isWritable: false }, // authority
    ],
    programId: BPF_LOADER_PROGRAM_ID,
    data: Buffer.from([1]), // DeployWithMaxDataLen { max_data_len: u32 = 0 → not serialized by this simple form }
  });
  console.log('deploying…');
  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(createProgram, deploy),
    [payer]
  );
  console.log('deploy tx:        ', `https://cookiescan.io/tx/${sig}`);

  // 3. verify
  const info = await connection.getAccountInfo(program.publicKey);
  if (!info) throw new Error('Program account missing after deploy');
  console.log('executable:       ', info.executable);
  console.log('owner:            ', info.owner.toBase58());
  if (!info.executable) throw new Error('Deployed account is not executable');
  console.log('\nPROGRAM ADDRESS:', program.publicKey.toBase58());
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('DEPLOY FAILED:', e.message);
    process.exit(1);
  });
