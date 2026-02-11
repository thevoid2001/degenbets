use anchor_lang::prelude::*;
use crate::state::Config;
use crate::errors::DegenBetsError;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Config::SIZE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    treasury: Pubkey,
    min_liquidity_lamports: u64,
    treasury_rake_bps: u16,
    creator_rake_bps: u16,
    min_trade_lamports: u64,
    betting_cutoff_seconds: i64,
    challenge_period_seconds: i64,
    swap_fee_bps: u16,
) -> Result<()> {
    require!(
        treasury_rake_bps <= 10000 && creator_rake_bps <= 10000,
        DegenBetsError::InvalidRakeBps
    );
    require!(
        (treasury_rake_bps as u32 + creator_rake_bps as u32) <= 10000,
        DegenBetsError::InvalidRakeBps
    );
    require!(swap_fee_bps <= 10000, DegenBetsError::InvalidRakeBps);
    require!(min_trade_lamports > 0, DegenBetsError::InvalidConfigParam);
    require!(betting_cutoff_seconds > 0, DegenBetsError::InvalidConfigParam);
    require!(challenge_period_seconds > 0, DegenBetsError::InvalidConfigParam);

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.treasury = treasury;
    config.min_liquidity_lamports = min_liquidity_lamports;
    config.treasury_rake_bps = treasury_rake_bps;
    config.creator_rake_bps = creator_rake_bps;
    config.market_count = 0;
    config.paused = false;
    config.min_trade_lamports = min_trade_lamports;
    config.betting_cutoff_seconds = betting_cutoff_seconds;
    config.challenge_period_seconds = challenge_period_seconds;
    config.swap_fee_bps = swap_fee_bps;
    config.bump = ctx.bumps.config;

    Ok(())
}
