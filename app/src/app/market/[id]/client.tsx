"use client";

import { useState, useEffect } from "react";
import { MarketDetail } from "@/components/markets/MarketDetail";
import { BetPanel } from "@/components/markets/BetPanel";
import { ClaimPanel } from "@/components/markets/ClaimPanel";
import { DealerChat } from "@/components/dealer/DealerChat";
import { useMarket } from "@/hooks/useMarket";

function useRouteParam(segment: number) {
  const [param, setParam] = useState("");
  useEffect(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    setParam(parts[segment] || "");
  }, [segment]);
  return param;
}

export default function MarketPageClient() {
  const id = useRouteParam(1);
  const { market, positions, loading, refetch } = useMarket(id);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-degen-accent" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="text-center py-20 text-degen-muted">
        <p className="text-xl">Market not found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <MarketDetail market={market} />
        <DealerChat marketPubkey={market.pubkey} />

        {positions.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-bold mb-4">Positions ({positions.length})</h3>
            <div className="space-y-2">
              {positions.map((pos, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-2 border-b border-degen-border last:border-0"
                >
                  <span className="font-mono text-sm text-degen-muted">
                    {pos.user_wallet.slice(0, 4)}...{pos.user_wallet.slice(-4)}
                  </span>
                  <div className="flex gap-4 text-sm">
                    {pos.yes_shares > 0 && (
                      <span className="text-degen-green">
                        YES: {(pos.yes_shares / 1e9).toFixed(2)} shares
                      </span>
                    )}
                    {pos.no_shares > 0 && (
                      <span className="text-degen-red">
                        NO: {(pos.no_shares / 1e9).toFixed(2)} shares
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        {market.status === "open" ? (
          <BetPanel market={market} onTxSuccess={refetch} />
        ) : (
          <ClaimPanel market={market} onTxSuccess={refetch} />
        )}
      </div>
    </div>
  );
}
