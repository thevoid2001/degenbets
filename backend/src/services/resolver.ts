/**
 * AI Resolution Service
 *
 * Fetches the resolution source URL for a market, extracts relevant text,
 * then calls AI to determine whether the market resolves YES, NO, or VOID.
 *
 * @author anon
 */

import Anthropic from "@anthropic-ai/sdk";
import { query, getClient } from "../db/pool";
import https from "https";
import http from "http";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolutionResult {
  decision: "yes" | "no" | "void" | "error";
  confidence: number;
  reasoning: string;
}

interface MarketRow {
  [key: string]: unknown;
  market_id: number;
  pubkey: string;
  question: string;
  resolution_source: string;
  resolution_timestamp: number;
  status: string;
}

// ---------------------------------------------------------------------------
// Source text fetching
// ---------------------------------------------------------------------------

/**
 * Fetch the text content from a URL. Returns truncated plain text.
 */
async function fetchSourceText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const request = client.get(url, { timeout: 15_000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect
        fetchSourceText(res.headers.location).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }

      let data = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => {
        data += chunk;
        // Cap at ~200KB of raw text
        if (data.length > 200_000) {
          res.destroy();
        }
      });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    request.on("timeout", () => {
      request.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
    request.on("error", reject);
  });
}

/**
 * Naive HTML-to-text: strips tags and collapses whitespace.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50_000); // Cap context at ~50k chars for the AI
}

// ---------------------------------------------------------------------------
// AI Resolution
// ---------------------------------------------------------------------------

/**
 * Ask AI to resolve a prediction market question based on source text.
 */
async function askAI(
  question: string,
  sourceUrl: string,
  sourceText: string
): Promise<ResolutionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      decision: "error",
      confidence: 0,
      reasoning: "AI_API_KEY not configured",
    };
  }

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `You are the resolution oracle for a prediction market platform called DegenBets. Your job is to determine whether a prediction market question has resolved YES, NO, or should be VOIDED.

Rules:
1. Analyze the provided source text carefully.
2. Only resolve YES or NO if the source text provides clear, definitive evidence.
3. If the source text is ambiguous, unavailable, or the event hasn't clearly occurred/not occurred, resolve VOID.
4. Be conservative - when in doubt, VOID.
5. Provide a confidence score from 0.0 to 1.0.

Respond ONLY with valid JSON in this exact format:
{"decision": "yes" | "no" | "void", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

  const userPrompt = `Market Question: ${question}

Resolution Source URL: ${sourceUrl}

Extracted Source Text (may be truncated):
---
${sourceText.slice(0, 30_000)}
---

Based on the source text above, has the market question resolved YES, NO, or should it be VOIDED? Respond with JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: process.env.AI_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        decision: "error",
        confidence: 0,
        reasoning: `Failed to parse AI response: ${text.slice(0, 200)}`,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const decision = ["yes", "no", "void"].includes(parsed.decision)
      ? (parsed.decision as "yes" | "no" | "void")
      : "error";

    return {
      decision,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      reasoning: String(parsed.reasoning || ""),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      decision: "error",
      confidence: 0,
      reasoning: `AI API error: ${message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Main resolution flow
// ---------------------------------------------------------------------------

/**
 * Attempt to resolve a single market by its market_id.
 */
export async function resolveMarket(marketId: number): Promise<ResolutionResult> {
  // 1. Fetch market from DB
  const rows = await query<MarketRow>(
    "SELECT market_id, pubkey, question, resolution_source, resolution_timestamp, status FROM markets WHERE market_id = $1",
    [marketId]
  );

  if (rows.length === 0) {
    return { decision: "error", confidence: 0, reasoning: "Market not found" };
  }

  const market = rows[0];

  if (market.status !== "open") {
    return {
      decision: "error",
      confidence: 0,
      reasoning: `Market already ${market.status}`,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now < market.resolution_timestamp) {
    return {
      decision: "error",
      confidence: 0,
      reasoning: `Market resolution time not reached (${market.resolution_timestamp - now}s remaining)`,
    };
  }

  // 2. Fetch and parse source
  let sourceText = "";
  try {
    const rawHtml = await fetchSourceText(market.resolution_source);
    sourceText = htmlToText(rawHtml);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sourceText = `[FETCH ERROR: ${message}]`;
  }

  // 3. Ask AI
  const result = await askAI(
    market.question,
    market.resolution_source,
    sourceText
  );

  // 4. Log the resolution attempt
  await query(
    `INSERT INTO resolution_logs
       (market_id, source_url, source_text, ai_reasoning, ai_decision, confidence, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      marketId,
      market.resolution_source,
      sourceText.slice(0, 10_000), // truncate for storage
      result.reasoning,
      result.decision,
      result.confidence,
      result.decision === "error" ? result.reasoning : null,
    ]
  );

  return result;
}

