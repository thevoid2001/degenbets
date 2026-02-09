use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::BetPlaced;

#[derive(Accounts)]
pub struct PlaceBet<'info> {
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

pub fn handler(ctx: Context<PlaceBet>, amount: u64, side: bool) -> Result<()> {
    let config = &ctx.accounts.config;

    // Security: platform pause check
    require!(!config.paused, DegenBetsError::PlatformPaused);

    // Security: minimum bet
    require!(amount >= config.min_bet_lamports, DegenBetsError::BelowMinBet);

    let market = &ctx.accounts.market;
    require!(market.status == MarketStatus::Open, DegenBetsError::MarketNotOpen);

    let clock = Clock::get()?;

    // Security: betting cutoff window
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

    // Update market pools
    let market = &mut ctx.accounts.market;
    if side {
        market.yes_pool = market.yes_pool.checked_add(amount).ok_or(DegenBetsError::MathOverflow)?;
    } else {
        market.no_pool = market.no_pool.checked_add(amount).ok_or(DegenBetsError::MathOverflow)?;
    }

    // Update position
    let position = &mut ctx.accounts.position;
    if position.market == Pubkey::default() {
        position.market = market.key();
        position.user = ctx.accounts.user.key();
        position.claimed = false;
        position.bump = ctx.bumps.position;
    }

    if side {
        position.yes_amount = position.yes_amount.checked_add(amount).ok_or(DegenBetsError::MathOverflow)?;
    } else {
        position.no_amount = position.no_amount.checked_add(amount).ok_or(DegenBetsError::MathOverflow)?;
    }

    emit!(BetPlaced {
        market: market.key(),
        user: ctx.accounts.user.key(),
        side,
        amount,
        new_yes_pool: market.yes_pool,
        new_no_pool: market.no_pool,
    });

    Ok(())
}
