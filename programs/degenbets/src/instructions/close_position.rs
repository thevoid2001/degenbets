use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"market", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.user == user.key(),
        constraint = position.claimed @ DegenBetsError::AlreadyClaimed,
        close = user,
    )]
    pub position: Account<'info, Position>,
}

pub fn handler(ctx: Context<ClosePosition>) -> Result<()> {
    let market = &ctx.accounts.market;

    require!(
        market.status == MarketStatus::Resolved || market.status == MarketStatus::Voided,
        DegenBetsError::MarketNotResolved
    );

    Ok(())
}
