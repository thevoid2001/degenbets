"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getConfigPda, getPositionPda } from "@/lib/program";
import { PROGRAM_ID, API_URL } from "@/lib/constants";

export function useSellPosition() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);

  const sellPosition = useCallback(
    async (marketPubkey: string, amountLamports: number, side: boolean, marketId?: number) => {
      if (!publicKey) return;
      setLoading(true);

      try {
        const marketPda = new PublicKey(marketPubkey);
        const [configPda] = getConfigPda();
        const [positionPda] = getPositionPda(marketPda, publicKey);

        // Fetch treasury from config on-chain (offset 40, 32 bytes)
        const configInfo = await connection.getAccountInfo(configPda);
        if (!configInfo) throw new Error("Config not initialized");
        const treasury = new PublicKey(configInfo.data.subarray(40, 72));

        // sell_position discriminator from IDL
        const discriminator = Buffer.from([
          11, 170, 234, 139, 126, 196, 142, 74,
        ]);

        // Args: amount (u64 LE) + side (u8 bool)
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
            { pubkey: treasury, isSigner: false, isWritable: true },
          ],
          data,
        };

        const tx = new Transaction().add(ix);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        // Sync on-chain data to backend DB
        if (marketId !== undefined) {
          fetch(`${API_URL}/api/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ marketId, userWallet: publicKey.toBase58() }),
          }).catch(() => {});
        }

        return sig;
      } catch (err) {
        console.error("Sell position error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  return { sellPosition, loading };
}
