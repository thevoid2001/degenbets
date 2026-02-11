/**
 * Sync route — reads on-chain market & position data and upserts to DB.
 * Called by the frontend after every successful transaction (bet, sell).
 *
 * POST /api/sync  { marketId: number, userWallet: string }
 */

import { Router, Request, Response } from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import { query } from "../db/pool";

const router = Router();

const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || "5rCyhouLLq4RdFcsPmQDJkx531kptp3JPhhnoenVvq4L"
);
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

function getMarketPda(marketId: number): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(marketId));
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), buf],
    PROGRAM_ID
  );
  return pda;
}

function getPositionPda(market: PublicKey, user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Parse Market account data to extract AMM state.
 * Layout after 8-byte discriminator:
 *   32 bytes: creator
 *   4 + N bytes: question (Borsh string)
 *   4 + M bytes: resolution_source (Borsh string)
 *   8 bytes: yes_reserve
 *   8 bytes: no_reserve
 *   8 bytes: total_minted
 *   8 bytes: initial_liquidity
 *   2 bytes: swap_fee_bps
 */
function parseMarketState(data: Buffer): {
  yesReserve: bigint;
  noReserve: bigint;
  totalMinted: bigint;
  initialLiquidity: bigint;
  swapFeeBps: number;
} {
  let offset = 8; // skip discriminator
  offset += 32; // skip creator

  // Skip question string
  const qLen = data.readUInt32LE(offset);
  offset += 4 + qLen;

  // Skip resolution_source string
  const sLen = data.readUInt32LE(offset);
  offset += 4 + sLen;

  const yesReserve = data.readBigUInt64LE(offset);
  offset += 8;
  const noReserve = data.readBigUInt64LE(offset);
  offset += 8;
  const totalMinted = data.readBigUInt64LE(offset);
  offset += 8;
  const initialLiquidity = data.readBigUInt64LE(offset);
  offset += 8;
  const swapFeeBps = data.readUInt16LE(offset);

  return { yesReserve, noReserve, totalMinted, initialLiquidity, swapFeeBps };
}

/**
 * Parse Position account data.
 * Layout after 8-byte discriminator:
 *   32 bytes: market pubkey
 *   32 bytes: user pubkey
 *   8 bytes: yes_shares
 *   8 bytes: no_shares
 *   1 byte: claimed
 */
function parsePosition(data: Buffer): {
  yesShares: bigint;
  noShares: bigint;
  claimed: boolean;
} {
  const yesShares = data.readBigUInt64LE(72);
  const noShares = data.readBigUInt64LE(80);
  const claimed = data[88] === 1;
  return { yesShares, noShares, claimed };
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { marketId, userWallet } = req.body;

    if (marketId === undefined || !userWallet) {
      res.status(400).json({ error: "marketId and userWallet are required" });
      return;
    }

    const mId = Number(marketId);
    if (isNaN(mId)) {
      res.status(400).json({ error: "Invalid marketId" });
      return;
    }

    const marketPda = getMarketPda(mId);
    const userPubkey = new PublicKey(userWallet);
    const positionPda = getPositionPda(marketPda, userPubkey);

    // Fetch both accounts in parallel
    const [marketInfo, positionInfo] = await Promise.all([
      connection.getAccountInfo(marketPda),
      connection.getAccountInfo(positionPda),
    ]);

    // Update market AMM state
    if (marketInfo && marketInfo.data.length > 60) {
      const { yesReserve, noReserve, totalMinted, initialLiquidity, swapFeeBps } = parseMarketState(marketInfo.data);
      await query(
        `UPDATE markets SET yes_reserve = $1, no_reserve = $2, total_minted = $3,
         initial_liquidity = $4, swap_fee_bps = $5, updated_at = NOW()
         WHERE market_id = $6`,
        [yesReserve.toString(), noReserve.toString(), totalMinted.toString(),
         initialLiquidity.toString(), swapFeeBps, mId]
      );
    }

    // Upsert position
    if (positionInfo && positionInfo.data.length >= 89) {
      const { yesShares, noShares, claimed } = parsePosition(positionInfo.data);
      await query(
        `INSERT INTO positions (market_id, pubkey, user_wallet, yes_shares, no_shares, claimed)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (pubkey) DO UPDATE SET
           yes_shares = EXCLUDED.yes_shares,
           no_shares = EXCLUDED.no_shares,
           claimed = EXCLUDED.claimed,
           updated_at = NOW()`,
        [
          mId,
          positionPda.toBase58(),
          userWallet,
          yesShares.toString(),
          noShares.toString(),
          claimed,
        ]
      );

      // Update cost basis if provided (positive = buy, negative = sell)
      const costBasisDelta = Number(req.body.costBasisDelta || 0);
      if (costBasisDelta !== 0) {
        await query(
          `UPDATE positions SET cost_basis = GREATEST(0, cost_basis + $1) WHERE pubkey = $2`,
          [costBasisDelta, positionPda.toBase58()]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[sync] Error:", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

// GET /api/sync/position?marketId=X&wallet=Y — fetch position with cost_basis
router.get("/position", async (req: Request, res: Response) => {
  try {
    const { marketId, wallet } = req.query;
    if (!marketId || !wallet) {
      res.status(400).json({ error: "marketId and wallet are required" });
      return;
    }
    const rows = await query(
      `SELECT yes_shares, no_shares, claimed, cost_basis FROM positions WHERE market_id = $1 AND user_wallet = $2`,
      [Number(marketId), wallet]
    );
    if (rows.length === 0) {
      res.json({ position: null });
      return;
    }
    const p = rows[0] as any;
    res.json({
      position: {
        yes_shares: Number(p.yes_shares),
        no_shares: Number(p.no_shares),
        claimed: p.claimed,
        cost_basis: Number(p.cost_basis),
      },
    });
  } catch (err) {
    console.error("[sync] Position fetch error:", err);
    res.status(500).json({ error: "Failed to fetch position" });
  }
});

export default router;
