"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/constants";
import type { CreatorProfileData } from "@/lib/types";

export function CreatorTable() {
  const [creators, setCreators] = useState<CreatorProfileData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/leaderboard/creators`)
      .then((r) => r.json())
      .then((data) => setCreators(data.leaderboard || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-degen-accent" />
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-degen-muted text-left border-b border-degen-border">
            <th className="py-3 px-2">#</th>
            <th className="py-3 px-2">Address</th>
            <th className="py-3 px-2 text-right">Markets</th>
            <th className="py-3 px-2 text-right">Volume</th>
            <th className="py-3 px-2 text-right">Fees Earned</th>
            <th className="py-3 px-2 text-right">Rep</th>
          </tr>
        </thead>
        <tbody>
          {creators.map((c, i) => (
            <tr
              key={c.wallet}
              className="border-b border-degen-border/50 hover:bg-degen-card/50"
            >
              <td className="py-3 px-2 font-bold">{i + 1}</td>
              <td className="py-3 px-2 font-mono">
                <a
                  href={`/creator/${c.wallet}`}
                  className="text-degen-accent hover:underline"
                >
                  {c.wallet.slice(0, 4)}...{c.wallet.slice(-4)}
                </a>
              </td>
              <td className="py-3 px-2 text-right">{c.markets_created}</td>
              <td className="py-3 px-2 text-right">
                {(c.total_volume / 1e9).toFixed(1)} SOL
              </td>
              <td className="py-3 px-2 text-right text-degen-green">
                {(c.total_fees_earned / 1e9).toFixed(2)} SOL
              </td>
              <td className="py-3 px-2 text-right">
                <span className="text-yellow-400">&#9733;</span> {c.reputation_score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {creators.length === 0 && (
        <p className="text-center py-8 text-degen-muted">No creators yet</p>
      )}
    </div>
  );
}
