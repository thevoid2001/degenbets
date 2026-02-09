use anchor_lang::prelude::*;
use crate::state::Config;
use crate::errors::DegenBetsError;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority,
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(
    ctx: Context<UpdateConfig>,
    treasury: Option<Pubkey>,
    creation_fee_lamports: Option<u64>,
    treasury_rake_bps: Option<u16>,
    creator_rake_bps: Option<u16>,
    min_bet_lamports: Option<u64>,
    betting_cutoff_seconds: Option<i64>,
    challenge_period_seconds: Option<i64>,
    exit_fee_bps: Option<u16>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(t) = treasury {
        config.treasury = t;
    }
    if let Some(f) = creation_fee_lamports {
        config.creation_fee_lamports = f;
    }
    if let Some(bps) = treasury_rake_bps {
        require!(bps <= 10000, DegenBetsError::InvalidRakeBps);
        config.treasury_rake_bps = bps;
    }
    if let Some(bps) = creator_rake_bps {
        require!(bps <= 10000, DegenBetsError::InvalidRakeBps);
        config.creator_rake_bps = bps;
    }
    if treasury_rake_bps.is_some() || creator_rake_bps.is_some() {
        require!(
            (config.treasury_rake_bps as u32 + config.creator_rake_bps as u32) <= 10000,
            DegenBetsError::InvalidRakeBps
        );
    }
    if let Some(m) = min_bet_lamports {
        require!(m > 0, DegenBetsError::InvalidConfigParam);
        config.min_bet_lamports = m;
    }
    if let Some(b) = betting_cutoff_seconds {
        require!(b > 0, DegenBetsError::InvalidConfigParam);
        config.betting_cutoff_seconds = b;
    }
    if let Some(c) = challenge_period_seconds {
        require!(c > 0, DegenBetsError::InvalidConfigParam);
        config.challenge_period_seconds = c;
    }
    if let Some(bps) = exit_fee_bps {
        require!(bps <= 10000, DegenBetsError::InvalidRakeBps);
        config.exit_fee_bps = bps;
    }

    Ok(())
}
