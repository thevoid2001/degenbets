use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::RefundClaimed;

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.market == market.key(),
        constraint = position.user == user.key(),
    )]
    pub position: Account<'info, Position>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimRefund>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.position;

    require!(market.status == MarketStatus::Voided, DegenBetsError::MarketNotVoided);
    require!(!position.claimed, DegenBetsError::AlreadyClaimed);

    // AMM void refund: each share (YES or NO) is worth 0.5 SOL equivalent
    // total_shares / 2 = SOL refund
    let total_shares = position.yes_shares
        .checked_add(position.no_shares)
        .ok_or(DegenBetsError::MathOverflow)?;
    let refund_amount = total_shares / 2;

    if refund_amount > 0 {
        // Rent-exemption guard
        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(Market::SIZE);
        let market_lamports = ctx.accounts.market.to_account_info().lamports();
        require!(
            market_lamports.checked_sub(refund_amount).unwrap_or(0) >= min_balance,
            DegenBetsError::InsufficientRentBalance
        );

        **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= refund_amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += refund_amount;
    }

    let position = &mut ctx.accounts.position;
    position.claimed = true;

    emit!(RefundClaimed {
        market: ctx.accounts.market.key(),
        user: ctx.accounts.user.key(),
        amount: refund_amount,
    });

    Ok(())
}
