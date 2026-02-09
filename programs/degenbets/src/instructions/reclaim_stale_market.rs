use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::MarketVoided;

const STALE_GRACE_PERIOD: i64 = 30 * 24 * 3600; // 30 days

#[derive(Accounts)]
pub struct ReclaimStaleMarket<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<ReclaimStaleMarket>) -> Result<()> {
    let market = &ctx.accounts.market;

    require!(market.status == MarketStatus::Open, DegenBetsError::MarketNotOpen);

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp > market.resolution_timestamp + STALE_GRACE_PERIOD,
        DegenBetsError::MarketNotStale
    );

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Voided;
    market.outcome = None;

    emit!(MarketVoided {
        market: market.key(),
        reason: "Auto-voided: unresolved for 30+ days past resolution time".to_string(),
    });

    Ok(())
}
