"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { PositionCard } from "@/components/portfolio/PositionCard";
import { PortfolioStats } from "@/components/portfolio/PortfolioStats";
import { usePositions } from "@/hooks/usePositions";

export default function PortfolioPage() {
  const { publicKey } = useWallet();
  const { positions, stats, loading, refetch } = usePositions(publicKey?.toBase58());

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
