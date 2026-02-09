"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getMarketPda, getPositionPda, getConfigPda } from "@/lib/program";
import { PROGRAM_ID, API_URL } from "@/lib/constants";

export function usePlaceBet() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);

  const placeBet = useCallback(
    async (
      marketPubkey: string,
      marketId: number,
      amountLamports: number,
      side: boolean
    ) => {
      if (!publicKey) return;
      setLoading(true);

      try {
        const [marketPda] = getMarketPda(marketId);
        const [positionPda] = getPositionPda(marketPda, publicKey);
        const [configPda] = getConfigPda();

        // Build place_bet instruction data
        // Anchor discriminator for "place_bet" + amount (u64 LE) + side (u8 bool)
        const discriminator = Buffer.from([
          222, 62, 67, 220, 63, 166, 126, 33,
        ]); // sha256("global:place_bet")[0..8]
        const amountBuf = Buffer.alloc(8);
        amountBuf.writeBigUInt64LE(BigInt(amountLamports));
        const sideBuf = Buffer.from([side ? 1 : 0]);

        const data = Buffer.concat([discriminator, amountBuf, sideBuf]);

        const ix = {
          programId: PROGRAM_ID,
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: marketPda, isSigner: false, isWritable: true },
            { pubkey: positionPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        };

        const tx = new Transaction().add(ix);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        // Sync on-chain data to backend DB
        fetch(`${API_URL}/api/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketId, userWallet: publicKey.toBase58() }),
        }).catch(() => {});

        return sig;
      } catch (err) {
        console.error("Place bet error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  return { placeBet, loading };
}
