use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::CreatorFeeClaimed;

#[derive(Accounts)]
pub struct ClaimCreatorFee<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"market", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.creator == creator.key() @ DegenBetsError::NotMarketCreator,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"creator", creator.key().as_ref()],
        bump = creator_profile.bump,
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimCreatorFee>) -> Result<()> {
    let market = &ctx.accounts.market;
    let config = &ctx.accounts.config;

    require!(market.status == MarketStatus::Resolved, DegenBetsError::MarketNotResolved);
    require!(!market.creator_fee_claimed, DegenBetsError::CreatorFeeAlreadyClaimed);

    // Security: challenge period must have passed
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= market.resolved_at + config.challenge_period_seconds,
        DegenBetsError::ChallengePeriodActive
    );

    // Creator gets: stored fee + LP value (winning tokens left in AMM pool)
    let total_pot = market.total_minted;
    let total_rake = market.treasury_fee
        .checked_add(market.creator_fee)
        .ok_or(DegenBetsError::MathOverflow)?;
    let prize_pool = total_pot
        .checked_sub(total_rake)
        .ok_or(DegenBetsError::MathOverflow)?;

    let outcome = market.outcome.unwrap();
    let winning_reserve = if outcome { market.yes_reserve } else { market.no_reserve };
    let lp_value = (winning_reserve as u128)
        .checked_mul(prize_pool as u128)
        .ok_or(DegenBetsError::MathOverflow)?
        .checked_div(total_pot as u128)
        .ok_or(DegenBetsError::MathOverflow)? as u64;

    let total_payout = market.creator_fee
        .checked_add(lp_value)
        .ok_or(DegenBetsError::MathOverflow)?;

    // Rent-exemption guard
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(Market::SIZE);
    let market_lamports = ctx.accounts.market.to_account_info().lamports();
    require!(
        market_lamports.checked_sub(total_payout).unwrap_or(0) >= min_balance,
        DegenBetsError::InsufficientRentBalance
    );

    // Transfer from market PDA to creator
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= total_payout;
    **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += total_payout;

    // Update market
    let market = &mut ctx.accounts.market;
    market.creator_fee_claimed = true;

    // Update creator profile
    let profile = &mut ctx.accounts.creator_profile;
    profile.total_fees_earned = profile.total_fees_earned
        .checked_add(total_payout)
        .ok_or(DegenBetsError::MathOverflow)?;

    emit!(CreatorFeeClaimed {
        market: ctx.accounts.market.key(),
        creator: ctx.accounts.creator.key(),
        amount: total_payout,
    });

    Ok(())
}
