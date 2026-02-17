"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { getMarketPda, getPositionPda, getConfigPda } from "@/lib/program";
import { PROGRAM_ID, API_URL } from "@/lib/constants";

export function useBuy() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);

  const buy = useCallback(
    async (
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

        // Anchor discriminator for "buy"
        const discriminator = Buffer.from([
          102, 6, 61, 18, 1, 218, 235, 234,
        ]);
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

        // Sync on-chain data to backend DB (include cost basis for P&L tracking)
        fetch(`${API_URL}/api/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketId, userWallet: publicKey.toBase58(), costBasisDelta: amountLamports }),
        })
          .then((r) => r.json())
          .then(() => {
            // Fetch updated market to get price_after
            fetch(`${API_URL}/api/markets/${marketId}`)
              .then((r) => r.json())
              .then((data) => {
                const priceAfter = side ? data.market?.yes_price : data.market?.no_price;
                fetch(`${API_URL}/api/trades`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    marketId,
                    userWallet: publicKey.toBase58(),
                    side,
                    action: "buy",
                    solAmount: amountLamports,
                    shares: 0,
                    priceAfter: priceAfter ?? 0.5,
                    txSig: sig,
                  }),
                }).catch(() => {});
              })
              .catch(() => {});
          })
          .catch(() => {});

        return sig;
      } catch (err) {
        console.error("Buy error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  return { buy, loading };
}
