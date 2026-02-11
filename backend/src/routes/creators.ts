/**
 * Creator API routes
 *
 * GET /api/creator/:wallet/profile - Creator profile and stats
 * GET /api/creator/:wallet/markets - Markets created by a wallet
 *
 * @author anon
 */

import { Router, Request, Response } from "express";
import { query } from "../db/pool";

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreatorProfileRow {
  [key: string]: unknown;
  wallet: string;
  pubkey: string;
  markets_created: number;
  markets_resolved: number;
  markets_voided: number;
  total_volume_generated: string;
  total_fees_earned: string;
  reputation_score: number;
  created_at: string;
  updated_at: string;
}

interface CreatorMarketRow {
  [key: string]: unknown;
  market_id: number;
  pubkey: string;
  question: string;
  yes_reserve: string;
  no_reserve: string;
  resolution_timestamp: string;
  status: string;
  outcome: boolean | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidWallet(wallet: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
}

// ---------------------------------------------------------------------------
// GET /api/creator/:wallet/profile
// ---------------------------------------------------------------------------

router.get("/:wallet/profile", async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;

    if (!isValidWallet(wallet)) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }

    const profiles = await query<CreatorProfileRow>(
      "SELECT * FROM creator_profiles WHERE wallet = $1",
      [wallet]
    );

    if (profiles.length === 0) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const p = profiles[0];
    const totalMarkets = p.markets_created || 1;
    const resolutionRate =
      totalMarkets > 0
        ? Math.round((p.markets_resolved / totalMarkets) * 10000) / 10000
        : 0;
    const voidRate =
      totalMarkets > 0
        ? Math.round((p.markets_voided / totalMarkets) * 10000) / 10000
        : 0;

    // Compute a tier based on reputation score
    let tier: string;
    if (p.reputation_score >= 2000) tier = "diamond";
    else if (p.reputation_score >= 1500) tier = "gold";
    else if (p.reputation_score >= 1000) tier = "silver";
    else if (p.reputation_score >= 500) tier = "bronze";
    else tier = "unranked";

    res.json({
      profile: {
        wallet: p.wallet,
        pubkey: p.pubkey,
        marketsCreated: p.markets_created,
        marketsResolved: p.markets_resolved,
        marketsVoided: p.markets_voided,
        totalVolumeGenerated: p.total_volume_generated,
        totalFeesEarned: p.total_fees_earned,
        reputationScore: p.reputation_score,
        resolutionRate,
        voidRate,
        tier,
        memberSince: p.created_at,
        lastActive: p.updated_at,
      },
    });
  } catch (err) {
    console.error("[creators] Profile error:", err);
    res.status(500).json({ error: "Failed to fetch creator profile" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/creator/:wallet/markets
// ---------------------------------------------------------------------------

router.get("/:wallet/markets", async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;

    if (!isValidWallet(wallet)) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }

    const { status, limit, offset } = req.query;

    const conditions: string[] = ["creator = $1"];
    const params: unknown[] = [wallet];
    let paramIndex = 2;

    if (status && typeof status === "string") {
      const validStatuses = ["open", "resolved", "voided"];
      if (validStatuses.includes(status.toLowerCase())) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status.toLowerCase());
      }
    }

    const limitVal = Math.min(Math.max(1, Number(limit) || 50), 100);
    const offsetVal = Math.max(0, Number(offset) || 0);

    const whereClause = conditions.join(" AND ");

    const markets = await query<CreatorMarketRow>(
      `SELECT market_id, pubkey, question, yes_reserve, no_reserve,
              resolution_timestamp, status, outcome, created_at
       FROM markets
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limitVal, offsetVal]
    );

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM markets WHERE ${whereClause}`,
      params
    );
    const total = Number(countResult[0]?.count || 0);

    res.json({
      wallet,
      markets: markets.map((m) => ({
        marketId: m.market_id,
        pubkey: m.pubkey,
        question: m.question,
        yesReserve: m.yes_reserve,
        noReserve: m.no_reserve,
        totalVolume: String(BigInt(m.yes_reserve) + BigInt(m.no_reserve)),
        resolutionTimestamp: Number(m.resolution_timestamp),
        status: m.status,
        outcome: m.outcome,
        createdAt: m.created_at,
      })),
      pagination: {
        total,
        limit: limitVal,
        offset: offsetVal,
        hasMore: offsetVal + limitVal < total,
      },
    });
  } catch (err) {
    console.error("[creators] Markets error:", err);
    res.status(500).json({ error: "Failed to fetch creator markets" });
  }
});

export default router;
