import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Degenbets } from "../target/types/degenbets";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.degenbets as Program<Degenbets>;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const before = await program.account.config.fetch(configPda);
  console.log("Before:");
  console.log("  Min Liquidity:", before.minLiquidityLamports.toString(), "lamports");
  console.log("  Treasury Rake BPS:", before.treasuryRakeBps);
  console.log("  Creator Rake BPS:", before.creatorRakeBps);
  console.log("  Swap Fee BPS:", before.swapFeeBps);

  const tx = await program.methods
    .updateConfig(
      null,                       // treasury
      new BN(1_000_000_000),      // min_liquidity_lamports: 1 SOL
      null,                       // treasury_rake_bps: keep 2%
      100,                        // creator_rake_bps: 1%
      null,                       // min_trade_lamports
      null,                       // betting_cutoff_seconds
      null,                       // challenge_period_seconds
      50,                         // swap_fee_bps: 0.5%
    )
    .rpc();

  console.log("\nUpdate tx:", tx);

  const after = await program.account.config.fetch(configPda);
  console.log("\nAfter:");
  console.log("  Min Liquidity:", after.minLiquidityLamports.toString(), "lamports", `(${Number(after.minLiquidityLamports) / 1e9} SOL)`);
  console.log("  Treasury Rake BPS:", after.treasuryRakeBps, `(${after.treasuryRakeBps / 100}%)`);
  console.log("  Creator Rake BPS:", after.creatorRakeBps, `(${after.creatorRakeBps / 100}%)`);
  console.log("  Swap Fee BPS:", after.swapFeeBps, `(${after.swapFeeBps / 100}%)`);
}

main().catch(console.error);
