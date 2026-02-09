"use client";

import { useParams } from "next/navigation";
import { CreatorStats } from "@/components/creator/CreatorStats";
import { CreatorMarkets } from "@/components/creator/CreatorMarkets";
import { useCreatorProfile } from "@/hooks/useCreatorProfile";

export default function CreatorPage() {
  const params = useParams();
  const wallet = params.wallet as string;
  const { profile, markets, loading } = useCreatorProfile(wallet);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-degen-accent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-degen-muted">
        <p className="text-xl">Creator not found</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-display font-bold mb-2 neon-text">Creator Profile</h1>
      <p className="font-mono text-degen-muted mb-8">
        {wallet.slice(0, 4)}...{wallet.slice(-4)}
        <button
          onClick={() => navigator.clipboard.writeText(wallet)}
          className="ml-2 text-degen-accent hover:text-degen-accent/80 text-sm"
        >
          Copy
        </button>
      </p>

      <CreatorStats profile={profile} />

      <h2 className="text-2xl font-display font-bold mt-8 mb-4">Markets by this Creator</h2>
      <CreatorMarkets markets={markets} />
    </div>
  );
}
