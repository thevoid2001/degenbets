import type { CreatorProfileData } from "@/lib/types";

interface CreatorStatsProps {
  profile: CreatorProfileData;
}

export function CreatorStats({ profile }: CreatorStatsProps) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <span className="text-2xl text-yellow-400">&#9733;</span>
        <span className="text-3xl font-bold">{profile.reputation_score}</span>
        <span className="text-degen-muted">Reputation</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="stat-box">
          <p className="text-2xl font-bold">{profile.markets_created}</p>
          <p className="text-xs text-degen-muted">Markets</p>
        </div>
        <div className="stat-box">
          <p className="text-2xl font-bold">{profile.markets_resolved}</p>
          <p className="text-xs text-degen-muted">Resolved</p>
        </div>
        <div className="stat-box">
          <p className="text-2xl font-bold text-degen-red">{profile.markets_voided}</p>
          <p className="text-xs text-degen-muted">Voided</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="stat-box">
          <p className="text-xl font-bold">
            {(profile.total_volume / 1e9).toFixed(1)} SOL
          </p>
          <p className="text-xs text-degen-muted">Total Volume</p>
        </div>
        <div className="stat-box">
          <p className="text-xl font-bold text-degen-green">
            {(profile.total_fees_earned / 1e9).toFixed(2)} SOL
          </p>
          <p className="text-xs text-degen-muted">Fees Earned</p>
        </div>
      </div>
    </div>
  );
}
