use anchor_lang::prelude::*;

#[error_code]
pub enum DegenBetsError {
    #[msg("Question exceeds maximum length")]
    QuestionTooLong,

    #[msg("Resolution source URL exceeds maximum length")]
    SourceTooLong,

    #[msg("Resolution timestamp must be at least 60 seconds in the future")]
    ResolutionTooSoon,

    #[msg("Market is not open for betting")]
    MarketNotOpen,

    #[msg("Market resolution time has not passed yet")]
    MarketNotReady,

    #[msg("Market resolution time has already passed")]
    MarketExpired,

    #[msg("Bet amount must be greater than zero")]
    ZeroBetAmount,

    #[msg("Market is not resolved")]
    MarketNotResolved,

    #[msg("Market is not voided")]
    MarketNotVoided,

    #[msg("Position already claimed")]
    AlreadyClaimed,

    #[msg("User did not bet on the winning side")]
    NotAWinner,

    #[msg("Creator fee already claimed")]
    CreatorFeeAlreadyClaimed,

    #[msg("Only the market creator can claim the creator fee")]
    NotMarketCreator,

    #[msg("Invalid rake basis points (must be <= 10000)")]
    InvalidRakeBps,

    #[msg("Arithmetic overflow")]
    MathOverflow,

    #[msg("Invalid resolution source URL")]
    InvalidSourceUrl,

    #[msg("Betting is closed (within cutoff window before resolution)")]
    BettingClosed,

    #[msg("Bet amount is below the minimum")]
    BelowMinBet,

    #[msg("Platform is paused")]
    PlatformPaused,

    #[msg("Challenge period has not ended yet")]
    ChallengePeriodActive,

    #[msg("Market cannot be voided in current state")]
    MarketNotVoidable,

    #[msg("Treasury fee already claimed")]
    TreasuryFeeAlreadyClaimed,

    #[msg("Insufficient balance for rent exemption")]
    InsufficientRentBalance,

    #[msg("Invalid config parameter (must be > 0)")]
    InvalidConfigParam,

    #[msg("Market is not stale enough to reclaim")]
    MarketNotStale,

    #[msg("Market cannot be closed in current state")]
    MarketNotCloseable,

    #[msg("Sell amount exceeds position")]
    InsufficientPosition,
}
