/**
 * Markets API routes
 *
 * GET  /api/markets              - List markets (filterable by status)
 * GET  /api/markets/:id          - Get single market
 * GET  /api/markets/:id/positions - Get all positions on a market
 *
 * @author anon
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { query } from "../db/pool";
import { commentOnMarketCreated } from "../agent/dealer";

const router = Router();

// ---------------------------------------------------------------------------
// Image upload config
// ---------------------------------------------------------------------------

const uploadsDir = path.join(__dirname, "../../public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `market-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
    }
  },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketRow {
  [key: string]: unknown;
  id: number;
  market_id: number;
  pubkey: string;
  creator: string;
  question: string;
  resolution_source: string;
  yes_reserve: string;
  no_reserve: string;
  total_minted: string;
  initial_liquidity: string;
  swap_fee_bps: number;
  resolution_timestamp: string;
  status: string;
  outcome: boolean | null;
  creator_fee_claimed: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface PositionRow {
  [key: string]: unknown;
  id: number;
  market_id: number;
  pubkey: string;
  user_wallet: string;
  yes_shares: string;
  no_shares: string;
  claimed: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// POST /api/markets  — sync a newly created on-chain market into the DB
// ---------------------------------------------------------------------------

router.post("/", async (req: Request, res: Response) => {
  try {
    const { pubkey, marketId, creator, question, resolutionSource, resolutionTimestamp, category } = req.body;

    if (!pubkey || marketId === undefined || !creator || !question || !resolutionSource || !resolutionTimestamp) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const validCategories = ["sports", "crypto", "politics", "entertainment", "misc"];
    const marketCategory = validCategories.includes(category) ? category : "misc";

    // On-chain verification: confirm the account exists and is owned by our program
    const programId = process.env.PROGRAM_ID;
    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (programId && rpcUrl) {
      try {
        const { Connection, PublicKey } = await import("@solana/web3.js");
        const connection = new Connection(rpcUrl, "confirmed");
        const accountInfo = await connection.getAccountInfo(new PublicKey(pubkey));
        if (!accountInfo) {
          res.status(400).json({ error: "Market account does not exist on-chain" });
          return;
        }
        if (accountInfo.owner.toBase58() !== programId) {
          res.status(400).json({ error: "Market account is not owned by the program" });
          return;
        }
      } catch (verifyErr) {
        console.warn("[markets] On-chain verification failed, proceeding anyway:", verifyErr);
        // Don't block market creation if RPC is temporarily down
      }
    }

    // Upsert — ignore if already exists (idempotent)
    const result = await query(
      `INSERT INTO markets (market_id, pubkey, creator, question, resolution_source, resolution_timestamp, status, category)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
       ON CONFLICT (pubkey) DO NOTHING
       RETURNING *`,
      [marketId, pubkey, creator, question, resolutionSource, resolutionTimestamp, marketCategory]
    );

    if (result.length === 0) {
      // Already existed
      const existing = await query<MarketRow>(
        "SELECT *, (yes_reserve + no_reserve) AS total_volume FROM markets WHERE pubkey = $1",
        [pubkey]
      );
      res.json({ market: formatMarket(existing[0]), created: false });
      return;
    }

    // Trigger dealer commentary in background
    commentOnMarketCreated(question, pubkey as string).catch(() => {});

    res.status(201).json({ market: formatMarket(result[0] as MarketRow & { total_volume?: string }), created: true });
  } catch (err) {
    console.error("[markets] Create/sync error:", err);
    res.status(500).json({ error: "Failed to sync market" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/markets
// ---------------------------------------------------------------------------

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, creator, category: catFilter, sort, order, limit, offset } = req.query;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Filter by status
    if (status && typeof status === "string") {
      const validStatuses = ["open", "resolved", "voided"];
      if (validStatuses.includes(status.toLowerCase())) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status.toLowerCase());
      }
    }

    // Filter by category
    if (catFilter && typeof catFilter === "string") {
      const validCats = ["sports", "crypto", "politics", "entertainment", "misc"];
      if (validCats.includes(catFilter.toLowerCase())) {
        conditions.push(`category = $${paramIndex++}`);
        params.push(catFilter.toLowerCase());
      }
    }

    // Filter by creator
    if (creator && typeof creator === "string") {
      conditions.push(`creator = $${paramIndex++}`);
      params.push(creator);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Sorting
    const validSorts: Record<string, string> = {
      created: "created_at",
      resolution: "resolution_timestamp",
      volume: "(yes_reserve + no_reserve)",
      market_id: "market_id",
    };
    const sortCol =
      validSorts[String(sort || "created")] || "created_at";
    const sortDir =
      String(order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    // Pagination
    const limitVal = Math.min(Math.max(1, Number(limit) || 50), 100);
    const offsetVal = Math.max(0, Number(offset) || 0);

    const sql = `
      SELECT *, (yes_reserve + no_reserve) AS total_volume
      FROM markets
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limitVal, offsetVal);

    const markets = await query<MarketRow & { total_volume: string }>(sql, params);

    // Get total count for pagination
    const countSql = `SELECT COUNT(*) as count FROM markets ${whereClause}`;
    const countResult = await query<{ count: string }>(
      countSql,
      params.slice(0, conditions.length)
    );
    const total = Number(countResult[0]?.count || 0);

    res.json({
      markets: markets.map(formatMarket),
      pagination: {
        total,
        limit: limitVal,
        offset: offsetVal,
        hasMore: offsetVal + limitVal < total,
      },
    });
  } catch (err) {
    console.error("[markets] List error:", err);
    res.status(500).json({ error: "Failed to fetch markets" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/markets/:id
// ---------------------------------------------------------------------------

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Support both numeric market_id and pubkey string
    const isNumeric = /^\d+$/.test(id);
    const sql = isNumeric
      ? "SELECT *, (yes_reserve + no_reserve) AS total_volume FROM markets WHERE market_id = $1"
      : "SELECT *, (yes_reserve + no_reserve) AS total_volume FROM markets WHERE pubkey = $1";

    const markets = await query<MarketRow & { total_volume: string }>(sql, [
      isNumeric ? Number(id) : id,
    ]);

    if (markets.length === 0) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    // Also fetch position count and resolution logs
    const market = markets[0];
    const [posCount, resLogs] = await Promise.all([
      query<{ count: string }>(
        "SELECT COUNT(*) as count FROM positions WHERE market_id = $1",
        [market.market_id]
      ),
      query(
        "SELECT ai_decision, confidence, ai_reasoning, attempted_at FROM resolution_logs WHERE market_id = $1 ORDER BY attempted_at DESC LIMIT 5",
        [market.market_id]
      ),
    ]);

    res.json({
      market: {
        ...formatMarket(market),
        positionCount: Number(posCount[0]?.count || 0),
        resolutionHistory: resLogs,
      },
    });
  } catch (err) {
    console.error("[markets] Get error:", err);
    res.status(500).json({ error: "Failed to fetch market" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/markets/:id/positions
// ---------------------------------------------------------------------------

router.get("/:id/positions", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const isNumeric = /^\d+$/.test(id);

    // Look up market_id (support both numeric ID and pubkey)
    const marketCheck = await query<{ market_id: number }>(
      isNumeric
        ? "SELECT market_id FROM markets WHERE market_id = $1"
        : "SELECT market_id FROM markets WHERE pubkey = $1",
      [isNumeric ? Number(id) : id]
    );
    if (marketCheck.length === 0) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    const marketId = marketCheck[0].market_id;

    const positions = await query<PositionRow>(
      `SELECT * FROM positions
       WHERE market_id = $1
       ORDER BY (yes_shares + no_shares) DESC
       LIMIT 100`,
      [marketId]
    );

    res.json({
      marketId,
      positions: positions.map((p) => ({
        pubkey: p.pubkey,
        user_wallet: p.user_wallet,
        yes_shares: Number(p.yes_shares),
        no_shares: Number(p.no_shares),
        total_shares: String(BigInt(p.yes_shares) + BigInt(p.no_shares)),
        claimed: p.claimed,
        created_at: p.created_at,
      })),
    });
  } catch (err) {
    console.error("[markets] Positions error:", err);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/markets/upload-image
// ---------------------------------------------------------------------------

router.post("/upload-image", upload.single("image"), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (err) {
    console.error("[markets] Upload error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/markets/:pubkey/image
// ---------------------------------------------------------------------------

router.put("/:pubkey/image", async (req: Request, res: Response) => {
  try {
    const pubkey = req.params.pubkey as string;
    const { imageUrl } = req.body;

    if (!imageUrl || typeof imageUrl !== "string") {
      res.status(400).json({ error: "imageUrl is required" });
      return;
    }

    const result = await query(
      "UPDATE markets SET image_url = $1 WHERE pubkey = $2 RETURNING pubkey",
      [imageUrl, pubkey]
    );

    if (result.length === 0) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    res.json({ success: true, pubkey, imageUrl });
  } catch (err) {
    console.error("[markets] Image association error:", err);
    res.status(500).json({ error: "Failed to associate image" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/markets/:id
// ---------------------------------------------------------------------------

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const isNumeric = /^\d+$/.test(id);
    const sql = isNumeric
      ? "DELETE FROM markets WHERE market_id = $1 RETURNING pubkey, market_id"
      : "DELETE FROM markets WHERE pubkey = $1 RETURNING pubkey, market_id";

    const result = await query(sql, [isNumeric ? Number(id) : id]);

    if (result.length === 0) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    res.json({ deleted: true, market_id: (result[0] as any).market_id, pubkey: (result[0] as any).pubkey });
  } catch (err) {
    console.error("[markets] Delete error:", err);
    res.status(500).json({ error: "Failed to delete market" });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMarket(m: MarketRow & { total_volume?: string }) {
  const yesReserve = BigInt(m.yes_reserve || 0);
  const noReserve = BigInt(m.no_reserve || 0);
  const totalReserve = yesReserve + noReserve;

  return {
    market_id: m.market_id,
    pubkey: m.pubkey,
    creator: m.creator,
    question: m.question,
    resolution_source: m.resolution_source,
    yes_reserve: Number(m.yes_reserve),
    no_reserve: Number(m.no_reserve),
    total_minted: Number(m.total_minted || 0),
    initial_liquidity: Number(m.initial_liquidity || 0),
    swap_fee_bps: m.swap_fee_bps || 30,
    total_volume: Number(totalReserve),
    yes_price:
      totalReserve > 0n
        ? Number((noReserve * 10000n) / totalReserve) / 10000
        : 0.5,
    no_price:
      totalReserve > 0n
        ? Number((yesReserve * 10000n) / totalReserve) / 10000
        : 0.5,
    resolution_timestamp: Number(m.resolution_timestamp),
    status: m.status,
    outcome: m.outcome,
    creator_fee_claimed: m.creator_fee_claimed,
    image_url: m.image_url || null,
    category: (m as any).category || "misc",
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
}

export default router;
