use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::MarketVoided;

#[derive(Accounts)]
pub struct VoidMarket<'info> {
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

    #[account(
        mut,
        seeds = [b"creator", market.creator.as_ref()],
        bump = creator_profile.bump,
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
}

pub fn handler(ctx: Context<VoidMarket>, reason: String) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let config = &ctx.accounts.config;

    // Allow voiding Open markets, or Resolved markets still within challenge period
    let clock = Clock::get()?;
    let can_void = market.status == MarketStatus::Open
        || (market.status == MarketStatus::Resolved
            && clock.unix_timestamp < market.resolved_at + config.challenge_period_seconds);
    require!(can_void, DegenBetsError::MarketNotVoidable);

    market.status = MarketStatus::Voided;
    market.outcome = None;

    // Update creator profile - reputation hit
    let profile = &mut ctx.accounts.creator_profile;
    profile.markets_voided += 1;
    // Lose 10 reputation points per void, minimum 0
    profile.reputation_score = profile.reputation_score.saturating_sub(10);

    emit!(MarketVoided {
        market: market.key(),
        reason,
    });

    Ok(())
}
