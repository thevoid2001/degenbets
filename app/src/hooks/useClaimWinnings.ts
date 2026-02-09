"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { getConfigPda, getPositionPda } from "@/lib/program";
import { PROGRAM_ID, API_URL } from "@/lib/constants";

export function useClaimWinnings() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);

  const claimWinnings = useCallback(
    async (marketPubkey: string, marketId?: number) => {
      if (!publicKey) return;
      setLoading(true);

      try {
        const marketPda = new PublicKey(marketPubkey);
        const [configPda] = getConfigPda();
        const [positionPda] = getPositionPda(marketPda, publicKey);

        const discriminator = Buffer.from([
          161, 215, 24, 59, 14, 236, 242, 221,
        ]); // sha256("global:claim_winnings")[0..8]

        const ix = {
          programId: PROGRAM_ID,
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: marketPda, isSigner: false, isWritable: true },
            { pubkey: positionPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: discriminator,
        };

        const tx = new Transaction().add(ix);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        // Sync claimed status to DB
        if (marketId) {
          fetch(`${API_URL}/api/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ marketId, userWallet: publicKey.toBase58() }),
          }).catch(() => {});
        }

        return sig;
      } catch (err) {
        console.error("Claim winnings error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  const claimRefund = useCallback(
    async (marketPubkey: string, marketId?: number) => {
      if (!publicKey) return;
      setLoading(true);

      try {
        const marketPda = new PublicKey(marketPubkey);
        const [positionPda] = getPositionPda(marketPda, publicKey);

        const discriminator = Buffer.from([
          15, 16, 30, 161, 255, 228, 97, 60,
        ]); // sha256("global:claim_refund")[0..8]

        const ix = {
          programId: PROGRAM_ID,
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: marketPda, isSigner: false, isWritable: true },
            { pubkey: positionPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: discriminator,
        };

        const tx = new Transaction().add(ix);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        // Sync claimed status to DB
        if (marketId) {
          fetch(`${API_URL}/api/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ marketId, userWallet: publicKey.toBase58() }),
          }).catch(() => {});
        }

        return sig;
      } catch (err) {
        console.error("Claim refund error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  return { claimWinnings, claimRefund, loading };
}
