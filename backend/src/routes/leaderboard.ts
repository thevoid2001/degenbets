/**
 * Leaderboard API routes
 *
 * GET /api/leaderboard/bettors  - Top bettors by PnL, volume, or win rate
 * GET /api/leaderboard/creators - Top creators by volume, reputation, or markets
 *
 * @author anon
 */

import { Router, Request, Response } from "express";
import { query } from "../db/pool";

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PositionAggRow {
  [key: string]: unknown;
  wallet: string;
  total_wagered: string;
  total_won: string;
  total_lost: string;
  markets_participated: string;
  markets_won: string;
}

interface CreatorRow {
  [key: string]: unknown;
  wallet: string;
  markets_created: number;
  markets_resolved: number;
  markets_voided: number;
  total_volume_generated: string;
  total_fees_earned: string;
  reputation_score: number;
}

// ---------------------------------------------------------------------------
// GET /api/leaderboard/bettors
// ---------------------------------------------------------------------------

router.get("/bettors", async (req: Request, res: Response) => {
  try {
    const { sort, limit } = req.query;

    const validSorts: Record<string, string> = {
      pnl: "pnl DESC",
      volume: "total_wagered DESC",
      winrate: "CASE WHEN markets_participated > 0 THEN markets_won::float / markets_participated ELSE 0 END DESC",
      wins: "markets_won DESC",
    };

    const sortKey = String(sort || "pnl");
    const sortClause = validSorts[sortKey] || "pnl DESC";
    const limitVal = Math.min(Math.max(1, Number(limit) || 50), 100);

    // Aggregate stats from positions + markets (wrap in subquery so ORDER BY can use aliases)
    const rows = await query<PositionAggRow>(
      `SELECT * FROM (
         SELECT
           p.user_wallet AS wallet,
           SUM(p.yes_amount + p.no_amount) AS total_wagered,
           SUM(CASE WHEN m.status = 'resolved' AND m.outcome IS NOT NULL AND
                ((m.outcome = true AND p.yes_amount > 0) OR (m.outcome = false AND p.no_amount > 0))
                THEN p.yes_amount + p.no_amount ELSE 0 END) AS total_won,
           SUM(CASE WHEN m.status = 'resolved' AND m.outcome IS NOT NULL AND
                ((m.outcome = true AND p.yes_amount = 0 AND p.no_amount > 0) OR
                 (m.outcome = false AND p.no_amount = 0 AND p.yes_amount > 0))
                THEN p.yes_amount + p.no_amount ELSE 0 END) AS total_lost,
           COUNT(*)::text AS markets_participated,
           SUM(CASE WHEN m.status = 'resolved' AND m.outcome IS NOT NULL AND
                ((m.outcome = true AND p.yes_amount > 0) OR (m.outcome = false AND p.no_amount > 0))
                THEN 1 ELSE 0 END)::text AS markets_won,
           SUM(CASE WHEN m.status = 'resolved' AND m.outcome IS NOT NULL AND
                ((m.outcome = true AND p.yes_amount > 0) OR (m.outcome = false AND p.no_amount > 0))
                THEN p.yes_amount + p.no_amount ELSE 0 END)
           - SUM(CASE WHEN m.status = 'resolved' AND m.outcome IS NOT NULL AND
                ((m.outcome = true AND p.yes_amount = 0 AND p.no_amount > 0) OR
                 (m.outcome = false AND p.no_amount = 0 AND p.yes_amount > 0))
                THEN p.yes_amount + p.no_amount ELSE 0 END) AS pnl
         FROM positions p
         JOIN markets m ON p.market_id = m.market_id
         GROUP BY p.user_wallet
         HAVING SUM(p.yes_amount + p.no_amount) > 0
       ) sub
       ORDER BY ${sortClause}
       LIMIT $1`,
      [limitVal]
    );

    const leaderboard = rows.map((r, index) => {
      const totalWagered = Number(r.total_wagered);
      const totalWon = Number(r.total_won);
      const totalLost = Number(r.total_lost);
      const marketsParticipated = Number(r.markets_participated);
      const marketsWon = Number(r.markets_won);
      const pnl = totalWon - totalLost;

      return {
        rank: index + 1,
        wallet: r.wallet,
        total_wagered: totalWagered,
        total_won: totalWon,
        total_lost: totalLost,
        markets_participated: marketsParticipated,
        markets_won: marketsWon,
        pnl,
      };
    });

    res.json({
      leaderboard,
      sortedBy: sortKey,
      total: leaderboard.length,
    });
  } catch (err) {
    console.error("[leaderboard] Bettors error:", err);
    res.status(500).json({ error: "Failed to fetch bettor leaderboard" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/leaderboard/creators
// ---------------------------------------------------------------------------

router.get("/creators", async (req: Request, res: Response) => {
  try {
    const { sort, limit } = req.query;

    const validSorts: Record<string, string> = {
      volume: "total_volume_generated DESC",
      reputation: "reputation_score DESC",
      markets: "markets_created DESC",
      fees: "total_fees_earned DESC",
      resolved: "markets_resolved DESC",
    };

    const sortClause =
      validSorts[String(sort || "volume")] || "total_volume_generated DESC";
    const limitVal = Math.min(Math.max(1, Number(limit) || 50), 100);

    const creators = await query<CreatorRow>(
      `SELECT wallet, markets_created, markets_resolved, markets_voided,
              total_volume_generated, total_fees_earned, reputation_score
       FROM creator_profiles
       WHERE markets_created > 0
       ORDER BY ${sortClause}
       LIMIT $1`,
      [limitVal]
    );

    const leaderboard = creators.map((c, index) => {
      const totalMarkets = c.markets_created || 1;
      const resolutionRate =
        Math.round((c.markets_resolved / totalMarkets) * 10000) / 10000;

      let tier: string;
      if (c.reputation_score >= 2000) tier = "diamond";
      else if (c.reputation_score >= 1500) tier = "gold";
      else if (c.reputation_score >= 1000) tier = "silver";
      else if (c.reputation_score >= 500) tier = "bronze";
      else tier = "unranked";

      return {
        rank: index + 1,
        wallet: c.wallet,
        displayWallet: c.wallet.slice(0, 4) + "..." + c.wallet.slice(-4),
        marketsCreated: c.markets_created,
        marketsResolved: c.markets_resolved,
        marketsVoided: c.markets_voided,
        totalVolumeGenerated: c.total_volume_generated,
        totalFeesEarned: c.total_fees_earned,
        reputationScore: c.reputation_score,
        resolutionRate,
        tier,
      };
    });

    res.json({
      leaderboard,
      sortedBy: String(sort || "volume"),
      total: leaderboard.length,
    });
  } catch (err) {
    console.error("[leaderboard] Creators error:", err);
    res.status(500).json({ error: "Failed to fetch creator leaderboard" });
  }
});

export default router;
