use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::MarketResolved;

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
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

pub fn handler(ctx: Context<ResolveMarket>, outcome: bool) -> Result<()> {
    let market = &ctx.accounts.market;

    require!(market.status == MarketStatus::Open, DegenBetsError::MarketNotOpen);

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= market.resolution_timestamp,
        DegenBetsError::MarketNotReady
    );

    let total_pot = market.yes_pool
        .checked_add(market.no_pool)
        .ok_or(DegenBetsError::MathOverflow)?;

    // Calculate fees using u128 for safety
    let treasury_fee = ((total_pot as u128)
        .checked_mul(ctx.accounts.config.treasury_rake_bps as u128)
        .ok_or(DegenBetsError::MathOverflow)?
        / 10000u128) as u64;

    let creator_fee = ((total_pot as u128)
        .checked_mul(ctx.accounts.config.creator_rake_bps as u128)
        .ok_or(DegenBetsError::MathOverflow)?
        / 10000u128) as u64;

    // NOTE: Treasury fee is NOT transferred here. It stays in the market PDA
    // during the challenge period and is collected later via claim_treasury_fee.
    // This ensures full refunds are possible if the market is voided during challenge.

    // Update market
    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Resolved;
    market.outcome = Some(outcome);
    market.resolved_at = clock.unix_timestamp;
    market.treasury_fee = treasury_fee;
    market.creator_fee = creator_fee;

    // Update creator profile
    let profile = &mut ctx.accounts.creator_profile;
    profile.markets_resolved += 1;
    profile.total_volume_generated = profile.total_volume_generated
        .checked_add(total_pot)
        .ok_or(DegenBetsError::MathOverflow)?;

    emit!(MarketResolved {
        market: market.key(),
        outcome,
        total_pot,
        treasury_fee,
        creator_fee,
    });

    Ok(())
}
