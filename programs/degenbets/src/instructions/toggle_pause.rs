use anchor_lang::prelude::*;
use crate::state::Config;
use crate::events::PlatformPauseToggled;

#[derive(Accounts)]
pub struct TogglePause<'info> {
    #[account(
        constraint = authority.key() == config.authority,
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(ctx: Context<TogglePause>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.paused = !config.paused;

    emit!(PlatformPauseToggled {
        paused: config.paused,
    });

    Ok(())
}
