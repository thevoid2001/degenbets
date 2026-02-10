"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { PortfolioStats } from "@/components/portfolio/PortfolioStats";
import { PositionCard } from "@/components/portfolio/PositionCard";
import { usePositions } from "@/hooks/usePositions";

export default function TraderProfileClient() {
  const params = useParams();
  const wallet = params.wallet as string;
  const { positions, stats, loading } = usePositions(wallet);

  return (
    <div>
      <Link
        href="/leaderboard"
        className="text-sm text-degen-muted hover:text-degen-accent transition-colors mb-4 inline-block"
      >
        &larr; Back to Leaderboard
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-display font-bold neon-text">Trader Profile</h1>
      </div>

      <div className="card mb-6">
        <p className="text-xs text-degen-muted mb-1">Wallet</p>
        <p className="font-mono text-sm break-all">{wallet}</p>
      </div>

      <PortfolioStats stats={stats} />

      <h2 className="text-2xl font-display font-bold mt-8 mb-4">Positions</h2>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-degen-accent" />
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-10 text-degen-muted">
          <p>No positions found for this trader.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {positions.map((pos) => (
            <PositionCard key={pos.market_pubkey} position={pos} />
          ))}
        </div>
      )}
    </div>
  );
}
