"use client";

import { useState } from "react";
import { BettorTable } from "@/components/leaderboard/BettorTable";
import { CreatorTable } from "@/components/leaderboard/CreatorTable";

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"bettors" | "creators">("bettors");

  return (
    <div>
      <h1 className="text-4xl font-display font-bold mb-8 neon-text">Leaderboard</h1>

      <div className="flex justify-center gap-2 mb-8">
        <button
          onClick={() => setTab("bettors")}
          className={`filter-pill ${tab === "bettors" ? "filter-pill-active" : ""}`}
        >
          Top Bettors
        </button>
        <button
          onClick={() => setTab("creators")}
          className={`filter-pill ${tab === "creators" ? "filter-pill-active" : ""}`}
        >
          Top Creators
        </button>
      </div>

      {tab === "bettors" ? <BettorTable /> : <CreatorTable />}
    </div>
  );
}
