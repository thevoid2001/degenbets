"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram } from "@solana/web3.js";
import { getConfigPda, getMarketPda, getCreatorProfilePda } from "@/lib/program";
import { PROGRAM_ID } from "@/lib/constants";

export function useCreateMarket() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);

  const createMarket = useCallback(
    async (
      question: string,
      resolutionSource: string,
      resolutionTimestamp: number,
      liquidityLamports: number
    ) => {
      if (!publicKey) return null;
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
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        return { pubkey: marketPda.toBase58(), marketId: Number(marketCount) };
      } catch (err) {
        console.error("Create market error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  return { createMarket, loading };
}
