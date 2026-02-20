"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram } from "@solana/web3.js";
import { getConfigPda, getMarketPda, getCreatorProfilePda } from "@/lib/program";
import { PROGRAM_ID } from "@/lib/constants";

export function useCreateMarket() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);

  const createMarket = useCallback(
    async (
      question: string,
      resolutionSource: string,
      resolutionTimestamp: number,
      liquidityLamports: number
    ) => {
      if (!publicKey || !signTransaction) return null;
      setLoading(true);

      try {
        const [configPda] = getConfigPda();
        const [creatorProfilePda] = getCreatorProfilePda(publicKey);

        // Fetch config to get market_count
        const configInfo = await connection.getAccountInfo(configPda);
        if (!configInfo) throw new Error("Config not initialized");

        // Parse market_count (offset: 8 + 32 + 32 + 8 + 2 + 2 = 84, u64)
        const marketCount = configInfo.data.readBigUInt64LE(84);
        const [marketPda] = getMarketPda(Number(marketCount));

        // Build create_market instruction
        const discriminator = Buffer.from([
          103, 226, 97, 235, 200, 188, 251, 254,
        ]);

        // Encode question as Anchor string: 4-byte LE length + utf8 bytes
        const questionBytes = Buffer.from(question, "utf-8");
        const questionLen = Buffer.alloc(4);
        questionLen.writeUInt32LE(questionBytes.length);

        const sourceBytes = Buffer.from(resolutionSource, "utf-8");
        const sourceLen = Buffer.alloc(4);
        sourceLen.writeUInt32LE(sourceBytes.length);

        const timestampBuf = Buffer.alloc(8);
        timestampBuf.writeBigInt64LE(BigInt(resolutionTimestamp));

        // liquidity_amount (u64 LE)
        const liquidityBuf = Buffer.alloc(8);
        liquidityBuf.writeBigUInt64LE(BigInt(liquidityLamports));

        const data = Buffer.concat([
          discriminator,
          questionLen,
          questionBytes,
          sourceLen,
          sourceBytes,
          timestampBuf,
          liquidityBuf,
        ]);

        const ix = {
          programId: PROGRAM_ID,
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: true },
            { pubkey: marketPda, isSigner: false, isWritable: true },
            { pubkey: creatorProfilePda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        };

        const tx = new Transaction().add(ix);
        tx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        // Pre-flight simulation to catch errors before wallet interaction
        const sim = await connection.simulateTransaction(tx);
        if (sim.value.err) {
          const logs = sim.value.logs?.join("\n") || "";
          console.error("Simulation logs:", logs);
          const anchorMatch = logs.match(/Error Code: (\w+)/);
          if (anchorMatch) throw new Error(`Program error: ${anchorMatch[1]}`);
          if (logs.includes("insufficient lamports")) {
            throw new Error("Insufficient SOL balance. You need enough for liquidity + ~0.01 SOL rent.");
          }
          throw new Error(`Transaction simulation failed: ${JSON.stringify(sim.value.err)}`);
        }

        // Use signTransaction + sendRawTransaction to bypass Phantom's
        // internal simulation which shows a generic "unexpected error" dialog
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: true,
        });
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        return { pubkey: marketPda.toBase58(), marketId: Number(marketCount) };
      } catch (err: any) {
        console.error("Create market error:", err);
        const logs = err?.logs || err?.message || "";
        const anchorMatch = String(logs).match(/Error Code: (\w+)/);
        if (anchorMatch) {
          throw new Error(`Program error: ${anchorMatch[1]}`);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, signTransaction]
  );

  return { createMarket, loading };
}
