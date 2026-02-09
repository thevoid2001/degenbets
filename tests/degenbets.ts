/**
 * DegenBets Solana Program - Comprehensive Test Suite
 *
 * Author: anon
 * License: UNLICENSED
 *
 * Covers:
 *   1. Initialize config (treasury, USDC mint, fees)
 *   2. Create market (USDC creation fee, question, resolution source, timestamp)
 *   3. Place bets (YES / NO sides, multiple users, additive positions)
 *   4. Resolve market (authority sets outcome, treasury fee transfer)
 *   5. Claim winnings (proportional split of 93.5% pot)
 *   6. Claim creator fee (1.5% of pot)
 *   7. Void market + claim refund (full refund)
 *   8. Error cases (bet on closed market, claim before resolution, double claim,
 *      non-authority resolve / void)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount as createTokenAccount,
  mintTo,
  getAccount as getTokenAccountInfo,
} from "@solana/spl-token";
import { expect } from "chai";
import { Degenbets } from "../target/types/degenbets";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USDC_DECIMALS = 6;
const ONE_USDC = 1_000_000;
const CREATION_FEE = 20 * ONE_USDC; // 20 USDC
const TREASURY_RAKE_BPS = 500; // 5.0 %
const CREATOR_RAKE_BPS = 150; // 1.5 %
const TOTAL_RAKE_BPS = TREASURY_RAKE_BPS + CREATOR_RAKE_BPS; // 6.5 %

// ---------------------------------------------------------------------------
// PDA Helpers
// ---------------------------------------------------------------------------

function findConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
}

function findMarketPda(
  marketId: BN,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), marketId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

function findPositionPda(
  market: PublicKey,
  user: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), user.toBuffer()],
    programId
  );
}

function findCreatorProfilePda(
  creator: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator"), creator.toBuffer()],
    programId
  );
}

// ---------------------------------------------------------------------------
// Utility Helpers
// ---------------------------------------------------------------------------

/** Airdrop SOL and confirm the transaction. */
async function airdrop(
  connection: anchor.web3.Connection,
  to: PublicKey,
  lamports: number
): Promise<void> {
  const sig = await connection.requestAirdrop(to, lamports);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature: sig,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });
}

/** Return a unix timestamp N seconds in the future (from wall-clock now). */
function futureTs(seconds: number): BN {
  return new BN(Math.floor(Date.now() / 1000) + seconds);
}

/**
 * Warp the local-validator clock forward to the given unix timestamp.
 *
 * Uses the `setClockOverride` debug RPC available on test validators, or
 * falls back to `warpToSlot`. Both require the `--ticks-per-slot` to be
 * generous. As a last resort, brute-force slot advancement via airdrops.
 */
