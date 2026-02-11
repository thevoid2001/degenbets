"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getConfigPda, getPositionPda } from "@/lib/program";
import { PROGRAM_ID, API_URL } from "@/lib/constants";

export function useSell() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);

  const sell = useCallback(
    async (marketPubkey: string, shares: number, side: boolean, marketId?: number, totalSharesBefore?: number, costBasis?: number) => {
      if (!publicKey) return;
      setLoading(true);

      try {
        const marketPda = new PublicKey(marketPubkey);
        const [configPda] = getConfigPda();
        const [positionPda] = getPositionPda(marketPda, publicKey);

        // Anchor discriminator for "sell"
        const discriminator = Buffer.from([
          51, 230, 133, 164, 1, 127, 131, 173,
        ]);

        // Args: shares (u64 LE) + side (u8 bool)
        const sharesBuf = Buffer.alloc(8);
        sharesBuf.writeBigUInt64LE(BigInt(shares));
        const sideBuf = Buffer.from([side ? 1 : 0]);

        const data = Buffer.concat([discriminator, sharesBuf, sideBuf]);

        const ix = {
          programId: PROGRAM_ID,
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: marketPda, isSigner: false, isWritable: true },
            { pubkey: positionPda, isSigner: false, isWritable: true },
          ],
          data,
        };

        const tx = new Transaction().add(ix);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        // Sync on-chain data to backend DB (reduce cost basis proportionally)
        if (marketId !== undefined) {
          let costBasisDelta = 0;
          if (totalSharesBefore && totalSharesBefore > 0 && costBasis && costBasis > 0) {
            const proportion = shares / totalSharesBefore;
            costBasisDelta = -Math.floor(proportion * costBasis);
          }
          fetch(`${API_URL}/api/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ marketId, userWallet: publicKey.toBase58(), costBasisDelta }),
          }).catch(() => {});
        }

        return sig;
      } catch (err) {
        console.error("Sell error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  return { sell, loading };
}
