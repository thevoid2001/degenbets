/**
 * Initialize the DegenBets program config on devnet.
 * Sets creation fee in SOL based on current SOL/USD price (~$20).
 * Run: npx ts-node scripts/init-devnet.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Degenbets } from "../target/types/degenbets";

const TARGET_FEE_USD = 20;
const TREASURY_RAKE_BPS = 500; // 5%
const CREATOR_RAKE_BPS = 150; // 1.5%
const MIN_BET_LAMPORTS = 10_000_000; // 0.01 SOL
const BETTING_CUTOFF_SECONDS = 3600; // 1 hour before resolution
const CHALLENGE_PERIOD_SECONDS = 86400; // 24 hours after resolution
const EXIT_FEE_BPS = 100; // 1% exit fee on sell

async function getSolPrice(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
  );
  const data = await res.json();
  return data.solana?.usd || 200; // fallback $200
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.degenbets as Program<Degenbets>;
  const authority = provider.wallet.publicKey;

  console.log("Program ID:", program.programId.toBase58());
  console.log("Authority:", authority.toBase58());

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("Config PDA:", configPda.toBase58());

  // Check if already initialized
  try {
    const configAccount = await program.account.config.fetch(configPda);
    console.log("\nConfig already initialized!");
    console.log("  Authority:", configAccount.authority.toBase58());
    console.log("  Treasury:", configAccount.treasury.toBase58());
    console.log("  Creation Fee:", configAccount.creationFeeLamports.toString(), "lamports",
      `(${(Number(configAccount.creationFeeLamports) / 1e9).toFixed(4)} SOL)`);
    console.log("  Treasury Rake BPS:", configAccount.treasuryRakeBps);
    console.log("  Creator Rake BPS:", configAccount.creatorRakeBps);
    console.log("  Market Count:", configAccount.marketCount.toString());
    return;
  } catch {
    console.log("\nConfig not yet initialized. Initializing...");
  }

  // Calculate initial fee based on current SOL price
  const solPrice = await getSolPrice();
  const feeLamports = Math.round((TARGET_FEE_USD / solPrice) * 1e9);

  console.log(`SOL/USD: $${solPrice}`);
  console.log(`Creation fee: ${feeLamports} lamports (${(feeLamports / 1e9).toFixed(4)} SOL ≈ $${TARGET_FEE_USD})`);

  const tx = await program.methods
    .initialize(
      authority, // treasury = authority for devnet testing
      new BN(feeLamports),
      TREASURY_RAKE_BPS,
      CREATOR_RAKE_BPS,
      new BN(MIN_BET_LAMPORTS),
      new BN(BETTING_CUTOFF_SECONDS),
      new BN(CHALLENGE_PERIOD_SECONDS),
      EXIT_FEE_BPS,
    )
    .rpc();

  console.log("\nInitialize tx:", tx);
  console.log("Config initialized successfully!");
  console.log("\n--- Summary ---");
  console.log("Program ID:", program.programId.toBase58());
  console.log("Config PDA:", configPda.toBase58());
  console.log("Authority/Treasury:", authority.toBase58());
  console.log(`Creation Fee: ${(feeLamports / 1e9).toFixed(4)} SOL (~$${TARGET_FEE_USD})`);
  console.log("Treasury Rake: 5%");
  console.log("Creator Rake: 1.5%");
  console.log(`Min Bet: ${(MIN_BET_LAMPORTS / 1e9)} SOL`);
  console.log(`Betting Cutoff: ${BETTING_CUTOFF_SECONDS}s (${BETTING_CUTOFF_SECONDS / 3600}h before resolution)`);
  console.log(`Challenge Period: ${CHALLENGE_PERIOD_SECONDS}s (${CHALLENGE_PERIOD_SECONDS / 3600}h after resolution)`);
  console.log(`Exit Fee: ${EXIT_FEE_BPS / 100}%`);
}

main().catch(console.error);