async function warpClock(
  connection: anchor.web3.Connection,
  targetTimestamp: number
): Promise<void> {
  const currentSlot = await connection.getSlot();
  const currentBlockTime = await connection.getBlockTime(currentSlot);
  if (currentBlockTime && currentBlockTime >= targetTimestamp) {
    return;
  }

  const delta = targetTimestamp - (currentBlockTime || Math.floor(Date.now() / 1000));
  const slotsToSkip = Math.ceil(delta / 0.4);
  const targetSlot = currentSlot + slotsToSkip;

  const rpcEndpoint: string = (connection as any)._rpcEndpoint;

  // Strategy 1: Try clock offset via setClockOverride (Agave 2.x+)
  try {
    const res = await fetch(rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "setClockOverride",
        params: [{ unixTimestamp: targetTimestamp }],
      }),
    });
    const json: any = await res.json();
    if (json && !json.error) {
      await sleep(1500);
      return;
    }
  } catch {
    // Not available; fall through.
  }

  // Strategy 2: Try warpToSlot
  try {
    const res = await fetch(rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "warpToSlot",
        params: [targetSlot],
      }),
    });
    const json: any = await res.json();
    if (json && !json.error) {
      await sleep(1500);
      return;
    }
  } catch {
    // Not available; fall through.
  }

  // Strategy 3: Brute-force slot advancement via repeated confirmTx.
  const dummy = Keypair.generate();
  const maxIterations = Math.min(slotsToSkip, 5000);
  for (let i = 0; i < maxIterations; i++) {
    try {
      const sig = await connection.requestAirdrop(dummy.publicKey, 1000);
      await connection.confirmTransaction(sig);
    } catch {
      // Ignore rate limits.
    }
    if (i % 50 === 0) {
      const slot = await connection.getSlot();
      const bt = await connection.getBlockTime(slot);
      if (bt && bt >= targetTimestamp) {
        return;
      }
    }
  }

  // Strategy 4: Just wait it out.
  const remaining = targetTimestamp - Math.floor(Date.now() / 1000);
  if (remaining > 0 && remaining < 120) {
    console.log(`  [warp] Waiting ${remaining}s for clock to catch up...`);
    await sleep(remaining * 1000 + 2000);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("degenbets", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Degenbets as Program<Degenbets>;
  const connection = provider.connection;

  // The provider wallet acts as the protocol authority.
  const authority = provider.wallet as anchor.Wallet;

  // Distinct test wallets.
  const treasuryWallet = Keypair.generate();
  const marketCreator = Keypair.generate();
  const userA = Keypair.generate();
  const userB = Keypair.generate();
  const randomUser = Keypair.generate();

  // Token state (initialised in `before`).
  let usdcMint: PublicKey;
  let treasuryUsdc: PublicKey;
  let creatorUsdc: PublicKey;

  // Global PDA.
  let configPda: PublicKey;

  // ---------------------------------------------------------------------------
  // Global setup: fund wallets, create mock USDC mint and token accounts.
  // ---------------------------------------------------------------------------
  before(async () => {
    [configPda] = findConfigPda(program.programId);

    // Fund wallets.
    await Promise.all([
      airdrop(connection, treasuryWallet.publicKey, 10 * LAMPORTS_PER_SOL),
      airdrop(connection, marketCreator.publicKey, 10 * LAMPORTS_PER_SOL),
      airdrop(connection, userA.publicKey, 10 * LAMPORTS_PER_SOL),
      airdrop(connection, userB.publicKey, 10 * LAMPORTS_PER_SOL),
      airdrop(connection, randomUser.publicKey, 10 * LAMPORTS_PER_SOL),
    ]);

    // Create a mock USDC SPL-Token mint.
    usdcMint = await createMint(
      connection,
      authority.payer,
      authority.publicKey,
      null,
      USDC_DECIMALS
    );

    // Token accounts.
    treasuryUsdc = await createTokenAccount(
      connection,
      authority.payer,
      usdcMint,
      treasuryWallet.publicKey
    );
    creatorUsdc = await createTokenAccount(
      connection,
      authority.payer,
      usdcMint,
      marketCreator.publicKey
    );

    // Mint 1 000 USDC to the market creator.
    await mintTo(
      connection,
      authority.payer,
      usdcMint,
      creatorUsdc,
      authority.publicKey,
      1_000 * ONE_USDC
    );
  });

  // =========================================================================
  // 1. Initialize Config
  // =========================================================================
  describe("initialize", () => {
    it("creates the global config with correct parameters", async () => {
      await program.methods
        .initialize(
          treasuryWallet.publicKey,
          usdcMint,
          new BN(CREATION_FEE),
          TREASURY_RAKE_BPS,
          CREATOR_RAKE_BPS
        )
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const cfg = await program.account.config.fetch(configPda);

      expect(cfg.authority.toBase58()).to.equal(authority.publicKey.toBase58());
      expect(cfg.treasury.toBase58()).to.equal(treasuryWallet.publicKey.toBase58());
      expect(cfg.usdcMint.toBase58()).to.equal(usdcMint.toBase58());
      expect(cfg.creationFeeUsdc.toNumber()).to.equal(CREATION_FEE);
      expect(cfg.treasuryRakeBps).to.equal(TREASURY_RAKE_BPS);
      expect(cfg.creatorRakeBps).to.equal(CREATOR_RAKE_BPS);
      expect(cfg.marketCount.toNumber()).to.equal(0);
    });

    it("rejects re-initialisation (PDA already exists)", async () => {
      try {
        await program.methods
          .initialize(
            treasuryWallet.publicKey,
            usdcMint,
            new BN(CREATION_FEE),
            TREASURY_RAKE_BPS,
            CREATOR_RAKE_BPS
          )
          .accounts({
            authority: authority.publicKey,
            config: configPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        // The `init` constraint fails because the account already exists.
        expect(err).to.exist;
      }
    });
  });

  // =========================================================================
  // 2. Create Market
  // =========================================================================
  describe("create_market", () => {
    const question = "Will SOL exceed $500 by end of Q2?";
    const source = "https://example.com/oracle/sol-price";

    it("creates market #0 and charges the USDC creation fee", async () => {
      const marketId = new BN(0);
      const [marketPda] = findMarketPda(marketId, program.programId);
      const [profilePda] = findCreatorProfilePda(
        marketCreator.publicKey,
        program.programId
      );
      const resTs = futureTs(7200);

      const treasBefore = await getTokenAccountInfo(connection, treasuryUsdc);

      await program.methods
        .createMarket(question, source, resTs)
        .accounts({
          creator: marketCreator.publicKey,
          config: configPda,
          market: marketPda,
          creatorProfile: profilePda,
          creatorUsdc,
          treasuryUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      // -- Market state --
      const mkt = await program.account.market.fetch(marketPda);
      expect(mkt.creator.toBase58()).to.equal(marketCreator.publicKey.toBase58());
      expect(mkt.question).to.equal(question);
      expect(mkt.resolutionSource).to.equal(source);
      expect(mkt.yesPool.toNumber()).to.equal(0);
      expect(mkt.noPool.toNumber()).to.equal(0);
      expect(mkt.resolutionTimestamp.toNumber()).to.equal(resTs.toNumber());
      expect(mkt.status).to.deep.equal({ open: {} });
      expect(mkt.outcome).to.be.null;
      expect(mkt.creatorFeeClaimed).to.equal(false);
      expect(mkt.marketId.toNumber()).to.equal(0);

      // -- Config counter --
      const cfg = await program.account.config.fetch(configPda);
      expect(cfg.marketCount.toNumber()).to.equal(1);

      // -- USDC fee transferred --
      const treasAfter = await getTokenAccountInfo(connection, treasuryUsdc);
      expect(Number(treasAfter.amount) - Number(treasBefore.amount)).to.equal(
        CREATION_FEE
      );

      // -- Creator profile bootstrapped --
      const prof = await program.account.creatorProfile.fetch(profilePda);
      expect(prof.wallet.toBase58()).to.equal(marketCreator.publicKey.toBase58());
      expect(prof.marketsCreated).to.equal(1);
      expect(prof.reputationScore).to.equal(100);
    });

    it("rejects an invalid resolution source (not a URL)", async () => {
      const [marketPda] = findMarketPda(new BN(1), program.programId);
      const [profilePda] = findCreatorProfilePda(
        marketCreator.publicKey,
        program.programId
      );

      try {
        await program.methods
          .createMarket("Some question", "not-a-url", futureTs(7200))
          .accounts({
            creator: marketCreator.publicKey,
            config: configPda,
            market: marketPda,
            creatorProfile: profilePda,
            creatorUsdc,
            treasuryUsdc,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([marketCreator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("InvalidSourceUrl");
      }
    });

    it("rejects a resolution timestamp less than 60s in the future", async () => {
      const [marketPda] = findMarketPda(new BN(1), program.programId);
      const [profilePda] = findCreatorProfilePda(
        marketCreator.publicKey,
        program.programId
      );

      try {
        await program.methods
          .createMarket(question, source, futureTs(30)) // 30 sec (< 60s min)
          .accounts({
            creator: marketCreator.publicKey,
            config: configPda,
            market: marketPda,
            creatorProfile: profilePda,
            creatorUsdc,
            treasuryUsdc,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([marketCreator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("ResolutionTooSoon");
      }
    });
  });

  // =========================================================================
  // 3. Place Bets (YES / NO, multiple users, additive)
  // =========================================================================
  describe("place_bet", () => {
    const marketId = new BN(0);
    let marketPda: PublicKey;

    const BET_A = new BN(1 * LAMPORTS_PER_SOL);
    const BET_B = new BN(2 * LAMPORTS_PER_SOL);

    before(() => {
      [marketPda] = findMarketPda(marketId, program.programId);
    });

    it("userA places a YES bet (1 SOL)", async () => {
      const [posPda] = findPositionPda(marketPda, userA.publicKey, program.programId);

      await program.methods
        .placeBet(BET_A, true)
        .accounts({
          user: userA.publicKey,
          market: marketPda,
          position: posPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      const mkt = await program.account.market.fetch(marketPda);
      expect(mkt.yesPool.toNumber()).to.equal(BET_A.toNumber());
      expect(mkt.noPool.toNumber()).to.equal(0);

      const pos = await program.account.position.fetch(posPda);
      expect(pos.yesAmount.toNumber()).to.equal(BET_A.toNumber());
      expect(pos.noAmount.toNumber()).to.equal(0);
      expect(pos.claimed).to.equal(false);
      expect(pos.user.toBase58()).to.equal(userA.publicKey.toBase58());
      expect(pos.market.toBase58()).to.equal(marketPda.toBase58());
    });

    it("userB places a NO bet (2 SOL)", async () => {
      const [posPda] = findPositionPda(marketPda, userB.publicKey, program.programId);

      await program.methods
        .placeBet(BET_B, false)
        .accounts({
          user: userB.publicKey,
          market: marketPda,
          position: posPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([userB])
        .rpc();

      const mkt = await program.account.market.fetch(marketPda);
      expect(mkt.yesPool.toNumber()).to.equal(BET_A.toNumber());
      expect(mkt.noPool.toNumber()).to.equal(BET_B.toNumber());

      const pos = await program.account.position.fetch(posPda);
      expect(pos.noAmount.toNumber()).to.equal(BET_B.toNumber());
      expect(pos.yesAmount.toNumber()).to.equal(0);
    });

    it("userA adds another YES bet (0.5 SOL) - position is additive", async () => {
      const [posPda] = findPositionPda(marketPda, userA.publicKey, program.programId);
      const extra = new BN(0.5 * LAMPORTS_PER_SOL);

      await program.methods
        .placeBet(extra, true)
        .accounts({
          user: userA.publicKey,
          market: marketPda,
          position: posPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      const pos = await program.account.position.fetch(posPda);
      expect(pos.yesAmount.toNumber()).to.equal(BET_A.toNumber() + extra.toNumber());

      const mkt = await program.account.market.fetch(marketPda);
      expect(mkt.yesPool.toNumber()).to.equal(BET_A.toNumber() + extra.toNumber());
    });

    it("rejects a zero-amount bet", async () => {
      const [posPda] = findPositionPda(marketPda, userA.publicKey, program.programId);

      try {
        await program.methods
          .placeBet(new BN(0), true)
          .accounts({
            user: userA.publicKey,
            market: marketPda,
            position: posPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("ZeroBetAmount");
      }
    });
  });

  // =========================================================================
  // 4. Resolve Market (authority sets outcome, treasury fee transfer)
  // =========================================================================
  describe("resolve_market", () => {
    // We create market #1 with a short-ish resolution window, place bets,
    // then warp the validator clock forward so it can be resolved.
    const RESOLVE_MARKET_ID = new BN(1);
    let resolveMarketPda: PublicKey;
    let creatorProfilePda: PublicKey;

    const BET_YES = new BN(2 * LAMPORTS_PER_SOL);
    const BET_NO = new BN(1 * LAMPORTS_PER_SOL);

    before(async () => {
      [resolveMarketPda] = findMarketPda(RESOLVE_MARKET_ID, program.programId);
      [creatorProfilePda] = findCreatorProfilePda(
        marketCreator.publicKey,
        program.programId
      );

      // Create market #1 with resolution just barely valid (60s + 10s).
      const resTs = futureTs(70);

      await program.methods
        .createMarket(
          "Resolvable test market",
          "https://example.com/resolution-data",
          resTs
        )
        .accounts({
          creator: marketCreator.publicKey,
          config: configPda,
          market: resolveMarketPda,
          creatorProfile: creatorProfilePda,
          creatorUsdc,
          treasuryUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      // Place bets.
      const [posA] = findPositionPda(resolveMarketPda, userA.publicKey, program.programId);
      const [posB] = findPositionPda(resolveMarketPda, userB.publicKey, program.programId);

      await program.methods
        .placeBet(BET_YES, true)
        .accounts({
          user: userA.publicKey,
          market: resolveMarketPda,
          position: posA,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      await program.methods
        .placeBet(BET_NO, false)
        .accounts({
          user: userB.publicKey,
          market: resolveMarketPda,
          position: posB,
          systemProgram: SystemProgram.programId,
        })
        .signers([userB])
        .rpc();

      // Wait for the validator clock to pass the resolution timestamp.
      // The local validator tracks real time, so we sleep until resolution_timestamp is reached.
      const nowUnix = Math.floor(Date.now() / 1000);
      const waitSec = resTs.toNumber() - nowUnix + 2; // +2s buffer
      if (waitSec > 0) {
        console.log(`      [setup] Waiting ${waitSec}s for resolution timestamp...`);
        await sleep(waitSec * 1000);
      }
    });

    it("authority resolves with outcome = YES and treasury receives 5% fee", async () => {
      const treasBalBefore = await connection.getBalance(treasuryWallet.publicKey);

      await program.methods
        .resolveMarket(true)
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          market: resolveMarketPda,
          treasury: treasuryWallet.publicKey,
          creatorProfile: creatorProfilePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Market state.
      const mkt = await program.account.market.fetch(resolveMarketPda);
      expect(mkt.status).to.deep.equal({ resolved: {} });
      expect(mkt.outcome).to.equal(true);

      // Treasury fee = 5% of total pot (3 SOL) = 0.15 SOL.
      const totalPot = BET_YES.toNumber() + BET_NO.toNumber();
      const expectedFee = Math.floor((totalPot * TREASURY_RAKE_BPS) / 10000);

      const treasBalAfter = await connection.getBalance(treasuryWallet.publicKey);
      expect(treasBalAfter - treasBalBefore).to.equal(expectedFee);

      // Creator profile updated.
      const prof = await program.account.creatorProfile.fetch(creatorProfilePda);
      expect(prof.marketsResolved).to.equal(1);
      expect(prof.totalVolumeGenerated.toNumber()).to.equal(totalPot);
    });

    it("rejects resolution by a non-authority signer", async () => {
      // Create market #2 for this test.
      const id = new BN(2);
      const [mktPda] = findMarketPda(id, program.programId);

      await program.methods
        .createMarket(
          "Non-authority resolve test",
          "https://example.com/auth-test",
          futureTs(7200)
        )
        .accounts({
          creator: marketCreator.publicKey,
          config: configPda,
          market: mktPda,
          creatorProfile: creatorProfilePda,
          creatorUsdc,
          treasuryUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      try {
        await program.methods
          .resolveMarket(true)
          .accounts({
            authority: randomUser.publicKey,
            config: configPda,
            market: mktPda,
            treasury: treasuryWallet.publicKey,
            creatorProfile: creatorProfilePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([randomUser])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Anchor constraint violation: authority.key() != config.authority.
        expect(err).to.exist;
      }
    });

    it("rejects resolution before the resolution timestamp", async () => {
      // Create market #3 with a far-future resolution.
      const id = new BN(3);
      const [mktPda] = findMarketPda(id, program.programId);

      await program.methods
        .createMarket(
          "Far future market",
          "https://example.com/far-future",
          futureTs(999_999)
        )
        .accounts({
          creator: marketCreator.publicKey,
          config: configPda,
          market: mktPda,
          creatorProfile: creatorProfilePda,
          creatorUsdc,
          treasuryUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      try {
        await program.methods
          .resolveMarket(true)
          .accounts({
            authority: authority.publicKey,
            config: configPda,
            market: mktPda,
            treasury: treasuryWallet.publicKey,
            creatorProfile: creatorProfilePda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("MarketNotReady");
      }
    });
  });

  // =========================================================================
  // 5. Claim Winnings (93.5% of pot distributed to winners)
  // =========================================================================
  describe("claim_winnings", () => {
    // Market #1 was resolved with outcome = YES.
    // userA bet 2 SOL YES, userB bet 1 SOL NO.
    //   total_pot   = 3 SOL
    //   total_rake  = 6.5 % = 0.195 SOL
    //   prize_pool  = 2.805 SOL
    //   userA share = 100 % of prize_pool (sole YES bettor)
    const MARKET_ID = new BN(1);
    let marketPda: PublicKey;

    const TOTAL_POT = 3 * LAMPORTS_PER_SOL;
    const TOTAL_RAKE = Math.floor((TOTAL_POT * TOTAL_RAKE_BPS) / 10000);
    const PRIZE_POOL = TOTAL_POT - TOTAL_RAKE;

    before(() => {
      [marketPda] = findMarketPda(MARKET_ID, program.programId);
    });

    it("winner (userA) claims proportional share of the prize pool", async () => {
      const [posPda] = findPositionPda(marketPda, userA.publicKey, program.programId);
      const balBefore = await connection.getBalance(userA.publicKey);

      await program.methods
        .claimWinnings()
        .accounts({
          user: userA.publicKey,
          config: configPda,
          market: marketPda,
          position: posPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      const pos = await program.account.position.fetch(posPda);
      expect(pos.claimed).to.equal(true);

      // Balance should increase by ~PRIZE_POOL minus a small tx fee.
      const balAfter = await connection.getBalance(userA.publicKey);
      const gain = balAfter - balBefore;
      expect(gain).to.be.greaterThan(PRIZE_POOL - 0.01 * LAMPORTS_PER_SOL);
      expect(gain).to.be.lessThanOrEqual(PRIZE_POOL);
    });

    it("loser (userB) cannot claim winnings", async () => {
      const [posPda] = findPositionPda(marketPda, userB.publicKey, program.programId);

      try {
        await program.methods
          .claimWinnings()
          .accounts({
            user: userB.publicKey,
            config: configPda,
            market: marketPda,
            position: posPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([userB])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("NotAWinner");
      }
    });

    it("rejects a double claim by the winner", async () => {
      const [posPda] = findPositionPda(marketPda, userA.publicKey, program.programId);

      try {
        await program.methods
          .claimWinnings()
          .accounts({
            user: userA.publicKey,
            config: configPda,
            market: marketPda,
            position: posPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("AlreadyClaimed");
      }
    });

    it("rejects claiming on an unresolved (Open) market", async () => {
      // Market #0 is still Open.
      const [openPda] = findMarketPda(new BN(0), program.programId);
      const [posPda] = findPositionPda(openPda, userA.publicKey, program.programId);

      try {
        await program.methods
          .claimWinnings()
          .accounts({
            user: userA.publicKey,
            config: configPda,
            market: openPda,
            position: posPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("MarketNotResolved");
      }
    });
  });

  // =========================================================================
  // 6. Claim Creator Fee (1.5% of pot)
  // =========================================================================
  describe("claim_creator_fee", () => {
    const MARKET_ID = new BN(1);
    let marketPda: PublicKey;
    let creatorProfilePda: PublicKey;

    const TOTAL_POT = 3 * LAMPORTS_PER_SOL;
    const EXPECTED_FEE = Math.floor((TOTAL_POT * CREATOR_RAKE_BPS) / 10000);

    before(() => {
      [marketPda] = findMarketPda(MARKET_ID, program.programId);
      [creatorProfilePda] = findCreatorProfilePda(
        marketCreator.publicKey,
        program.programId
      );
    });

    it("market creator claims the 1.5% fee", async () => {
      const balBefore = await connection.getBalance(marketCreator.publicKey);

      await program.methods
        .claimCreatorFee()
        .accounts({
          creator: marketCreator.publicKey,
          config: configPda,
          market: marketPda,
          creatorProfile: creatorProfilePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      const balAfter = await connection.getBalance(marketCreator.publicKey);
      const gain = balAfter - balBefore;
      // gain = EXPECTED_FEE - tx_fee.  Allow 0.01 SOL tolerance for tx fee.
      expect(gain).to.be.greaterThan(EXPECTED_FEE - 0.01 * LAMPORTS_PER_SOL);

      const mkt = await program.account.market.fetch(marketPda);
      expect(mkt.creatorFeeClaimed).to.equal(true);

      const prof = await program.account.creatorProfile.fetch(creatorProfilePda);
      expect(prof.totalFeesEarned.toNumber()).to.equal(EXPECTED_FEE);
    });

    it("rejects a double creator-fee claim", async () => {
      try {
        await program.methods
          .claimCreatorFee()
          .accounts({
            creator: marketCreator.publicKey,
            config: configPda,
            market: marketPda,
            creatorProfile: creatorProfilePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([marketCreator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("CreatorFeeAlreadyClaimed");
      }
    });

    it("rejects creator-fee claim by a non-creator", async () => {
      const [fakeProfPda] = findCreatorProfilePda(
        randomUser.publicKey,
        program.programId
      );

      try {
        await program.methods
          .claimCreatorFee()
          .accounts({
            creator: randomUser.publicKey,
            config: configPda,
            market: marketPda,
            creatorProfile: fakeProfPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([randomUser])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Constraint: market.creator == creator.key().
        expect(err).to.exist;
      }
    });
  });

  // =========================================================================
  // 7. Void Market + Claim Refund
  // =========================================================================
  describe("void_market and claim_refund", () => {
    // Market #2 was created in the resolve-market tests and is still Open.
    const VOID_MARKET_ID = new BN(2);
    let voidMarketPda: PublicKey;
    let creatorProfilePda: PublicKey;

    const BET_AMOUNT = new BN(0.5 * LAMPORTS_PER_SOL);

    before(async () => {
      [voidMarketPda] = findMarketPda(VOID_MARKET_ID, program.programId);
      [creatorProfilePda] = findCreatorProfilePda(
        marketCreator.publicKey,
        program.programId
      );

      // Place a bet so we can test refunds.
      const [posPda] = findPositionPda(
        voidMarketPda,
        userA.publicKey,
        program.programId
      );

      await program.methods
        .placeBet(BET_AMOUNT, true)
        .accounts({
          user: userA.publicKey,
          market: voidMarketPda,
          position: posPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();
    });

    it("authority voids the market", async () => {
      await program.methods
        .voidMarket("Oracle data source became unavailable")
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          market: voidMarketPda,
          creatorProfile: creatorProfilePda,
        })
        .rpc();

      const mkt = await program.account.market.fetch(voidMarketPda);
      expect(mkt.status).to.deep.equal({ voided: {} });

      // Reputation decreased by 10 (100 -> 90).
      const prof = await program.account.creatorProfile.fetch(creatorProfilePda);
      expect(prof.marketsVoided).to.equal(1);
      expect(prof.reputationScore).to.equal(90);
    });

    it("bettor claims a full refund on the voided market", async () => {
      const [posPda] = findPositionPda(
        voidMarketPda,
        userA.publicKey,
        program.programId
      );

      const balBefore = await connection.getBalance(userA.publicKey);

      await program.methods
        .claimRefund()
        .accounts({
          user: userA.publicKey,
          market: voidMarketPda,
          position: posPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      const pos = await program.account.position.fetch(posPda);
      expect(pos.claimed).to.equal(true);

      const balAfter = await connection.getBalance(userA.publicKey);
      const gain = balAfter - balBefore;
      // Full refund minus tx fee.
      expect(gain).to.be.greaterThan(
        BET_AMOUNT.toNumber() - 0.01 * LAMPORTS_PER_SOL
      );
    });

    it("rejects a double refund claim", async () => {
      const [posPda] = findPositionPda(
        voidMarketPda,
        userA.publicKey,
        program.programId
      );

      try {
        await program.methods
          .claimRefund()
          .accounts({
            user: userA.publicKey,
            market: voidMarketPda,
            position: posPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("AlreadyClaimed");
      }
    });

    it("rejects a refund on a non-voided (Open) market", async () => {
      // Market #0 is still Open.
      const [openPda] = findMarketPda(new BN(0), program.programId);
      const [posPda] = findPositionPda(
        openPda,
        userA.publicKey,
        program.programId
      );

      try {
        await program.methods
          .claimRefund()
          .accounts({
            user: userA.publicKey,
            market: openPda,
            position: posPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("MarketNotVoided");
      }
    });
  });

  // =========================================================================
  // 8. Additional Error Cases
  // =========================================================================
  describe("error cases", () => {
    it("rejects a bet on a resolved market", async () => {
      const [mktPda] = findMarketPda(new BN(1), program.programId);
      const [posPda] = findPositionPda(
        mktPda,
        randomUser.publicKey,
        program.programId
      );

      try {
        await program.methods
          .placeBet(new BN(LAMPORTS_PER_SOL), true)
          .accounts({
            user: randomUser.publicKey,
            market: mktPda,
            position: posPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([randomUser])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("MarketNotOpen");
      }
    });

    it("rejects a bet on a voided market", async () => {
      const [mktPda] = findMarketPda(new BN(2), program.programId);
      const [posPda] = findPositionPda(
        mktPda,
        randomUser.publicKey,
        program.programId
      );

      try {
        await program.methods
          .placeBet(new BN(LAMPORTS_PER_SOL), true)
          .accounts({
            user: randomUser.publicKey,
            market: mktPda,
            position: posPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([randomUser])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("MarketNotOpen");
      }
    });

    it("rejects void_market by a non-authority signer", async () => {
      // Market #3 is still Open.
      const [mktPda] = findMarketPda(new BN(3), program.programId);
      const [profPda] = findCreatorProfilePda(
        marketCreator.publicKey,
        program.programId
      );

      try {
        await program.methods
          .voidMarket("unauthorized void attempt")
          .accounts({
            authority: randomUser.publicKey,
            config: configPda,
            market: mktPda,
            creatorProfile: profPda,
          })
          .signers([randomUser])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Constraint: authority.key() != config.authority.
        expect(err).to.exist;
      }
    });

    it("rejects claim_winnings on a voided market (MarketNotResolved)", async () => {
      // Create market #4, place a bet, void it, then try claim_winnings.
      const id = new BN(4);
      const [mktPda] = findMarketPda(id, program.programId);
      const [profPda] = findCreatorProfilePda(
        marketCreator.publicKey,
        program.programId
      );

      await program.methods
        .createMarket(
          "Void error-case market",
          "https://example.com/void-error",
          futureTs(7200)
        )
        .accounts({
          creator: marketCreator.publicKey,
          config: configPda,
          market: mktPda,
          creatorProfile: profPda,
          creatorUsdc,
          treasuryUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      const [posPda] = findPositionPda(mktPda, userB.publicKey, program.programId);

      await program.methods
        .placeBet(new BN(0.1 * LAMPORTS_PER_SOL), true)
        .accounts({
          user: userB.publicKey,
          market: mktPda,
          position: posPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([userB])
        .rpc();

      await program.methods
        .voidMarket("Voided for error-case testing")
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          market: mktPda,
          creatorProfile: profPda,
        })
        .rpc();

      try {
        await program.methods
          .claimWinnings()
          .accounts({
            user: userB.publicKey,
            config: configPda,
            market: mktPda,
            position: posPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([userB])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("MarketNotResolved");
      }
    });

    it("rejects claim_creator_fee on an unresolved (Open) market", async () => {
      // Market #0 is still Open.
      const [mktPda] = findMarketPda(new BN(0), program.programId);
      const [profPda] = findCreatorProfilePda(
        marketCreator.publicKey,
        program.programId
      );

      try {
        await program.methods
          .claimCreatorFee()
          .accounts({
            creator: marketCreator.publicKey,
            config: configPda,
            market: mktPda,
            creatorProfile: profPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([marketCreator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.be.instanceOf(AnchorError);
        expect(err.error.errorCode.code).to.equal("MarketNotResolved");
      }
    });
  });
});
