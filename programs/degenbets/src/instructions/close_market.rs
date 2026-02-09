use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    #[account(
        mut,
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
        close = authority,
    )]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<CloseMarket>) -> Result<()> {
    let market = &ctx.accounts.market;

    // Can close voided markets or resolved markets where both fees are claimed
    let can_close = market.status == MarketStatus::Voided
        || (market.status == MarketStatus::Resolved
            && market.creator_fee_claimed
            && market.treasury_fee_claimed);

    require!(can_close, DegenBetsError::MarketNotCloseable);

    Ok(())
}
