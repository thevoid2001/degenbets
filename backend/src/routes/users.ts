/**
 * User API routes
 *
 * GET /api/user/:wallet/positions - All positions for a wallet
 * GET /api/user/:wallet/stats     - Aggregated user stats
 *
 * @author anon
 */

import { Router, Request, Response } from "express";
import { query } from "../db/pool";

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PositionWithMarket {
  [key: string]: unknown;
  position_pubkey: string;
  market_id: number;
  market_pubkey: string;
  question: string;
  market_status: string;
  outcome: boolean | null;
  yes_amount: string;
  no_amount: string;
  claimed: boolean;
  position_created_at: string;
  resolution_timestamp: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidWallet(wallet: string): boolean {
  // Solana pubkeys are base58 encoded, 32-44 chars
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
}

// ---------------------------------------------------------------------------
// GET /api/user/:wallet/positions
// ---------------------------------------------------------------------------

router.get("/:wallet/positions", async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;

    if (!isValidWallet(wallet)) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }

    const { status } = req.query;

    let statusFilter = "";
    const params: unknown[] = [wallet];

    if (status && typeof status === "string") {
      const validStatuses = ["open", "resolved", "voided"];
      if (validStatuses.includes(status.toLowerCase())) {
        statusFilter = "AND m.status = $2";
        params.push(status.toLowerCase());
      }
    }

    const positions = await query<PositionWithMarket>(
      `SELECT
         p.pubkey AS position_pubkey,
         p.market_id,
         m.pubkey AS market_pubkey,
         m.question,
         m.status AS market_status,
         m.outcome,
         p.yes_amount,
         p.no_amount,
         p.claimed,
         p.created_at AS position_created_at,
         m.resolution_timestamp
       FROM positions p
       JOIN markets m ON p.market_id = m.market_id
       WHERE p.user_wallet = $1 ${statusFilter}
       ORDER BY p.created_at DESC
       LIMIT 200`,
      params
    );

    // Calculate unrealized PnL for open positions
    const formatted = positions.map((p) => {
      const yesAmt = BigInt(p.yes_amount);
      const noAmt = BigInt(p.no_amount);
      const totalStake = yesAmt + noAmt;

      let pnl: string | null = null;
      let result: string | null = null;

      if (p.market_status === "resolved" && p.outcome !== null) {
        // Winner gets proportional share of losing pool
        const winningSide = p.outcome ? yesAmt : noAmt;
        const losingSide = p.outcome ? noAmt : yesAmt;
        if (winningSide > 0n) {
          result = "win";
          // Simplified PnL: they risked totalStake, kept their winning side
          pnl = String(winningSide); // actual payout depends on pool ratios
        } else if (losingSide > 0n) {
          result = "loss";
          pnl = String(-losingSide);
        }
      } else if (p.market_status === "voided") {
        result = "refunded";
        pnl = "0";
      }

      return {
        position_pubkey: p.position_pubkey,
        market_id: p.market_id,
        market_pubkey: p.market_pubkey,
        question: p.question,
        status: p.market_status,
        outcome: p.outcome,
        won: p.market_status === "resolved" && p.outcome !== null
          ? (p.outcome ? yesAmt > 0n : noAmt > 0n)
          : undefined,
        yes_amount: Number(p.yes_amount),
        no_amount: Number(p.no_amount),
        total_stake: String(totalStake),
        claimed: p.claimed,
        result,
        pnl,
        created_at: p.position_created_at,
        resolution_timestamp: Number(p.resolution_timestamp),
      };
    });

    // Summary stats
    const openCount = formatted.filter((p) => p.status === "open").length;
    const resolvedCount = formatted.filter((p) => p.status === "resolved").length;

    res.json({
      wallet,
      positions: formatted,
      summary: {
        total: formatted.length,
        open: openCount,
        resolved: resolvedCount,
      },
    });
  } catch (err) {
    console.error("[users] Positions error:", err);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/:wallet/stats
// ---------------------------------------------------------------------------

router.get("/:wallet/stats", async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;

    if (!isValidWallet(wallet)) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }

    // Compute stats from positions + markets (user_stats table is not populated by sync)
    const rows = await query<{
      [key: string]: unknown;
      yes_amount: string;
      no_amount: string;
      market_status: string;
      outcome: boolean | null;
    }>(
      `SELECT p.yes_amount, p.no_amount, m.status AS market_status, m.outcome
       FROM positions p
       JOIN markets m ON p.market_id = m.market_id
       WHERE p.user_wallet = $1`,
      [wallet]
    );

    let totalWagered = 0n;
    let totalWon = 0n;
    let totalLost = 0n;
    let marketsParticipated = 0;
    let marketsWon = 0;

    for (const r of rows) {
      const yes = BigInt(r.yes_amount);
      const no = BigInt(r.no_amount);
      totalWagered += yes + no;
      marketsParticipated++;

      if (r.market_status === "resolved" && r.outcome !== null) {
        const won = r.outcome ? yes > 0n : no > 0n;
        if (won) {
          marketsWon++;
          totalWon += yes + no;
        } else {
          totalLost += yes + no;
        }
      }
    }

    res.json({
      wallet,
      stats: {
        total_wagered: Number(totalWagered),
        total_won: Number(totalWon),
        total_lost: Number(totalLost),
        markets_participated: marketsParticipated,
        markets_won: marketsWon,
      },
    });
  } catch (err) {
    console.error("[users] Stats error:", err);
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

export default router;
