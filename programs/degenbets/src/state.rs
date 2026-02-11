use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub min_liquidity_lamports: u64,
    pub treasury_rake_bps: u16,
    pub creator_rake_bps: u16,
    pub market_count: u64,
    pub paused: bool,
    pub min_trade_lamports: u64,
    pub betting_cutoff_seconds: i64,
    pub challenge_period_seconds: i64,
    pub swap_fee_bps: u16,
    pub bump: u8,
}

impl Config {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 2 + 2 + 8 + 1 + 8 + 8 + 8 + 2 + 1;
}

#[account]
pub struct Market {
    pub creator: Pubkey,
    pub question: String,
    pub resolution_source: String,

    // AMM state
    pub yes_reserve: u64,
    pub no_reserve: u64,
    pub total_minted: u64,
    pub initial_liquidity: u64,
    pub swap_fee_bps: u16,

    pub resolution_timestamp: i64,
    pub status: MarketStatus,
    pub outcome: Option<bool>,
    pub creator_fee_claimed: bool,
    pub treasury_fee_claimed: bool,
    pub market_id: u64,
    pub resolved_at: i64,
    pub bump: u8,
    pub treasury_fee: u64,
    pub creator_fee: u64,
    pub treasury_rake_bps: u16,
    pub creator_rake_bps: u16,
}

impl Market {
    pub const MAX_QUESTION_LEN: usize = 256;
    pub const MAX_SOURCE_LEN: usize = 512;
    pub const SIZE: usize = 8    // discriminator
        + 32                      // creator
        + 4 + Self::MAX_QUESTION_LEN  // question (string prefix + data)
        + 4 + Self::MAX_SOURCE_LEN    // resolution_source
        + 8                       // yes_reserve
        + 8                       // no_reserve
        + 8                       // total_minted
        + 8                       // initial_liquidity
        + 2                       // swap_fee_bps
        + 8                       // resolution_timestamp
        + 1                       // status
        + 1 + 1                   // outcome (Option<bool>)
        + 1                       // creator_fee_claimed
        + 1                       // treasury_fee_claimed
        + 8                       // market_id
        + 8                       // resolved_at
        + 1                       // bump
        + 8                       // treasury_fee
        + 8                       // creator_fee
        + 2                       // treasury_rake_bps
        + 2;                      // creator_rake_bps
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MarketStatus {
    Open,
    Resolved,
    Voided,
}

#[account]
pub struct Position {
    pub market: Pubkey,
    pub user: Pubkey,
    pub yes_shares: u64,
    pub no_shares: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl Position {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1;
}

#[account]
pub struct CreatorProfile {
    pub wallet: Pubkey,
    pub markets_created: u32,
    pub markets_resolved: u32,
    pub markets_voided: u32,
    pub total_volume_generated: u64,
    pub total_fees_earned: u64,
    pub reputation_score: u32,
    pub bump: u8,
}

impl CreatorProfile {
    pub const SIZE: usize = 8 + 32 + 4 + 4 + 4 + 8 + 8 + 4 + 1;
}
