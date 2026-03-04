"use client";

import Link from "next/link";
import { WalletButton } from "@/components/common/WalletButton";

interface SwipeTopBarProps {
  onSkip: () => void;
  canSkip: boolean;
}

export function SwipeTopBar({ onSkip, canSkip }: SwipeTopBarProps) {
  return (
    <div className="flex items-center justify-between px-4 pt-safe">
      <div className="flex items-center gap-3 py-3">
        <Link href="/" className="logo-glow">
          <img
            src="/marketmint-icon.svg"
            alt="MarketMint"
            className="h-8 w-8"
          />
        </Link>
        <span className="text-xs text-degen-muted font-medium hidden sm:inline">
          Swipe Mode
        </span>
      </div>

      <div className="flex items-center gap-2">
        {canSkip && (
          <button
            onClick={onSkip}
            className="px-3 py-1.5 text-xs font-bold text-degen-muted hover:text-degen-text border border-degen-border rounded-lg hover:border-degen-accent/30 transition-colors"
          >
            Skip
          </button>
        )}
        <WalletButton />
      </div>
    </div>
  );
}
