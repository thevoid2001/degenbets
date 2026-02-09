"use client";

import { useClaimWinnings } from "@/hooks/useClaimWinnings";
import type { PositionData } from "@/lib/types";

interface ClaimButtonProps {
  position: PositionData;
  onClaimed?: () => void;
}

export function ClaimButton({ position, onClaimed }: ClaimButtonProps) {
  const { claimWinnings, claimRefund, loading } = useClaimWinnings();

  if (position.claimed) {
    return (
      <span className="text-sm text-degen-muted">
        {position.winnings
          ? `Claimed ${(position.winnings / 1e9).toFixed(4)} SOL`
          : "Claimed"}
      </span>
    );
  }

  const handleClaim = async () => {
    try {
      await claimWinnings(position.market_pubkey, position.market_id);
      setTimeout(() => onClaimed?.(), 1500);
    } catch {
      // error logged in hook
    }
  };

  const handleRefund = async () => {
    try {
      await claimRefund(position.market_pubkey, position.market_id);
      setTimeout(() => onClaimed?.(), 1500);
    } catch {
      // error logged in hook
    }
  };

  if (position.status === "voided") {
    return (
      <button
        onClick={handleRefund}
        disabled={loading}
        className="btn-primary text-sm py-2 px-4"
      >
        {loading ? "Claiming..." : "Claim Refund"}
      </button>
    );
  }

  if (position.status === "resolved" && position.won) {
    return (
      <button
        onClick={handleClaim}
        disabled={loading}
        className="btn-primary text-sm py-2 px-4"
      >
        {loading ? "Claiming..." : "Claim Winnings"}
      </button>
    );
  }

  return null;
}
