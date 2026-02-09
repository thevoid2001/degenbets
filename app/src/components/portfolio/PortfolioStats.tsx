import type { UserStatsData } from "@/lib/types";

interface PortfolioStatsProps {
  stats: UserStatsData | null;
}

export function PortfolioStats({ stats }: PortfolioStatsProps) {
  if (!stats) return null;

  const pnl = stats.total_won - stats.total_lost;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="stat-box">
        <p className="text-xl font-bold">{(stats.total_wagered / 1e9).toFixed(2)} SOL</p>
        <p className="text-xs text-degen-muted">Total Wagered</p>
      </div>
      <div className="stat-box">
        <p className={`text-xl font-bold ${pnl >= 0 ? "text-degen-green" : "text-degen-red"}`}>
          {pnl >= 0 ? "+" : ""}{(pnl / 1e9).toFixed(2)} SOL
        </p>
        <p className="text-xs text-degen-muted">P&L</p>
      </div>
      <div className="stat-box">
        <p className="text-xl font-bold">{stats.markets_participated}</p>
        <p className="text-xs text-degen-muted">Markets</p>
      </div>
      <div className="stat-box">
        <p className="text-xl font-bold text-degen-green">{stats.markets_won}</p>
        <p className="text-xs text-degen-muted">Wins</p>
      </div>
    </div>
  );
}
