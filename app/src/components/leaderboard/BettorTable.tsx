"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/constants";

interface BettorEntry {
  rank: number;
  wallet: string;
  total_wagered: number;
  total_won: number;
  total_lost: number;
  markets_participated: number;
  markets_won: number;
  pnl: number;
}

type SortKey = "pnl" | "volume" | "wins" | "winrate";

export function BettorTable() {
  const [bettors, setBettors] = useState<BettorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("pnl");

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/leaderboard/bettors?sort=${sort}`)
      .then((r) => r.json())
      .then((data) => setBettors(data.leaderboard || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sort]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-degen-accent" />
      </div>
    );
  }

  const SortHeader = ({
    label,
    sortKey,
    align = "right",
  }: {
    label: string;
    sortKey: SortKey;
    align?: "left" | "right";
  }) => (
    <th
      className={`py-3 px-2 cursor-pointer hover:text-degen-accent transition-colors ${
        align === "right" ? "text-right" : "text-left"
      } ${sort === sortKey ? "text-degen-accent" : ""}`}
      onClick={() => setSort(sortKey)}
    >
      {label} {sort === sortKey ? "▼" : ""}
    </th>
  );

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-degen-muted text-left border-b border-degen-border">
            <th className="py-3 px-2">#</th>
            <th className="py-3 px-2">Trader</th>
            <SortHeader label="Volume" sortKey="volume" />
            <SortHeader label="P&L" sortKey="pnl" />
            <SortHeader label="Wins" sortKey="wins" />
            <SortHeader label="Win Rate" sortKey="winrate" />
          </tr>
        </thead>
        <tbody>
          {bettors.map((b) => {
            const winRate =
              b.markets_participated > 0
                ? ((b.markets_won / b.markets_participated) * 100).toFixed(0)
                : "0";
            return (
              <tr
                key={b.wallet}
                className="border-b border-degen-border/50 hover:bg-degen-card/50 transition-colors"
              >
                <td className="py-3 px-2 font-bold">{b.rank}</td>
                <td className="py-3 px-2 font-mono">
                  <a
                    href={`/trader/${b.wallet}`}
                    className="text-degen-accent hover:underline"
                  >
                    {b.wallet.slice(0, 4)}...{b.wallet.slice(-4)}
                  </a>
                </td>
                <td className="py-3 px-2 text-right">
                  {(b.total_wagered / 1e9).toFixed(2)} SOL
                </td>
                <td
                  className={`py-3 px-2 text-right font-bold ${
                    b.pnl >= 0 ? "text-degen-green" : "text-degen-red"
                  }`}
                >
                  {b.pnl >= 0 ? "+" : ""}
                  {(b.pnl / 1e9).toFixed(2)} SOL
                </td>
                <td className="py-3 px-2 text-right text-degen-green">
                  {b.markets_won}
                </td>
                <td className="py-3 px-2 text-right">{winRate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {bettors.length === 0 && (
        <p className="text-center py-8 text-degen-muted">No traders yet. Place some bets!</p>
      )}
    </div>
  );
}
