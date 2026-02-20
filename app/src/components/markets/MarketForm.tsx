"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useCreateMarket } from "@/hooks/useCreateMarket";
import { API_URL } from "@/lib/constants";
import { getConfigPda } from "@/lib/program";
import { useToast } from "@/components/common/ToastProvider";

export function MarketForm() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const router = useRouter();
  const { createMarket, loading } = useCreateMarket();
  const { addToast } = useToast();

  const [question, setQuestion] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [category, setCategory] = useState("misc");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [liquidityAmount, setLiquidityAmount] = useState("1");
  const [minLiquidity, setMinLiquidity] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Fetch wallet balance
  useEffect(() => {
    if (!publicKey) { setWalletBalance(null); return; }
    connection.getBalance(publicKey).then((bal) => setWalletBalance(bal / 1e9)).catch(() => {});
  }, [publicKey, connection]);

  // Fetch min liquidity from on-chain config and SOL price
  useEffect(() => {
    async function fetchConfig() {
      try {
        const [configPda] = getConfigPda();
        const configInfo = await connection.getAccountInfo(configPda);
        if (configInfo && configInfo.data.length >= 93) {
          // min_liquidity_lamports at offset 72 (8 bytes u64)
          const minLiqLamports = configInfo.data.readBigUInt64LE(72);
          setMinLiquidity(Number(minLiqLamports) / 1e9);
          // paused at offset 92 (1 byte bool)
          setPaused(configInfo.data[92] === 1);
        }
      } catch (err) {
        console.error("Failed to fetch config:", err);
      }
    }

    async function fetchSolPrice() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
        );
        const data = await res.json();
        if (data.solana?.usd) {
          setSolPrice(data.solana.usd);
        }
      } catch (err) {
        console.error("Failed to fetch SOL price:", err);
      }
    }

    fetchConfig();
    fetchSolPrice();
  }, [connection]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be under 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    // Interpret date/time as EST (UTC-5)
    const resolutionDate = new Date(`${date}T${time}:00-05:00`);
    const timestamp = Math.floor(resolutionDate.getTime() / 1000);

    // Step 1: Upload image if selected
    let uploadedImageUrl: string | null = null;
    if (imageFile) {
      const formData = new FormData();
      formData.append("image", imageFile);
      try {
        const uploadRes = await fetch(`${API_URL}/api/markets/upload-image`, {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) {
          uploadedImageUrl = uploadData.imageUrl;
        }
      } catch (err) {
        console.error("Image upload failed:", err);
      }
    }

    // Step 2: Create market on-chain
    const liquidityLamports = Math.floor((parseFloat(liquidityAmount) || 1) * 1e9);
    let result;
    try {
      result = await createMarket(question, source, timestamp, liquidityLamports);
    } catch (err: any) {
      const msg = err?.message?.includes("User rejected") ? "Transaction rejected" : (err?.message?.slice(0, 80) || "Market creation failed");
      addToast("error", msg);
      return;
    }

    if (result) {
      // Step 3: Sync market to backend database
      try {
        await fetch(`${API_URL}/api/markets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pubkey: result.pubkey,
            marketId: result.marketId,
            creator: publicKey.toBase58(),
            question,
            resolutionSource: source,
            resolutionTimestamp: timestamp,
            category,
          }),
        });
      } catch (err) {
        console.error("Failed to sync market to backend:", err);
      }

      // Step 4: Sync on-chain AMM state (reserves, total_minted) to DB
      try {
        await fetch(`${API_URL}/api/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketId: result.marketId, userWallet: publicKey.toBase58() }),
        });
      } catch (err) {
        console.error("Failed to sync on-chain state:", err);
      }

      // Step 5: Associate image with market pubkey
      if (uploadedImageUrl) {
        try {
          await fetch(`${API_URL}/api/markets/${result.pubkey}/image`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: uploadedImageUrl }),
          });
        } catch (err) {
          console.error("Image association failed:", err);
        }
      }

      addToast("success", "Market created!");
      router.push(`/market/${result.pubkey}`);
    }
  };

  const liquidityNum = parseFloat(liquidityAmount) || 0;
  const insufficientBalance = walletBalance !== null && liquidityNum + 0.009 > walletBalance;
  const isValid =
    question.length > 0 &&
    question.length <= 256 &&
    source.startsWith("http") &&
    date &&
    time &&
    liquidityNum >= (minLiquidity ?? 1) &&
    !insufficientBalance;

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      {paused && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm font-medium text-center">
          Market creation is temporarily paused
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Question</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Will the Lakers beat the Celtics on Feb 7?"
          className="input-field"
          maxLength={256}
        />
        <p className="text-xs text-degen-muted mt-1">{question.length}/256</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Resolution Source URL</label>
        <input
          type="url"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="https://espn.com/nba/game/_/gameId/401584721"
          className="input-field"
        />
        <p className="text-xs text-degen-muted mt-1">
          AI will read this URL to determine YES or NO
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input-field"
        >
          <option value="sports">Sports</option>
          <option value="crypto">Crypto</option>
          <option value="politics">Politics</option>
          <option value="entertainment">Entertainment</option>
          <option value="misc">Misc</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Resolution Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Time (EST)</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Initial Liquidity */}
      <div>
        <label className="block text-sm font-medium mb-2">Initial Liquidity (SOL)</label>
        <input
          type="number"
          value={liquidityAmount}
          onChange={(e) => setLiquidityAmount(e.target.value)}
          placeholder="1.0"
          className="input-field"
          min={1}
          step="any"
        />
        <p className="text-xs text-degen-muted mt-1">
          Minimum {minLiquidity ?? 1} SOL. This SOL is deposited into the AMM pool and returned to you when the market resolves. More liquidity = tighter spreads.
        </p>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Market Image <span className="text-degen-muted">(optional)</span>
        </label>
        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg border border-degen-border"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 bg-degen-dark/80 text-degen-text rounded-full w-8 h-8 flex items-center justify-center hover:bg-degen-red/80 transition-colors text-sm font-bold"
            >
              X
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-degen-border border-dashed rounded-lg cursor-pointer hover:border-degen-accent/50 transition-colors bg-degen-dark/30">
            <div className="flex flex-col items-center justify-center py-4">
              <svg className="w-8 h-8 text-degen-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-degen-muted">Click to upload an image</p>
              <p className="text-xs text-degen-muted mt-1">PNG, JPG, WebP, GIF up to 5MB</p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      <div className="border-t border-degen-border pt-6 space-y-2">
        {walletBalance !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-degen-muted">Wallet Balance:</span>
            <span className="font-bold">{walletBalance.toFixed(4)} SOL</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-degen-muted">Liquidity Deposit:</span>
          <span className="font-bold">
            {liquidityNum.toFixed(2)} SOL
            {solPrice !== null && (
              <span className="text-degen-muted font-normal ml-1">
                (~${(liquidityNum * solPrice).toFixed(0)})
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-degen-muted">Est. Total Cost:</span>
          <span className={`font-bold ${insufficientBalance ? "text-degen-red" : ""}`}>{(liquidityNum + 0.009).toFixed(4)} SOL</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-degen-muted">Creator Earnings:</span>
          <span className="font-bold text-degen-green">1% of volume traded</span>
        </div>
        {insufficientBalance && (
          <div className="p-2 bg-degen-red/10 border border-degen-red/30 rounded-lg text-degen-red text-xs font-medium">
            Insufficient balance. You have {walletBalance?.toFixed(4)} SOL but need ~{(liquidityNum + 0.009).toFixed(4)} SOL (liquidity + rent).
          </div>
        )}
        <p className="text-xs text-degen-muted">
          Your liquidity is returned to you when the market resolves. The return amount may vary slightly depending on trading activity (swap fees grow the pool in your favor).
        </p>
      </div>

      <button
        type="submit"
        disabled={!publicKey || !isValid || loading || paused}
        className="btn-primary w-full text-lg"
      >
        {!publicKey
          ? "Connect Wallet"
          : loading
            ? "Creating Market..."
            : `Create Market — Deposit ${liquidityNum.toFixed(2)} SOL`}
      </button>

      <p className="text-xs text-degen-muted text-center">
        If your market can&apos;t be resolved clearly, it will be voided and your liquidity returned.
        Voided markets affect your creator reputation.
      </p>
    </form>
  );
}
