use anchor_lang::prelude::*;

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub question: String,
    pub resolution_source: String,
    pub resolution_timestamp: i64,
    pub creation_fee_paid: u64,
    pub market_id: u64,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub user: Pubkey,
    pub side: bool,
    pub amount: u64,
    pub new_yes_pool: u64,
    pub new_no_pool: u64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub outcome: bool,
    pub total_pot: u64,
    pub treasury_fee: u64,
    pub creator_fee: u64,
}

#[event]
pub struct MarketVoided {
    pub market: Pubkey,
    pub reason: String,
}

#[event]
pub struct WinningsClaimed {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct CreatorFeeClaimed {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RefundClaimed {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TreasuryFeeClaimed {
    pub market: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PlatformPauseToggled {
    pub paused: bool,
}

#[event]
pub struct PositionSold {
    pub market: Pubkey,
    pub user: Pubkey,
    pub side: bool,
    pub amount: u64,
    pub exit_fee: u64,
    pub new_yes_pool: u64,
    pub new_no_pool: u64,
}

#[event]
pub struct AuthorityTransferred {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}
