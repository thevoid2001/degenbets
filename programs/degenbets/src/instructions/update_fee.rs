use anchor_lang::prelude::*;
use crate::state::Config;

#[derive(Accounts)]
pub struct UpdateFee<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority,
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(ctx: Context<UpdateFee>, new_fee_lamports: u64) -> Result<()> {
    ctx.accounts.config.min_liquidity_lamports = new_fee_lamports;
    Ok(())
}
