use anchor_lang::prelude::*;

declare_id!("8pEfVsAfjmuCLqoH2T5uXQHvUxg3f1sYLjw8mLJydXtW");

pub mod state;
pub mod instructions;
pub mod errors;
pub mod events;
pub mod math;

use instructions::*;

#[program]
pub mod degenbets {
    use super::*;

    pub fn initialize(
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
        instructions::initialize::handler(
            ctx,
            treasury,
            min_liquidity_lamports,
            treasury_rake_bps,
            creator_rake_bps,
            min_trade_lamports,
            betting_cutoff_seconds,
            challenge_period_seconds,
            swap_fee_bps,
        )
    }

    pub fn update_fee(ctx: Context<UpdateFee>, new_fee_lamports: u64) -> Result<()> {
        instructions::update_fee::handler(ctx, new_fee_lamports)
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        resolution_source: String,
        resolution_timestamp: i64,
        liquidity_amount: u64,
    ) -> Result<()> {
        instructions::create_market::handler(ctx, question, resolution_source, resolution_timestamp, liquidity_amount)
    }

    pub fn buy(ctx: Context<Buy>, amount: u64, side: bool) -> Result<()> {
        instructions::buy::handler(ctx, amount, side)
    }

    pub fn sell(ctx: Context<Sell>, shares: u64, side: bool) -> Result<()> {
        instructions::sell::handler(ctx, shares, side)
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>, outcome: bool) -> Result<()> {
        instructions::resolve_market::handler(ctx, outcome)
    }

    pub fn void_market(ctx: Context<VoidMarket>, reason: String) -> Result<()> {
        instructions::void_market::handler(ctx, reason)
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::handler(ctx)
    }

    pub fn claim_creator_fee(ctx: Context<ClaimCreatorFee>) -> Result<()> {
        instructions::claim_creator_fee::handler(ctx)
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::claim_refund::handler(ctx)
    }

    pub fn claim_treasury_fee(ctx: Context<ClaimTreasuryFee>) -> Result<()> {
        instructions::claim_treasury_fee::handler(ctx)
    }

    pub fn toggle_pause(ctx: Context<TogglePause>) -> Result<()> {
        instructions::toggle_pause::handler(ctx)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        treasury: Option<Pubkey>,
        min_liquidity_lamports: Option<u64>,
        treasury_rake_bps: Option<u16>,
        creator_rake_bps: Option<u16>,
        min_trade_lamports: Option<u64>,
        betting_cutoff_seconds: Option<i64>,
        challenge_period_seconds: Option<i64>,
        swap_fee_bps: Option<u16>,
    ) -> Result<()> {
        instructions::update_config::handler(
            ctx,
            treasury,
            min_liquidity_lamports,
            treasury_rake_bps,
            creator_rake_bps,
            min_trade_lamports,
            betting_cutoff_seconds,
            challenge_period_seconds,
            swap_fee_bps,
        )
    }

    pub fn transfer_authority(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::transfer_authority::handler(ctx, new_authority)
    }

    pub fn reclaim_stale_market(ctx: Context<ReclaimStaleMarket>) -> Result<()> {
        instructions::reclaim_stale_market::handler(ctx)
    }

    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        instructions::close_market::handler(ctx)
    }

    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        instructions::close_position::handler(ctx)
    }
}
