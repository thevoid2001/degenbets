"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { getConfigPda, getCreatorProfilePda } from "@/lib/program";
import { PROGRAM_ID } from "@/lib/constants";

export function useClaimCreatorFee() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);

  const claimCreatorFee = useCallback(
    async (marketPubkey: string) => {
      if (!publicKey || !signTransaction) return;
      setLoading(true);

      try {
        const marketPda = new PublicKey(marketPubkey);
        const [configPda] = getConfigPda();
        const [creatorProfilePda] = getCreatorProfilePda(publicKey);

        const discriminator = Buffer.from([
          26, 97, 138, 203, 132, 171, 141, 252,
        ]); // sha256("global:claim_creator_fee")[0..8]

        const ix = {
          programId: PROGRAM_ID,
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: marketPda, isSigner: false, isWritable: true },
            { pubkey: creatorProfilePda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: discriminator,
        };

        const tx = new Transaction().add(ix);
        tx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: true,
        });
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        return sig;
      } catch (err) {
        console.error("Claim creator fee error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, signTransaction]
  );

  return { claimCreatorFee, loading };
}
