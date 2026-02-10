-- DegenBets Prediction Market - Database Schema
-- author: anon

-- Markets table: mirrors on-chain market state with additional indexing metadata
CREATE TABLE IF NOT EXISTS markets (
    id                  SERIAL PRIMARY KEY,
    market_id           BIGINT UNIQUE NOT NULL,             -- on-chain market_id
    pubkey              VARCHAR(64) NOT NULL UNIQUE,         -- market PDA address
    creator             VARCHAR(64) NOT NULL,                -- creator wallet pubkey
    question            TEXT NOT NULL,
    resolution_source   TEXT NOT NULL,                       -- URL for AI resolution
    yes_pool            BIGINT NOT NULL DEFAULT 0,           -- lamports in YES pool
    no_pool             BIGINT NOT NULL DEFAULT 0,           -- lamports in NO pool
    resolution_timestamp BIGINT NOT NULL,                    -- unix epoch seconds
    status              VARCHAR(16) NOT NULL DEFAULT 'open', -- open | resolved | voided
    outcome             BOOLEAN,                             -- NULL until resolved; TRUE=yes, FALSE=no
    creator_fee_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    category            VARCHAR(32) NOT NULL DEFAULT 'misc',  -- sports | crypto | politics | entertainment | misc
    image_url           TEXT,                            -- optional market image URL
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_creator ON markets(creator);
CREATE INDEX IF NOT EXISTS idx_markets_resolution_ts ON markets(resolution_timestamp);

-- Positions table: user bets on markets
CREATE TABLE IF NOT EXISTS positions (
    id          SERIAL PRIMARY KEY,
    market_id   BIGINT NOT NULL REFERENCES markets(market_id),
    pubkey      VARCHAR(64) NOT NULL UNIQUE,     -- position PDA address
    user_wallet VARCHAR(64) NOT NULL,
    yes_amount  BIGINT NOT NULL DEFAULT 0,       -- lamports bet on YES
    no_amount   BIGINT NOT NULL DEFAULT 0,       -- lamports bet on NO
    claimed     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_wallet);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);

-- Creator profiles: aggregated creator stats (mirrors on-chain CreatorProfile)
CREATE TABLE IF NOT EXISTS creator_profiles (
    id                       SERIAL PRIMARY KEY,
    wallet                   VARCHAR(64) NOT NULL UNIQUE,
    pubkey                   VARCHAR(64) NOT NULL UNIQUE,  -- profile PDA address
    markets_created          INT NOT NULL DEFAULT 0,
    markets_resolved         INT NOT NULL DEFAULT 0,
    markets_voided           INT NOT NULL DEFAULT 0,
    total_volume_generated   BIGINT NOT NULL DEFAULT 0,    -- lamports
    total_fees_earned        BIGINT NOT NULL DEFAULT 0,    -- lamports
    reputation_score         INT NOT NULL DEFAULT 1000,    -- starts at 1000
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User stats: aggregated bettor statistics
CREATE TABLE IF NOT EXISTS user_stats (
    id              SERIAL PRIMARY KEY,
    wallet          VARCHAR(64) NOT NULL UNIQUE,
    total_bets      INT NOT NULL DEFAULT 0,
    total_wagered   BIGINT NOT NULL DEFAULT 0,       -- lamports
    total_won       BIGINT NOT NULL DEFAULT 0,       -- lamports
    total_lost      BIGINT NOT NULL DEFAULT 0,       -- lamports
    win_count       INT NOT NULL DEFAULT 0,
    loss_count      INT NOT NULL DEFAULT 0,
    current_streak  INT NOT NULL DEFAULT 0,          -- positive = win streak, negative = loss streak
    best_streak     INT NOT NULL DEFAULT 0,
    pnl             BIGINT NOT NULL DEFAULT 0,       -- net profit/loss in lamports
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_pnl ON user_stats(pnl DESC);

-- Resolution logs: audit trail of AI resolution attempts
CREATE TABLE IF NOT EXISTS resolution_logs (
    id              SERIAL PRIMARY KEY,
    market_id       BIGINT NOT NULL REFERENCES markets(market_id),
    source_url      TEXT NOT NULL,
    source_text     TEXT,                            -- extracted text from source (truncated)
    ai_reasoning    TEXT,                            -- AI reasoning
    ai_decision     VARCHAR(16),                     -- yes | no | void | error
    confidence      REAL,                            -- 0.0 to 1.0
    tx_signature    VARCHAR(128),                    -- on-chain tx if resolution submitted
    error_message   TEXT,                            -- error details if failed
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resolution_logs_market ON resolution_logs(market_id);

-- Updated-at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['markets', 'positions', 'creator_profiles', 'user_stats'])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trigger_update_%I_updated_at ON %I; '
            'CREATE TRIGGER trigger_update_%I_updated_at '
            'BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END;
$$;
