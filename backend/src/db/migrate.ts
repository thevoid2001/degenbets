/**
 * Database migration runner - executes schema DDL
 * @author anon
 *
 * Usage: npx ts-node src/db/migrate.ts
 */

import dotenv from "dotenv";
import pool from "./pool";

dotenv.config();

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS markets (
    id                  SERIAL PRIMARY KEY,
    market_id           BIGINT UNIQUE NOT NULL,
    pubkey              VARCHAR(64) NOT NULL UNIQUE,
    creator             VARCHAR(64) NOT NULL,
    question            TEXT NOT NULL,
    resolution_source   TEXT NOT NULL,
    yes_pool            BIGINT NOT NULL DEFAULT 0,
    no_pool             BIGINT NOT NULL DEFAULT 0,
    resolution_timestamp BIGINT NOT NULL,
    status              VARCHAR(16) NOT NULL DEFAULT 'open',
    outcome             BOOLEAN,
    creator_fee_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    category            VARCHAR(32) NOT NULL DEFAULT 'misc',
    image_url           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_creator ON markets(creator);
CREATE INDEX IF NOT EXISTS idx_markets_resolution_ts ON markets(resolution_timestamp);

CREATE TABLE IF NOT EXISTS positions (
    id          SERIAL PRIMARY KEY,
    market_id   BIGINT NOT NULL REFERENCES markets(market_id),
    pubkey      VARCHAR(64) NOT NULL UNIQUE,
    user_wallet VARCHAR(64) NOT NULL,
    yes_amount  BIGINT NOT NULL DEFAULT 0,
    no_amount   BIGINT NOT NULL DEFAULT 0,
    claimed     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_wallet);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);

CREATE TABLE IF NOT EXISTS creator_profiles (
    id                       SERIAL PRIMARY KEY,
    wallet                   VARCHAR(64) NOT NULL UNIQUE,
    pubkey                   VARCHAR(64) NOT NULL UNIQUE,
    markets_created          INT NOT NULL DEFAULT 0,
    markets_resolved         INT NOT NULL DEFAULT 0,
    markets_voided           INT NOT NULL DEFAULT 0,
    total_volume_generated   BIGINT NOT NULL DEFAULT 0,
    total_fees_earned        BIGINT NOT NULL DEFAULT 0,
    reputation_score         INT NOT NULL DEFAULT 1000,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_stats (
    id              SERIAL PRIMARY KEY,
    wallet          VARCHAR(64) NOT NULL UNIQUE,
    total_bets      INT NOT NULL DEFAULT 0,
    total_wagered   BIGINT NOT NULL DEFAULT 0,
    total_won       BIGINT NOT NULL DEFAULT 0,
    total_lost      BIGINT NOT NULL DEFAULT 0,
    win_count       INT NOT NULL DEFAULT 0,
    loss_count      INT NOT NULL DEFAULT 0,
    current_streak  INT NOT NULL DEFAULT 0,
    best_streak     INT NOT NULL DEFAULT 0,
    pnl             BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_pnl ON user_stats(pnl DESC);

CREATE TABLE IF NOT EXISTS resolution_logs (
    id              SERIAL PRIMARY KEY,
    market_id       BIGINT NOT NULL REFERENCES markets(market_id),
    source_url      TEXT NOT NULL,
    source_text     TEXT,
    ai_reasoning    TEXT,
    ai_decision     VARCHAR(16),
    confidence      REAL,
    tx_signature    VARCHAR(128),
    error_message   TEXT,
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resolution_logs_market ON resolution_logs(market_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
`;

async function migrate(): Promise<void> {
  console.log("[migrate] Connecting to database...");

  const client = await pool.connect();
  try {
    console.log("[migrate] Running schema migrations...");
    await client.query(SCHEMA_SQL);
    console.log("[migrate] Schema migration completed successfully.");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
