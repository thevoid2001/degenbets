use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::WinningsClaimed;

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

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

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.market == market.key(),
        constraint = position.user == user.key(),
    )]
    pub position: Account<'info, Position>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.position;
    let config = &ctx.accounts.config;

    require!(market.status == MarketStatus::Resolved, DegenBetsError::MarketNotResolved);
    require!(!position.claimed, DegenBetsError::AlreadyClaimed);

    // Security: challenge period must have passed
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= market.resolved_at + config.challenge_period_seconds,
        DegenBetsError::ChallengePeriodActive
    );

    let outcome = market.outcome.unwrap();
    let user_bet = if outcome {
        position.yes_amount
    } else {
        position.no_amount
    };
    require!(user_bet > 0, DegenBetsError::NotAWinner);

    let total_pot = market.yes_pool
        .checked_add(market.no_pool)
        .ok_or(DegenBetsError::MathOverflow)?;

    // Use stored fee values (computed once at resolution time) for consistency
    let total_rake = market.treasury_fee
        .checked_add(market.creator_fee)
        .ok_or(DegenBetsError::MathOverflow)?;

    let prize_pool = total_pot
        .checked_sub(total_rake)
        .ok_or(DegenBetsError::MathOverflow)?;

    let winning_pool = if outcome { market.yes_pool } else { market.no_pool };

    // user_share = (user_bet / winning_pool) * prize_pool
    let user_share = (user_bet as u128)
        .checked_mul(prize_pool as u128)
        .ok_or(DegenBetsError::MathOverflow)?
        .checked_div(winning_pool as u128)
        .ok_or(DegenBetsError::MathOverflow)? as u64;

    // Rent-exemption guard: ensure market PDA retains enough for rent
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(Market::SIZE);
    let market_lamports = ctx.accounts.market.to_account_info().lamports();
    require!(
        market_lamports.checked_sub(user_share).unwrap_or(0) >= min_balance,
        DegenBetsError::InsufficientRentBalance
    );

    // Transfer from market PDA to user
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= user_share;
    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += user_share;

    // Mark claimed
    let position = &mut ctx.accounts.position;
    position.claimed = true;

    emit!(WinningsClaimed {
        market: market.key(),
        user: ctx.accounts.user.key(),
        amount: user_share,
    });

    Ok(())
}
