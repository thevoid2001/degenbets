use anchor_lang::prelude::*;

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub question: String,
    pub resolution_source: String,
    pub resolution_timestamp: i64,
    pub liquidity_amount: u64,
    pub market_id: u64,
}

#[event]
pub struct SharesBought {
    pub market: Pubkey,
    pub user: Pubkey,
    pub side: bool,
    pub sol_amount: u64,
    pub shares_received: u64,
    pub price_after: u64,
}

#[event]
pub struct SharesSold {
    pub market: Pubkey,
    pub user: Pubkey,
    pub side: bool,
    pub shares_sold: u64,
    pub sol_received: u64,
    pub price_after: u64,
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
pub struct AuthorityTransferred {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}
