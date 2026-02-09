use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::TreasuryFeeClaimed;

#[derive(Accounts)]
pub struct ClaimTreasuryFee<'info> {
    #[account(
        constraint = authority.key() == config.authority,
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"market", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// Treasury wallet to receive the fee
    #[account(
        mut,
        constraint = treasury.key() == config.treasury,
    )]
    pub treasury: SystemAccount<'info>,
}

pub fn handler(ctx: Context<ClaimTreasuryFee>) -> Result<()> {
    let market = &ctx.accounts.market;
    let config = &ctx.accounts.config;

    require!(market.status == MarketStatus::Resolved, DegenBetsError::MarketNotResolved);
    require!(!market.treasury_fee_claimed, DegenBetsError::TreasuryFeeAlreadyClaimed);

    // Security: challenge period must have passed
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= market.resolved_at + config.challenge_period_seconds,
        DegenBetsError::ChallengePeriodActive
    );

    // Use stored fee value (computed once at resolution time)
    let treasury_fee = market.treasury_fee;

    // Rent-exemption guard
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(Market::SIZE);
    let market_lamports = ctx.accounts.market.to_account_info().lamports();
    require!(
        market_lamports.checked_sub(treasury_fee).unwrap_or(0) >= min_balance,
        DegenBetsError::InsufficientRentBalance
    );

    // Transfer from market PDA to treasury
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= treasury_fee;
    **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += treasury_fee;

    // Mark claimed
    let market = &mut ctx.accounts.market;
    market.treasury_fee_claimed = true;

    emit!(TreasuryFeeClaimed {
        market: market.key(),
        amount: treasury_fee,
    });

    Ok(())
}
