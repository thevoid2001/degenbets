use anchor_lang::prelude::*;
use crate::state::Config;
use crate::events::AuthorityTransferred;

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority,
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
    let old_authority = ctx.accounts.config.authority;
    ctx.accounts.config.authority = new_authority;

    emit!(AuthorityTransferred {
        old_authority,
        new_authority,
    });

    Ok(())
}
