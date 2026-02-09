use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::DegenBetsError;
use crate::events::MarketCreated;

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = creator,
        space = Market::SIZE,
        seeds = [b"market", config.market_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = creator,
        space = CreatorProfile::SIZE,
        seeds = [b"creator", creator.key().as_ref()],
        bump,
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    /// Treasury wallet to receive creation fee
    #[account(
        mut,
        constraint = treasury.key() == config.treasury,
    )]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateMarket>,
    question: String,
    resolution_source: String,
    resolution_timestamp: i64,
) -> Result<()> {
    // Security: platform pause check
    require!(!ctx.accounts.config.paused, DegenBetsError::PlatformPaused);

    require!(question.len() <= Market::MAX_QUESTION_LEN, DegenBetsError::QuestionTooLong);
    require!(resolution_source.len() <= Market::MAX_SOURCE_LEN, DegenBetsError::SourceTooLong);

    // Basic URL validation
    require!(
        resolution_source.starts_with("http://") || resolution_source.starts_with("https://"),
        DegenBetsError::InvalidSourceUrl
    );

    let clock = Clock::get()?;
    require!(
        resolution_timestamp > clock.unix_timestamp + 60,
        DegenBetsError::ResolutionTooSoon
    );

    // Transfer SOL creation fee to treasury
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.creator.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, ctx.accounts.config.creation_fee_lamports)?;

    // Initialize market
    let market = &mut ctx.accounts.market;
    let config = &mut ctx.accounts.config;

    market.creator = ctx.accounts.creator.key();
    market.question = question.clone();
    market.resolution_source = resolution_source.clone();
    market.yes_pool = 0;
    market.no_pool = 0;
    market.resolution_timestamp = resolution_timestamp;
    market.status = MarketStatus::Open;
    market.outcome = None;
    market.creator_fee_claimed = false;
    market.treasury_fee_claimed = false;
    market.market_id = config.market_count;
    market.resolved_at = 0;
    market.bump = ctx.bumps.market;
    market.treasury_fee = 0;
    market.creator_fee = 0;
    market.treasury_rake_bps = config.treasury_rake_bps;
    market.creator_rake_bps = config.creator_rake_bps;

    // Update creator profile
    let profile = &mut ctx.accounts.creator_profile;
    if profile.markets_created == 0 && profile.wallet == Pubkey::default() {
        profile.wallet = ctx.accounts.creator.key();
        profile.reputation_score = 100;
        profile.bump = ctx.bumps.creator_profile;
    }
    profile.markets_created += 1;

    // Increment market count
    config.market_count = config.market_count
        .checked_add(1)
        .ok_or(DegenBetsError::MathOverflow)?;

    emit!(MarketCreated {
        market: market.key(),
        creator: ctx.accounts.creator.key(),
        question,
        resolution_source,
        resolution_timestamp,
        creation_fee_paid: config.creation_fee_lamports,
        market_id: market.market_id,
    });

    Ok(())
}
