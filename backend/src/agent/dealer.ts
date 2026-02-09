/**
 * AI Dealer - Generates degen commentary for market events.
 *
 * The "dealer" is the personality layer of DegenBets. It produces
 * colorful, memetic commentary when markets are created, bets are placed,
 * markets resolve, etc.
 *
 * @author anon
 */

import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DealerEvent =
  | "market_created"
  | "big_bet"
  | "market_resolved"
  | "market_voided"
  | "whale_alert"
  | "streak"
  | "leaderboard_change";

export interface DealerContext {
  event: DealerEvent;
  question?: string;
  side?: "YES" | "NO";
  amount?: number;       // in SOL/USDC (human-readable)
  outcome?: "YES" | "NO" | "VOID";
  wallet?: string;       // truncated for display
  streak?: number;
  rank?: number;
  extraContext?: string;
}

export interface DealerResponse {
  commentary: string;
  emoji: string;
  hypeLevel: number; // 1-10
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const DEALER_SYSTEM_PROMPT = `You are the AI Dealer for DegenBets, an on-chain prediction market on Solana. You speak like a degenerate crypto trader mixed with a Vegas pit boss. Your commentary should be:

- Short and punchy (1-2 sentences max)
- Memetic and crypto-native (use terms like "ape", "degen", "wagmi", "ngmi", "rekt", "chad", "ser", "anon", "fren", etc.)
- Hype-generating but not financial advice
- Occasionally roast bad bets or celebrate huge wins
- Reference the specific market question and amounts when provided
- Never use slurs or genuinely offensive content
- Never give actual financial advice

Respond ONLY with valid JSON:
{"commentary": "your commentary here", "emoji": "single relevant emoji", "hypeLevel": 1-10}`;

// ---------------------------------------------------------------------------
// Commentary generation
// ---------------------------------------------------------------------------

function buildPrompt(ctx: DealerContext): string {
  const parts: string[] = [`Event: ${ctx.event}`];

  if (ctx.question) parts.push(`Market: "${ctx.question}"`);
  if (ctx.side) parts.push(`Side: ${ctx.side}`);
  if (ctx.amount !== undefined) parts.push(`Amount: ${ctx.amount}`);
  if (ctx.outcome) parts.push(`Outcome: ${ctx.outcome}`);
  if (ctx.wallet) parts.push(`Wallet: ${ctx.wallet}`);
  if (ctx.streak) parts.push(`Streak: ${ctx.streak}`);
  if (ctx.rank) parts.push(`Leaderboard rank: #${ctx.rank}`);
  if (ctx.extraContext) parts.push(`Context: ${ctx.extraContext}`);

  return parts.join("\n") + "\n\nGenerate dealer commentary for this event. JSON only.";
}

/**
 * Generate AI dealer commentary for a market event.
 */
export async function generateCommentary(
  ctx: DealerContext
): Promise<DealerResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Fallback when no API key is configured
  if (!apiKey) {
    return getFallbackCommentary(ctx);
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: process.env.AI_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 256,
      system: DEALER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(ctx) }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getFallbackCommentary(ctx);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      commentary: String(parsed.commentary || "No comment, ser."),
      emoji: String(parsed.emoji || ""),
      hypeLevel: Math.min(10, Math.max(1, Number(parsed.hypeLevel) || 5)),
    };
  } catch (err) {
    console.error(
      "[dealer] AI commentary generation failed:",
      err instanceof Error ? err.message : err
    );
    return getFallbackCommentary(ctx);
  }
}

// ---------------------------------------------------------------------------
// Fallback commentary (no API key needed)
// ---------------------------------------------------------------------------

const FALLBACK_LINES: Record<DealerEvent, string[]> = {
  market_created: [
    "New market just dropped. Degens, assemble.",
    "Fresh market on the table. Who's aping first?",
    "The house has a new game. Step right up, anon.",
    "Another market, another chance to get rekt or get rich.",
  ],
  big_bet: [
    "Whale alert! Someone just went full degen.",
    "Absolute chad bet right there. Respect.",
    "Big money hitting the table. This market is heating up.",
    "Now THAT's a position size. No fear.",
  ],
  market_resolved: [
    "Market resolved. Winners collect, losers cope.",
    "The oracle has spoken. Check your PnL, anon.",
    "And that's a wrap. GG to all who played.",
    "Resolution complete. Some of you are eating tonight.",
  ],
  market_voided: [
    "Market voided. Everyone gets their bags back.",
    "Void it. The house calls no contest.",
    "This one's a push. Refunds incoming.",
    "Market cancelled. Touch grass and try again.",
  ],
  whale_alert: [
    "Whale spotted! Thar she blows!",
    "Massive position incoming. The pool trembles.",
    "Someone's wallet is heavier than my bags.",
  ],
  streak: [
    "Hot streak! This anon is on fire.",
    "Win after win. Is this anon from the future?",
    "The streak continues. Absolutely disgusting.",
  ],
  leaderboard_change: [
    "New name on the leaderboard. Shake-up at the top.",
    "The leaderboard shifts. Competition is fierce.",
    "Climbing the ranks. The grind never stops.",
  ],
};

function getFallbackCommentary(ctx: DealerContext): DealerResponse {
  const lines = FALLBACK_LINES[ctx.event] || FALLBACK_LINES.market_created;
  const commentary = lines[Math.floor(Math.random() * lines.length)];

  const emojiMap: Record<DealerEvent, string> = {
    market_created: "🎰",
    big_bet: "🐋",
    market_resolved: "⚖️",
    market_voided: "🚫",
    whale_alert: "🐳",
    streak: "🔥",
    leaderboard_change: "📊",
  };

  return {
    commentary,
    emoji: emojiMap[ctx.event] || "🎲",
    hypeLevel: ctx.event === "big_bet" || ctx.event === "whale_alert" ? 8 : 5,
  };
}

/**
 * Generate commentary for a market creation event.
 */
export async function commentOnMarketCreated(
  question: string,
  creator: string
): Promise<DealerResponse> {
  return generateCommentary({
    event: "market_created",
    question,
    wallet: creator.slice(0, 6) + "..." + creator.slice(-4),
  });
}

/**
 * Generate commentary for a large bet.
 */
export async function commentOnBigBet(
  question: string,
  side: "YES" | "NO",
  amount: number,
  wallet: string
): Promise<DealerResponse> {
  return generateCommentary({
    event: "big_bet",
    question,
    side,
    amount,
    wallet: wallet.slice(0, 6) + "..." + wallet.slice(-4),
  });
}

/**
 * Generate commentary for market resolution.
 */
export async function commentOnResolution(
  question: string,
  outcome: "YES" | "NO" | "VOID"
): Promise<DealerResponse> {
  return generateCommentary({
    event: outcome === "VOID" ? "market_voided" : "market_resolved",
    question,
    outcome,
  });
}
