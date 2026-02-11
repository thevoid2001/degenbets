/**
 * Initialize the DegenBets AMM program config on devnet.
 * Run: npx ts-node scripts/init-devnet.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Degenbets } from "../target/types/degenbets";

const MIN_LIQUIDITY_LAMPORTS = 10_000_000;   // 0.01 SOL min liquidity per market
const TREASURY_RAKE_BPS = 500;               // 5%
const CREATOR_RAKE_BPS = 150;                // 1.5%
const MIN_TRADE_LAMPORTS = 10_000_000;       // 0.01 SOL min trade
const BETTING_CUTOFF_SECONDS = 3600;         // 1 hour before resolution
const CHALLENGE_PERIOD_SECONDS = 86400;      // 24 hours after resolution
const SWAP_FEE_BPS = 30;                     // 0.3% swap fee

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
    console.log("  Min Liquidity:", configAccount.minLiquidityLamports.toString(), "lamports");
    console.log("  Treasury Rake BPS:", configAccount.treasuryRakeBps);
    console.log("  Creator Rake BPS:", configAccount.creatorRakeBps);
    console.log("  Min Trade:", configAccount.minTradeLamports.toString(), "lamports");
    console.log("  Swap Fee BPS:", configAccount.swapFeeBps);
    console.log("  Market Count:", configAccount.marketCount.toString());
    return;
  } catch {
    console.log("\nConfig not yet initialized. Initializing...");
  }

  const tx = await program.methods
    .initialize(
      authority, // treasury = authority for devnet testing
      new BN(MIN_LIQUIDITY_LAMPORTS),
      TREASURY_RAKE_BPS,
      CREATOR_RAKE_BPS,
      new BN(MIN_TRADE_LAMPORTS),
      new BN(BETTING_CUTOFF_SECONDS),
      new BN(CHALLENGE_PERIOD_SECONDS),
      SWAP_FEE_BPS,
    )
    .rpc();

  console.log("\nInitialize tx:", tx);
  console.log("Config initialized successfully!");
  console.log("\n--- Summary ---");
  console.log("Program ID:", program.programId.toBase58());
  console.log("Config PDA:", configPda.toBase58());
  console.log("Authority/Treasury:", authority.toBase58());
  console.log(`Min Liquidity: ${(MIN_LIQUIDITY_LAMPORTS / 1e9)} SOL`);
  console.log("Treasury Rake: 5%");
  console.log("Creator Rake: 1.5%");
  console.log(`Min Trade: ${(MIN_TRADE_LAMPORTS / 1e9)} SOL`);
  console.log(`Swap Fee: ${SWAP_FEE_BPS / 100}%`);
  console.log(`Betting Cutoff: ${BETTING_CUTOFF_SECONDS}s (${BETTING_CUTOFF_SECONDS / 3600}h before resolution)`);
  console.log(`Challenge Period: ${CHALLENGE_PERIOD_SECONDS}s (${CHALLENGE_PERIOD_SECONDS / 3600}h after resolution)`);
}

main().catch(console.error);
