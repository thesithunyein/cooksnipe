//! CookSnipe claim-log — an append-only receipt registry on Cookie Chain.
//!
//! One instruction: `RecordClaim` (u8 = 0). It takes a PDA account owned by
//! this program, seeded by `["cooksnipe", wallet, pool]`, and appends a
//! receipt: claimer, pool, claim kind, and the raw amount. The account grows
//! by fixed-size records so a claim history is publicly auditable without
//! trusting CookSnipe's database — the explorer shows what was claimed, when,
//! and how much, forever.
//!
//! Deliberately minimal: no CPI, no lamports move, no upgrade authority
//! exercised. It exists to be the submission's own deployed program and to
//! make the Claim Center's results verifiable on-chain.

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::Sysvar,
    clock::Clock,
};

/// Discriminant of the only instruction this program accepts.
pub const RECORD_CLAIM: u8 = 0;

/// One receipt, fixed size: 32 (claimer) + 32 (pool) + 1 (kind) + 8 (amount)
/// + 8 (slot) = 81 bytes, prefixed by a 4-byte little-endian record count.
pub const RECORD_SIZE: usize = 81;
pub const HEADER_SIZE: usize = 4;

/// Maximum receipts per account — bounds the account size a claimer can grow.
pub const MAX_RECORDS: u32 = 512;

entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let ix = data.first().copied().ok_or(ProgramError::InvalidInstructionData)?;
    if ix != RECORD_CLAIM {
        msg!("Unknown instruction {}", ix);
        return Err(ProgramError::InvalidInstructionData);
    }
    let body = &data[1..];
    if body.len() != RECORD_SIZE {
        msg!("Instruction data must be {} bytes, got {}", RECORD_SIZE, body.len());
        return Err(ProgramError::InvalidInstructionData);
    }

    let iter = &mut accounts.iter();
    let receipt = next_account_info(iter)?;
    let clock = Clock::get()?;

    // The receipt account must belong to this program: nobody else can forge
    // or rewrite a history written by it.
    if receipt.owner != program_id {
        msg!("Receipt account not owned by the claim-log program");
        return Err(ProgramError::IncorrectProgramId);
    }
    if !receipt.is_signer {
        msg!("Receipt account must be a signer (PDA invoked via invoke_signed)");
        return Err(ProgramError::MissingRequiredSignature);
    }

    let count = u32::from_le_bytes(
        receipt.try_borrow_data()?[..HEADER_SIZE]
            .try_into()
            .unwrap(),
    );
    if count >= MAX_RECORDS {
        msg!("Receipt log full ({} records)", count);
        return Err(ProgramError::AccountDataTooSmall);
    }

    let expected_len = HEADER_SIZE + (count as usize + 1) * RECORD_SIZE;
    if receipt.data_len() < expected_len {
        msg!("Receipt account too small: {} < {}", receipt.data_len(), expected_len);
        return Err(ProgramError::AccountDataTooSmall);
    }

    // Append: count, then the record at its fixed offset.
    let mut out = receipt.try_borrow_mut_data()?;
    out[..HEADER_SIZE].copy_from_slice(&(count + 1).to_le_bytes());
    let start = HEADER_SIZE + count as usize * RECORD_SIZE;
    out[start..start + RECORD_SIZE].copy_from_slice(body);

    msg!(
        "cooksnipe claim #{} recorded at slot {}",
        count + 1,
        clock.slot
    );
    Ok(())
}

/// The PDA a client derives for a (wallet, pool) pair — the account that will
/// hold that pair's receipt log.
pub fn receipt_pda(wallet: &Pubkey, pool: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"cooksnipe", wallet.as_ref(), pool.as_ref()], program_id)
}

/// Layout helper mirroring the client-side encoder.
pub fn encode_record(claimer: &Pubkey, pool: &Pubkey, kind: u8, amount: u64, slot: u64) -> Vec<u8> {
    let mut out = Vec::with_capacity(RECORD_SIZE);
    out.extend_from_slice(&claimer.to_bytes());
    out.extend_from_slice(&pool.to_bytes());
    out.push(kind);
    out.extend_from_slice(&amount.to_le_bytes());
    out.extend_from_slice(&slot.to_le_bytes());
    out
}
