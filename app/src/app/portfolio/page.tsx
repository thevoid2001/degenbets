"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PositionCard } from "@/components/portfolio/PositionCard";
import { PortfolioStats } from "@/components/portfolio/PortfolioStats";
import { MarketCard } from "@/components/markets/MarketCard";
import { usePositions } from "@/hooks/usePositions";
import { API_URL } from "@/lib/constants";
import type { MarketData } from "@/lib/types";

export default function PortfolioPage() {
  const { publicKey } = useWallet();
  const { positions, stats, loading, refetch } = usePositions(publicKey?.toBase58());
  const [createdMarkets, setCreatedMarkets] = useState<MarketData[]>([]);
  const [loadingCreated, setLoadingCreated] = useState(true);

  useEffect(() => {
    if (!publicKey) {
      setCreatedMarkets([]);
      setLoadingCreated(false);
      return;
    }
    fetch(`${API_URL}/api/markets?creator=${publicKey.toBase58()}&limit=50`)
      .then((r) => r.json())
      .then((data) => setCreatedMarkets(data.markets || []))
      .catch(() => setCreatedMarkets([]))
      .finally(() => setLoadingCreated(false));
  }, [publicKey]);

  if (!publicKey) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-degen-muted mb-4">Connect your wallet to view positions</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-display font-bold mb-8 neon-text">Portfolio</h1>

      <PortfolioStats stats={stats} />

      {/* Created Markets Section */}
      <h2 className="text-2xl font-display font-bold mt-8 mb-4">Markets You Created</h2>
      {loadingCreated ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-degen-accent" />
        </div>
      ) : createdMarkets.length === 0 ? (
        <div className="text-center py-6 text-degen-muted">
          <p>No markets created yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {createdMarkets.map((market) => (
            <MarketCard key={market.pubkey} market={market} />
          ))}
        </div>
      )}

      {/* Positions Section */}
      <h2 className="text-2xl font-display font-bold mt-8 mb-4">Your Positions</h2>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-degen-accent" />
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-10 text-degen-muted">
          <p>No positions yet. Go place some bets, degen.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {positions.map((pos) => (
            <PositionCard key={pos.market_pubkey} position={pos} onClaimed={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
