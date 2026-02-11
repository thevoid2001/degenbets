import { PublicKey } from "@solana/web3.js";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "5rCyhouLLq4RdFcsPmQDJkx531kptp3JPhhnoenVvq4L"
);
