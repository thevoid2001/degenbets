use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::SharesSold;
use crate::math;

#[derive(Accounts)]
pub struct Sell<'info> {
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
}

pub fn handler(ctx: Context<Sell>, shares: u64, side: bool) -> Result<()> {
    let config = &ctx.accounts.config;

    require!(!config.paused, DegenBetsError::PlatformPaused);
    require!(shares > 0, DegenBetsError::ZeroBetAmount);

    // Validate market state (read fields without holding borrow)
    let market_key = ctx.accounts.market.key();
    let market_status = ctx.accounts.market.status.clone();
    let resolution_ts = ctx.accounts.market.resolution_timestamp;

    require!(market_status == MarketStatus::Open, DegenBetsError::MarketNotOpen);

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < resolution_ts - config.betting_cutoff_seconds,
        DegenBetsError::BettingClosed
    );

    // Validate sufficient shares
    if side {
        require!(ctx.accounts.position.yes_shares >= shares, DegenBetsError::InsufficientShares);
    } else {
        require!(ctx.accounts.position.no_shares >= shares, DegenBetsError::InsufficientShares);
    }

    // Sell shares through the AMM (users can only hold one side)
    let position = &mut ctx.accounts.position;
    let market = &mut ctx.accounts.market;

    let (total_sol_out, new_ry, new_rn) = if side {
        math::calc_sell_yes(shares, market.yes_reserve, market.no_reserve, market.swap_fee_bps)?
    } else {
        math::calc_sell_no(shares, market.yes_reserve, market.no_reserve, market.swap_fee_bps)?
    };

    market.yes_reserve = new_ry;
    market.no_reserve = new_rn;

    // Update total_minted (decreased by SOL leaving the vault)
    market.total_minted = market.total_minted
        .checked_sub(total_sol_out)
        .ok_or(DegenBetsError::MathOverflow)?;

    let final_ry = market.yes_reserve;
    let final_rn = market.no_reserve;

    // Rent guard
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(Market::SIZE);
    let market_lamports = market.to_account_info().lamports();
    require!(
        market_lamports.checked_sub(total_sol_out).unwrap_or(0) >= min_balance,
        DegenBetsError::InsufficientRentBalance
    );

    // Transfer SOL from market PDA to user
    **market.to_account_info().try_borrow_mut_lamports()? -= total_sol_out;
    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += total_sol_out;

    // Update position (deduct sold shares)
    if side {
        position.yes_shares = position.yes_shares
            .checked_sub(shares)
            .ok_or(DegenBetsError::MathOverflow)?;
    } else {
        position.no_shares = position.no_shares
            .checked_sub(shares)
            .ok_or(DegenBetsError::MathOverflow)?;
    }

    let price_after = math::price_yes_bps(final_ry, final_rn);

    emit!(SharesSold {
        market: market_key,
        user: ctx.accounts.user.key(),
        side,
        shares_sold: shares,
        sol_received: total_sol_out,
        price_after,
    });

    Ok(())
}
