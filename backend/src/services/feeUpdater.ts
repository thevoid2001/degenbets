/**
 * Fee updater service - fetches SOL/USD price and updates on-chain creation fee.
 * Keeps the creation fee equivalent to ~$20 USD.
 */

const TARGET_FEE_USD = 20;

export async function updateCreationFee(): Promise<{
  solPrice: number;
  feeLamports: number;
  txSig: string | null;
}> {
  const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
  } = await import("@solana/web3.js");

  const rpcUrl = process.env.SOLANA_RPC_URL;
  const authorityKey = process.env.AUTHORITY_PRIVATE_KEY;
  const programId = process.env.PROGRAM_ID;

  if (!rpcUrl || !authorityKey || !programId) {
    console.warn("[fee-updater] Missing Solana env vars, skipping fee update");
    return { solPrice: 0, feeLamports: 0, txSig: null };
  }

  // Fetch SOL/USD price
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
  );
  const data: any = await res.json();
  const solPrice: number = data.solana?.usd;

  if (!solPrice || solPrice <= 0) {
    console.warn("[fee-updater] Could not fetch SOL price");
    return { solPrice: 0, feeLamports: 0, txSig: null };
  }

  // Calculate fee in lamports: $20 / price_per_sol * 1e9
  const feeLamports = Math.round((TARGET_FEE_USD / solPrice) * 1e9);

  console.log(
    `[fee-updater] SOL=$${solPrice}, fee=${feeLamports} lamports (${(feeLamports / 1e9).toFixed(4)} SOL)`
  );

  // Read current on-chain fee to avoid unnecessary updates
  const connection = new Connection(rpcUrl, "confirmed");
  const programPubkey = new PublicKey(programId);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programPubkey
  );

  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    console.warn("[fee-updater] Config account not found");
    return { solPrice, feeLamports, txSig: null };
  }

  // Read current fee from config (offset 72, 8 bytes u64 LE)
  const currentFee = Number(configInfo.data.readBigUInt64LE(72));

  // Only update if fee changed by more than 5%
  const pctChange = Math.abs(feeLamports - currentFee) / currentFee;
  if (pctChange < 0.05) {
    console.log(
      `[fee-updater] Fee change <5% (${(pctChange * 100).toFixed(1)}%), skipping update`
    );
    return { solPrice, feeLamports, txSig: null };
  }

  // Build update_fee instruction
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bs58 = require("bs58");
  const secretBytes = bs58.decode(authorityKey);
  const authority = Keypair.fromSecretKey(secretBytes);

  // update_fee discriminator: sha256("global:update_fee")[0..8]
  // We'll compute it from the IDL discriminator
  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256").update("global:update_fee").digest();
  const discriminator = hash.subarray(0, 8);

  // Encode new_fee_lamports as u64 LE
  const feeBuf = Buffer.alloc(8);
  feeBuf.writeBigUInt64LE(BigInt(feeLamports));

  const instructionData = Buffer.concat([discriminator, feeBuf]);

  const ix = new TransactionInstruction({
    programId: programPubkey,
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: false },
      { pubkey: configPda, isSigner: false, isWritable: true },
    ],
    data: instructionData,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = authority.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(authority);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");

  console.log(`[fee-updater] Fee updated to ${feeLamports} lamports, tx: ${sig}`);
  return { solPrice, feeLamports, txSig: sig };
}
