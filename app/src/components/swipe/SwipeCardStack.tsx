"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SwipeCard } from "./SwipeCard";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useBuy } from "@/hooks/useBuy";
import { useToast } from "@/components/common/ToastProvider";
import type { MarketData } from "@/lib/types";

interface SwipeCardStackProps {
  currentMarket: MarketData | null;
  nextMarkets: MarketData[];
  wagerLamports: number;
  onSwipeComplete: () => void;
  loading: boolean;
  exhausted: boolean;
}

export function SwipeCardStack({
  currentMarket,
  nextMarkets,
  wagerLamports,
  onSwipeComplete,
  loading,
  exhausted,
}: SwipeCardStackProps) {
  const { publicKey } = useWallet();
  const { buy, loading: buyLoading } = useBuy();
  const { addToast } = useToast();
  const [processing, setProcessing] = useState(false);

  const handleSwipe = useCallback(
    async (dir: "left" | "right") => {
      if (!currentMarket || !publicKey || processing) return;

      if (wagerLamports <= 0) {
        addToast("error", "Set a wager amount first");
        return;
      }

      const side = dir === "right"; // right = YES, left = NO
      setProcessing(true);

      try {
        await buy(currentMarket.market_id, wagerLamports, side);
        const solAmt = (wagerLamports / 1e9).toFixed(2);
        addToast("success", `Bought ${solAmt} SOL of ${side ? "YES" : "NO"}`);
        onSwipeComplete();
      } catch (err: any) {
        const msg = err?.message?.includes("User rejected")
          ? "Transaction rejected"
          : err?.message?.slice(0, 80) || "Transaction failed";
        addToast("error", msg);
      } finally {
        setProcessing(false);
      }
    },
    [currentMarket, publicKey, wagerLamports, buy, addToast, onSwipeComplete, processing]
  );

  const enabled = !buyLoading && !processing && !!publicKey && !!currentMarket;
  const { state, bind } = useSwipeGesture(handleSwipe, enabled);

  // Calculate overlay opacity (0-1) based on drag distance
  const overlayOpacity = Math.min(1, Math.abs(state.offsetX) / 150);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-degen-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-degen-muted text-sm">Loading markets...</p>
        </div>
      </div>
    );
  }

  if (exhausted) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <div className="text-5xl">&#x1f0cf;</div>
          <h2 className="text-xl font-bold">No more markets</h2>
          <p className="text-degen-muted text-sm">
            You&apos;ve seen them all! Check back later or create your own.
          </p>
          <a href="/create" className="btn-primary inline-block">
            Create Market
          </a>
        </div>
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <div className="text-5xl">&#x1f4b0;</div>
          <h2 className="text-xl font-bold">Connect Wallet to Swipe</h2>
          <p className="text-degen-muted text-sm">
            Connect your Solana wallet to start betting on markets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center relative">
      <div className="relative w-full max-w-[380px] mx-auto" style={{ height: 480 }}>
        {/* Background cards (non-interactive) */}
        {nextMarkets.map((market, i) => (
          <SwipeCard
            key={market.pubkey}
            market={market}
            className="pointer-events-none"
            style={{
              zIndex: 10 - (i + 1),
              transform: `scale(${1 - (i + 1) * 0.05}) translateY(${(i + 1) * 12}px)`,
              opacity: 1 - (i + 1) * 0.2,
            }}
          />
        ))}

        {/* Top card (interactive) */}
        {currentMarket && (
          <SwipeCard
            key={currentMarket.pubkey}
            market={currentMarket}
            className={
              state.exiting
                ? "swipe-card-exiting"
                : state.settling
                  ? "swipe-card-settling"
                  : ""
            }
            style={{
              zIndex: 20,
              transform: `translateX(${state.offsetX}px) translateY(${state.offsetY * 0.3}px) rotate(${state.rotation}deg)`,
              cursor: processing ? "wait" : "grab",
            }}
            overlayDirection={state.direction}
            overlayOpacity={overlayOpacity}
            bind={bind}
          />
        )}

        {/* Processing overlay */}
        {processing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-degen-dark/50 rounded-xl">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-degen-accent border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium">Placing bet...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
