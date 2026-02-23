"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

const QUICK_AMOUNTS = [0.1, 0.5, 1.0, 5.0];

interface WagerBarProps {
  wagerSol: number;
  onWagerChange: (sol: number) => void;
}

export function WagerBar({ wagerSol, onWagerChange }: WagerBarProps) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    connection
      .getBalance(publicKey)
      .then((bal) => setBalance(bal / 1e9))
      .catch(() => {});
  }, [publicKey, connection]);

  const isQuickAmount = QUICK_AMOUNTS.includes(wagerSol);

  return (
    <div className="bg-degen-card/90 backdrop-blur-md border-t border-degen-border px-4 pt-3 pb-safe">
      <div className="flex items-center gap-2 justify-center mb-2">
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt}
            onClick={() => {
              onWagerChange(amt);
              setShowCustom(false);
              setCustomInput("");
            }}
            className={`wager-pill ${wagerSol === amt && !showCustom ? "wager-pill-active" : ""}`}
          >
            {amt}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(true)}
          className={`wager-pill ${showCustom || (!isQuickAmount && wagerSol > 0) ? "wager-pill-active" : ""}`}
        >
          ...
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 mb-2 max-w-[260px] mx-auto">
          <input
            type="number"
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value);
              const val = parseFloat(e.target.value);
              if (val > 0) onWagerChange(val);
            }}
            placeholder="Custom SOL"
            className="input-field text-sm !py-2 text-center flex-1"
            min="0"
            step="0.01"
            autoFocus
          />
          <button
            onClick={() => {
              setShowCustom(false);
              if (!customInput) onWagerChange(0.1);
            }}
            className="text-xs text-degen-muted hover:text-degen-text"
          >
            Done
          </button>
        </div>
      )}

      <div className="flex justify-between items-center text-xs text-degen-muted px-1 pb-1">
        <span>
          Wager: <span className="text-degen-text font-bold">{wagerSol} SOL</span>
        </span>
        {balance !== null && (
          <span>
            Balance: <span className="text-degen-text font-medium">{balance.toFixed(3)} SOL</span>
          </span>
        )}
      </div>
    </div>
  );
}
