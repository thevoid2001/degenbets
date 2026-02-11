/**
 * Batch create markets on devnet.
 * Run: npx ts-node scripts/create-markets.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as bs58 from "bs58";

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("CwN2DiAqGTCXXVUCbRTCpD925Aq7e5VTRsLESrXr7SuL");
const AUTHORITY_KEY = process.env.AUTHORITY_PRIVATE_KEY || "";
const API_URL = "http://localhost:3001";

// NBA games Feb 9, 2026 - resolution ~30 min after expected game end
const MARKETS = [
  {
    question: "Will the Detroit Pistons beat the Charlotte Hornets on Feb 9?",
    source: "https://www.espn.com/nba/scoreboard/_/date/20260209",
    // Game 7 PM ET, resolve at 10:30 PM ET
    timestamp: Math.floor(new Date("2026-02-10T03:30:00Z").getTime() / 1000),
  },
  {
    question: "Will the Chicago Bulls beat the Brooklyn Nets on Feb 9?",
    source: "https://www.nba.com/games?date=2026-02-09",
    // Game 7:30 PM ET, resolve at 10:30 PM ET
    timestamp: Math.floor(new Date("2026-02-10T03:30:00Z").getTime() / 1000),
  },
  {
    question: "Will the Milwaukee Bucks beat the Orlando Magic on Feb 9?",
    source: "https://www.espn.com/nba/scoreboard/_/date/20260209",
    // Game 7:30 PM ET, resolve at 10:30 PM ET
    timestamp: Math.floor(new Date("2026-02-10T03:30:00Z").getTime() / 1000),
  },
  {
    question: "Will the Utah Jazz beat the Miami Heat on Feb 9?",
    source: "https://www.nba.com/games?date=2026-02-09",
    // Game 7:30 PM ET, resolve at 10:30 PM ET
    timestamp: Math.floor(new Date("2026-02-10T03:30:00Z").getTime() / 1000),
  },
  {
    question: "Will the Atlanta Hawks beat the Minnesota Timberwolves on Feb 9?",
    source: "https://www.espn.com/nba/scoreboard/_/date/20260209",
    // Game 8 PM ET, resolve at 11 PM ET
    timestamp: Math.floor(new Date("2026-02-10T04:00:00Z").getTime() / 1000),
  },
  {
    question: "Will USA win gold in Mixed Doubles Curling at the 2026 Winter Olympics?",
    source: "https://www.olympics.com/en/milano-cortina-2026/schedule/09-feb",
    // Olympics event, resolve end of day
    timestamp: Math.floor(new Date("2026-02-10T05:00:00Z").getTime() / 1000),
  },
];

function getConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
}

function getMarketPda(marketId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(marketId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), buf],
    PROGRAM_ID
  );
}

function getCreatorProfilePda(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator"), wallet.toBuffer()],
    PROGRAM_ID
  );
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const authority = Keypair.fromSecretKey(bs58.decode(AUTHORITY_KEY));

  console.log("Authority:", authority.publicKey.toBase58());
  const balance = await connection.getBalance(authority.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  const [configPda] = getConfigPda();
  const [creatorProfilePda] = getCreatorProfilePda(authority.publicKey);

  // Read config to get treasury and market_count
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) throw new Error("Config not initialized");

  const treasury = new PublicKey(configInfo.data.subarray(40, 72));
  let marketCount = Number(configInfo.data.readBigUInt64LE(84));

  console.log("Treasury:", treasury.toBase58());
  console.log("Starting market_count:", marketCount);
  console.log(`\nCreating ${MARKETS.length} markets...\n`);

  const discriminator = Buffer.from([103, 226, 97, 235, 200, 188, 251, 254]);

  for (const market of MARKETS) {
    const [marketPda] = getMarketPda(marketCount);
    console.log(`Market #${marketCount}: ${market.question}`);
    console.log(`  PDA: ${marketPda.toBase58()}`);

    // Build instruction data
    const questionBytes = Buffer.from(market.question, "utf-8");
    const questionLen = Buffer.alloc(4);
    questionLen.writeUInt32LE(questionBytes.length);

    const sourceBytes = Buffer.from(market.source, "utf-8");
    const sourceLen = Buffer.alloc(4);
    sourceLen.writeUInt32LE(sourceBytes.length);

    const timestampBuf = Buffer.alloc(8);
    timestampBuf.writeBigInt64LE(BigInt(market.timestamp));

    const data = Buffer.concat([
      discriminator,
      questionLen,
      questionBytes,
      sourceLen,
      sourceBytes,
      timestampBuf,
    ]);

    const ix = {
      programId: PROGRAM_ID,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: creatorProfilePda, isSigner: false, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    };

    const tx = new Transaction().add(ix);
    try {
      const sig = await sendAndConfirmTransaction(connection, tx, [authority]);
      console.log(`  TX: ${sig}`);

      // Sync to backend DB
      const syncRes = await fetch(`${API_URL}/api/markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubkey: marketPda.toBase58(),
          marketId: marketCount,
          creator: authority.publicKey.toBase58(),
          question: market.question,
          resolutionSource: market.source,
          resolutionTimestamp: market.timestamp,
        }),
      });
      const syncData = await syncRes.json();
      console.log(`  Synced to DB: ${syncRes.ok ? "OK" : JSON.stringify(syncData)}`);

      marketCount++;

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (err: any) {
      console.error(`  ERROR: ${err.message}`);
      // Re-read market count in case it incremented despite error
      const newConfig = await connection.getAccountInfo(configPda);
      if (newConfig) {
        marketCount = Number(newConfig.data.readBigUInt64LE(84));
      }
    }
  }

  const finalBalance = await connection.getBalance(authority.publicKey);
  console.log(`\nDone! Final balance: ${finalBalance / 1e9} SOL`);
}

main().catch(console.error);
