"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getConfigPda, getPositionPda } from "@/lib/program";
import { PROGRAM_ID, API_URL } from "@/lib/constants";

export function useSell() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);

  const sell = useCallback(
    async (marketPubkey: string, shares: number, side: boolean, marketId?: number, totalSharesBefore?: number, costBasis?: number) => {
      if (!publicKey || !signTransaction) return;
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
            throw new Error("Insufficient SOL balance for this trade.");
          }
          throw new Error(`Transaction failed: ${JSON.stringify(sim.value.err)}`);
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
          })
            .then((r) => r.json())
            .then(() => {
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
                      action: "sell",
                      solAmount: 0,
                      shares,
                      priceAfter: priceAfter ?? 0.5,
                      txSig: sig,
                    }),
                  }).catch(() => {});
                })
                .catch(() => {});
            })
            .catch(() => {});
        }

        return sig;
      } catch (err: any) {
        console.error("Sell error:", err);
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

  return { sell, loading };
}