/**
 * Scan for all markets past their resolution timestamp that are still open,
 * and attempt to resolve each one.
 */
export async function resolveReadyMarkets(): Promise<{
  attempted: number;
  resolved: number;
  voided: number;
  errors: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const stats = { attempted: 0, resolved: 0, voided: 0, errors: 0 };

  const markets = await query<MarketRow>(
    "SELECT market_id FROM markets WHERE status = $1 AND resolution_timestamp <= $2 ORDER BY resolution_timestamp ASC LIMIT 20",
    ["open", now]
  );

  console.log(`[resolver] Found ${markets.length} markets ready for resolution`);

  for (const market of markets) {
    stats.attempted++;
    try {
      const result = await resolveMarket(market.market_id);

      if (result.decision === "yes" || result.decision === "no") {
        // Submit on-chain resolution first, then update DB
        const txSig = await submitOnChainResolution(market.market_id, result.decision === "yes");
        if (txSig) {
          await query(
            "UPDATE markets SET status = $1, outcome = $2, ai_reasoning = $3 WHERE market_id = $4",
            ["resolved", result.decision === "yes", result.reasoning, market.market_id]
          );
          await query(
            "UPDATE resolution_logs SET tx_signature = $1 WHERE market_id = $2 AND tx_signature IS NULL ORDER BY attempted_at DESC LIMIT 1",
            [txSig, market.market_id]
          );
          stats.resolved++;
          console.log(
            `[resolver] Market ${market.market_id} resolved ${result.decision.toUpperCase()} (tx: ${txSig})`
          );
        } else {
          stats.errors++;
          console.error(`[resolver] Market ${market.market_id} on-chain resolution failed`);
        }
      } else if (result.decision === "void") {
        const txSig = await submitOnChainVoid(market.market_id, result.reasoning);
        if (txSig) {
          await query(
            "UPDATE markets SET status = $1, ai_reasoning = $2 WHERE market_id = $3",
            ["voided", result.reasoning, market.market_id]
          );
          stats.voided++;
          console.log(
            `[resolver] Market ${market.market_id} VOIDED on-chain (tx: ${txSig})`
          );
        } else {
          stats.errors++;
          console.error(`[resolver] Market ${market.market_id} on-chain void failed`);
        }
      } else {
        stats.errors++;
        console.error(
          `[resolver] Market ${market.market_id} error: ${result.reasoning}`
        );
      }
    } catch (err) {
      stats.errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[resolver] Unexpected error resolving market ${market.market_id}: ${message}`
      );
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// On-chain resolution submission
// ---------------------------------------------------------------------------

/**
 * Submit a resolve_market transaction on-chain.
 * Builds raw Anchor instruction using the same pattern as feeUpdater.ts.
 */
async function submitOnChainResolution(
  marketId: number,
  outcome: boolean
): Promise<string | null> {
  try {
    const {
      Connection,
      Keypair,
      PublicKey,
      Transaction,
      TransactionInstruction,
    } = await import("@solana/web3.js");

    const rpcUrl = process.env.SOLANA_RPC_URL;
    const authorityKey = process.env.AUTHORITY_PRIVATE_KEY;
    const programId = process.env.PROGRAM_ID;

    if (!rpcUrl || !authorityKey || !programId) {
      console.warn("[resolver] Missing Solana env vars, skipping on-chain resolution");
      return null;
    }

    const connection = new Connection(rpcUrl, "confirmed");
    const bs58 = require("bs58");
    const secretBytes = bs58.decode(authorityKey);
    const authority = Keypair.fromSecretKey(secretBytes);
    const programPubkey = new PublicKey(programId);

    // Derive PDAs
    const marketIdBuf = Buffer.alloc(8);
    marketIdBuf.writeBigUInt64LE(BigInt(marketId));
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), marketIdBuf],
      programPubkey
    );
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      programPubkey
    );

    // Fetch market account to get creator pubkey for creator_profile PDA
    const marketInfo = await connection.getAccountInfo(marketPda);
    if (!marketInfo) {
      console.error(`[resolver] Market PDA not found on-chain: ${marketPda.toBase58()}`);
      return null;
    }
    // Creator pubkey is at offset 8 (after 8-byte discriminator), 32 bytes
    const creatorPubkey = new PublicKey(marketInfo.data.subarray(8, 40));
    const [creatorProfilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator"), creatorPubkey.toBuffer()],
      programPubkey
    );

    // Build resolve_market instruction
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update("global:resolve_market").digest();
    const discriminator = hash.subarray(0, 8);
    const outcomeBuf = Buffer.from([outcome ? 1 : 0]);
    const instructionData = Buffer.concat([discriminator, outcomeBuf]);

    const ix = new TransactionInstruction({
      programId: programPubkey,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: creatorProfilePda, isSigner: false, isWritable: true },
      ],
      data: instructionData,
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(authority);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    console.log(`[resolver] On-chain resolve_market tx: ${sig}`);
    return sig;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resolver] On-chain resolution failed: ${message}`);
    return null;
  }
}

