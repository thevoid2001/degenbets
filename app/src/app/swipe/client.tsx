"use client";

import { useState, useCallback } from "react";
import { SwipeTopBar } from "@/components/swipe/SwipeTopBar";
import { SwipeCardStack } from "@/components/swipe/SwipeCardStack";
import { WagerBar } from "@/components/swipe/WagerBar";
import { useSwipeMarkets } from "@/hooks/useSwipeMarkets";

export default function SwipeClient() {
  const { currentMarket, nextMarkets, advance, skip, loading, exhausted } =
    useSwipeMarkets();
  const [wagerSol, setWagerSol] = useState(0.1);

  const wagerLamports = Math.floor(wagerSol * 1e9);

  const handleSwipeComplete = useCallback(() => {
    advance();
  }, [advance]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-degen-dark overflow-hidden">
      <SwipeTopBar onSkip={skip} canSkip={!!currentMarket && !exhausted} />

      <SwipeCardStack
        currentMarket={currentMarket}
        nextMarkets={nextMarkets}
        wagerLamports={wagerLamports}
        onSwipeComplete={handleSwipeComplete}
        loading={loading}
        exhausted={exhausted}
      />

      {/* Swipe hint */}
      {currentMarket && !exhausted && (
        <div className="text-center text-xs text-degen-muted pb-2 px-4">
          <span className="text-degen-red">&#x2190; NO</span>
          {" "}
          &middot; Swipe to bet &middot;
          {" "}
          <span className="text-degen-green">YES &#x2192;</span>
        </div>
      )}

      <WagerBar wagerSol={wagerSol} onWagerChange={setWagerSol} />
    </div>
  );
}
