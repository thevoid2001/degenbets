use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::SharesBought;
use crate::math;

#[derive(Accounts)]
pub struct Buy<'info> {
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
        init_if_needed,
        payer = user,
        space = Position::SIZE,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, Position>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Buy>, amount: u64, side: bool) -> Result<()> {
    let config = &ctx.accounts.config;

    require!(!config.paused, DegenBetsError::PlatformPaused);
    require!(amount >= config.min_trade_lamports, DegenBetsError::BelowMinBet);

    let market = &ctx.accounts.market;
    require!(market.status == MarketStatus::Open, DegenBetsError::MarketNotOpen);
    require!(market.yes_reserve > 0 && market.no_reserve > 0, DegenBetsError::EmptyPool);

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < market.resolution_timestamp - config.betting_cutoff_seconds,
        DegenBetsError::BettingClosed
    );

    // Transfer SOL from user to market PDA
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.market.to_account_info(),
            },
        ),
        amount,
    )?;

    // Calculate shares via AMM (mint complete sets + swap)
    let market = &mut ctx.accounts.market;
    let (shares_out, new_ry, new_rn) = if side {
        math::calc_buy_yes(amount, market.yes_reserve, market.no_reserve, market.swap_fee_bps)?
    } else {
        math::calc_buy_no(amount, market.yes_reserve, market.no_reserve, market.swap_fee_bps)?
    };

    // Update market state
    market.yes_reserve = new_ry;
    market.no_reserve = new_rn;
    market.total_minted = market.total_minted
        .checked_add(amount)
        .ok_or(DegenBetsError::MathOverflow)?;

    // Update position
    let position = &mut ctx.accounts.position;
    if position.market == Pubkey::default() {
        position.market = market.key();
        position.user = ctx.accounts.user.key();
        position.claimed = false;
        position.bump = ctx.bumps.position;
    }

    if side {
        position.yes_shares = position.yes_shares
            .checked_add(shares_out)
            .ok_or(DegenBetsError::MathOverflow)?;
    } else {
        position.no_shares = position.no_shares
            .checked_add(shares_out)
            .ok_or(DegenBetsError::MathOverflow)?;
    }

    let price_after = math::price_yes_bps(market.yes_reserve, market.no_reserve);

    emit!(SharesBought {
        market: market.key(),
        user: ctx.accounts.user.key(),
        side,
        sol_amount: amount,
        shares_received: shares_out,
        price_after,
    });

    Ok(())
}
