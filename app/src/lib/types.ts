export type MarketCategory = "sports" | "crypto" | "politics" | "entertainment" | "misc";

export interface MarketData {
  pubkey: string;
  market_id: number;
  creator: string;
  question: string;
  resolution_source: string;
  yes_reserve: number;
  no_reserve: number;
  total_minted: number;
  initial_liquidity: number;
  swap_fee_bps: number;
  yes_price: number;
  no_price: number;
  total_volume: number;
  resolution_timestamp: number;
  status: "open" | "resolved" | "voided";
  outcome: boolean | null;
  image_url?: string | null;
  category?: MarketCategory;
  ai_reasoning?: string;
  created_at: string;
}

export interface PositionData {
  market_id?: number;
  market_pubkey: string;
  user_wallet: string;
  yes_shares: number;
  no_shares: number;
  claimed: boolean;
  winnings?: number;
  question?: string;
  status?: "open" | "resolved" | "voided";
  won?: boolean;
}

export interface CreatorProfileData {
  wallet: string;
  markets_created: number;
  markets_resolved: number;
  markets_voided: number;
  total_volume: number;
  total_fees_earned: number;
  reputation_score: number;
}

export interface UserStatsData {
  wallet: string;
  total_wagered: number;
  total_won: number;
  total_lost: number;
  markets_participated: number;
  markets_won: number;
}
