"use client";

import { ClaimButton } from "./ClaimButton";
import { useSell } from "@/hooks/useSell";
import type { PositionData } from "@/lib/types";

interface PositionCardProps {
  position: PositionData;
  onClaimed?: () => void;
}

export function PositionCard({ position, onClaimed }: PositionCardProps) {
  const { sell, loading: sellLoading } = useSell();
  const totalShares = position.yes_shares + position.no_shares;
  const side = position.yes_shares > position.no_shares ? "YES" : "NO";
  const sideShares = Math.max(position.yes_shares, position.no_shares);

  const handleSell = async () => {
    const sellSide = position.yes_shares > position.no_shares;
    const shares = sellSide ? position.yes_shares : position.no_shares;
    try {
      await sell(position.market_pubkey, shares, sellSide, position.market_id);
    } catch {
      // error logged in hook
    }
  };

  return (
    <div className="card">
      <div className="flex justify-between items-start">
        <div>
          <a
            href={`/market/${position.market_pubkey}`}
            className="text-lg font-bold hover:text-degen-accent transition-colors"
          >
            {position.question || position.market_pubkey.slice(0, 8) + "..."}
          </a>
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                side === "YES"
                  ? "bg-degen-green/20 text-degen-green"
                  : "bg-degen-red/20 text-degen-red"
              }`}
            >
              {side}
            </span>
            <span className="text-degen-muted">
              {(sideShares / 1e9).toFixed(4)} shares
            </span>
            {position.status === "resolved" && (
              <span
                className={`text-xs font-bold ${
                  position.won ? "text-degen-green" : "text-degen-red"
                }`}
              >
                {position.won ? "WON" : "LOST"}
              </span>
            )}
            {position.status === "voided" && (
              <span className="text-xs font-bold text-yellow-400">VOIDED</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {position.status === "open" && !position.claimed && (
            <button
              onClick={handleSell}
              disabled={sellLoading}
              className="px-3 py-1.5 text-xs font-bold rounded bg-degen-red/20 text-degen-red border border-degen-red/30 hover:bg-degen-red/30 transition-colors"
            >
              {sellLoading ? "Selling..." : "Sell"}
            </button>
          )}
          <ClaimButton position={position} onClaimed={onClaimed} />
        </div>
      </div>
    </div>
  );
}
