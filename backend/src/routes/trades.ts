/**
 * Trades API routes
 *
 * POST /api/trades              - Record a trade
 * GET  /api/trades/:marketId    - Get trade history for a market
 * GET  /api/trades/user/:wallet - Get trade history for a user
 */

import { Router, Request, Response } from "express";
import { query } from "../db/pool";

const router = Router();

// POST /api/trades — record a new trade
router.post("/", async (req: Request, res: Response) => {
  try {
    const { marketId, userWallet, side, action, solAmount, shares, priceAfter, txSig } = req.body;

    if (marketId === undefined || !userWallet || side === undefined || !action) {
      res.status(400).json({ error: "marketId, userWallet, side, and action are required" });
      return;
    }

    if (!["buy", "sell"].includes(action)) {
      res.status(400).json({ error: "action must be 'buy' or 'sell'" });
      return;
    }

    await query(
      `INSERT INTO trades (market_id, user_wallet, side, action, sol_amount, shares, price_after, tx_sig)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        Number(marketId),
        userWallet,
        side,
        action,
        Math.floor(Number(solAmount) || 0),
        Math.floor(Number(shares) || 0),
        Number(priceAfter) || 0.5,
        txSig || null,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[trades] Record error:", err);
    res.status(500).json({ error: "Failed to record trade" });
  }
});

// GET /api/trades/:marketId — trade history for a market (for price chart)
router.get("/:marketId", async (req: Request, res: Response) => {
  try {
    const marketId = Number(req.params.marketId);
    if (isNaN(marketId)) {
      res.status(400).json({ error: "Invalid marketId" });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 200, 500);

    const trades = await query(
      `SELECT id, user_wallet, side, action, sol_amount, shares, price_after, tx_sig, created_at
       FROM trades
       WHERE market_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [marketId, limit]
    );

    res.json({
      marketId,
      trades: trades.map((t: any) => ({
        id: t.id,
        user: t.user_wallet,
        side: t.side,
        action: t.action,
        sol_amount: Number(t.sol_amount),
        shares: Number(t.shares),
        price_after: t.price_after,
        tx_sig: t.tx_sig,
        timestamp: t.created_at,
      })),
    });
  } catch (err) {
    console.error("[trades] Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

// GET /api/trades/user/:wallet — trade history for a user
router.get("/user/:wallet", async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const trades = await query(
      `SELECT t.id, t.market_id, t.side, t.action, t.sol_amount, t.shares, t.price_after, t.tx_sig, t.created_at,
              m.question
       FROM trades t
       JOIN markets m ON m.market_id = t.market_id
       WHERE t.user_wallet = $1
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [wallet, limit]
    );

    res.json({
      wallet,
      trades: trades.map((t: any) => ({
        id: t.id,
        market_id: t.market_id,
        question: t.question,
        side: t.side,
        action: t.action,
        sol_amount: Number(t.sol_amount),
        shares: Number(t.shares),
        price_after: t.price_after,
        tx_sig: t.tx_sig,
        timestamp: t.created_at,
      })),
    });
  } catch (err) {
    console.error("[trades] User fetch error:", err);
    res.status(500).json({ error: "Failed to fetch user trades" });
  }
});

export default router;