/**
 * Submit a void_market transaction on-chain.
 */
async function submitOnChainVoid(
  marketId: number,
  reason: string
): Promise<string | null> {
  try {
    const {
      Connection,
      Keypair,
      PublicKey,
      Transaction,
      TransactionInstruction,
    } = await import("@solana/web3.js");

    const rpcUrl = process.env.SOLANA_RPC_URL;
    const authorityKey = process.env.AUTHORITY_PRIVATE_KEY;
    const programId = process.env.PROGRAM_ID;

    if (!rpcUrl || !authorityKey || !programId) {
      console.warn("[resolver] Missing Solana env vars, skipping on-chain void");
      return null;
    }

    const connection = new Connection(rpcUrl, "confirmed");
    const bs58 = require("bs58");
    const secretBytes = bs58.decode(authorityKey);
    const authority = Keypair.fromSecretKey(secretBytes);
    const programPubkey = new PublicKey(programId);

    // Derive PDAs
    const marketIdBuf = Buffer.alloc(8);
    marketIdBuf.writeBigUInt64LE(BigInt(marketId));
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), marketIdBuf],
      programPubkey
    );
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      programPubkey
    );

    // Fetch market creator for creator_profile PDA
    const marketInfo = await connection.getAccountInfo(marketPda);
    if (!marketInfo) {
      console.error(`[resolver] Market PDA not found on-chain: ${marketPda.toBase58()}`);
      return null;
    }
    const creatorPubkey = new PublicKey(marketInfo.data.subarray(8, 40));
    const [creatorProfilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator"), creatorPubkey.toBuffer()],
      programPubkey
    );

    // Build void_market instruction
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update("global:void_market").digest();
    const discriminator = hash.subarray(0, 8);

    // Encode reason as Anchor string: 4-byte LE length + UTF-8 bytes
    const reasonBytes = Buffer.from(reason.slice(0, 200), "utf-8");
    const reasonLenBuf = Buffer.alloc(4);
    reasonLenBuf.writeUInt32LE(reasonBytes.length);
    const instructionData = Buffer.concat([discriminator, reasonLenBuf, reasonBytes]);

    const ix = new TransactionInstruction({
      programId: programPubkey,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: creatorProfilePda, isSigner: false, isWritable: true },
      ],
      data: instructionData,
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(authority);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    console.log(`[resolver] On-chain void_market tx: ${sig}`);
    return sig;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resolver] On-chain void failed: ${message}`);
    return null;
  }
}
