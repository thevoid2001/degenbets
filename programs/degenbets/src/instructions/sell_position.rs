use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::PositionSold;

#[derive(Accounts)]
pub struct SellPosition<'info> {
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

    /// Treasury wallet to receive exit fee
    #[account(
        mut,
        constraint = treasury.key() == config.treasury,
    )]
    /// CHECK: Validated against config.treasury
    pub treasury: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<SellPosition>, amount: u64, side: bool) -> Result<()> {
    let config = &ctx.accounts.config;
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.position;

    // Validation
    require!(!config.paused, DegenBetsError::PlatformPaused);
    require!(market.status == MarketStatus::Open, DegenBetsError::MarketNotOpen);
    require!(amount > 0, DegenBetsError::ZeroBetAmount);

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < market.resolution_timestamp - config.betting_cutoff_seconds,
        DegenBetsError::BettingClosed
    );

    // Check user has enough on the specified side
    if side {
        require!(position.yes_amount >= amount, DegenBetsError::InsufficientPosition);
    } else {
        require!(position.no_amount >= amount, DegenBetsError::InsufficientPosition);
    }

    // Calculate exit fee using u128 to prevent overflow
    let exit_fee = (amount as u128)
        .checked_mul(config.exit_fee_bps as u128)
        .ok_or(DegenBetsError::MathOverflow)?
        .checked_div(10000)
        .ok_or(DegenBetsError::MathOverflow)? as u64;

    let net_payout = amount
        .checked_sub(exit_fee)
        .ok_or(DegenBetsError::MathOverflow)?;

    // Rent-exemption guard
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(Market::SIZE);
    let market_lamports = ctx.accounts.market.to_account_info().lamports();
    require!(
        market_lamports.checked_sub(amount).unwrap_or(0) >= min_balance,
        DegenBetsError::InsufficientRentBalance
    );

    // Transfer net_payout from market PDA to user
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= net_payout;
    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += net_payout;

    // Transfer exit_fee from market PDA to treasury
    if exit_fee > 0 {
        **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= exit_fee;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += exit_fee;
    }

    // Update pool
    let market = &mut ctx.accounts.market;
    if side {
        market.yes_pool = market.yes_pool.checked_sub(amount).ok_or(DegenBetsError::MathOverflow)?;
    } else {
        market.no_pool = market.no_pool.checked_sub(amount).ok_or(DegenBetsError::MathOverflow)?;
    }

    // Update position
    let position = &mut ctx.accounts.position;
    if side {
        position.yes_amount = position.yes_amount.checked_sub(amount).ok_or(DegenBetsError::MathOverflow)?;
    } else {
        position.no_amount = position.no_amount.checked_sub(amount).ok_or(DegenBetsError::MathOverflow)?;
    }

    emit!(PositionSold {
        market: market.key(),
        user: ctx.accounts.user.key(),
        side,
        amount,
        exit_fee,
        new_yes_pool: market.yes_pool,
        new_no_pool: market.no_pool,
    });

    Ok(())
}
