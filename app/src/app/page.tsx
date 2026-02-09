"use client";

import { useState } from "react";
import { MarketCard } from "@/components/markets/MarketCard";
import { useMarkets } from "@/hooks/useMarkets";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "sports", label: "Sports" },
  { value: "crypto", label: "Crypto" },
  { value: "politics", label: "Politics" },
  { value: "entertainment", label: "Entertainment" },
  { value: "misc", label: "Misc" },
];

export default function Home() {
  const [filter, setFilter] = useState<"all" | "open" | "resolved" | "voided">("open");
  const [category, setCategory] = useState("all");
  const { markets, loading } = useMarkets(filter, category);

  return (
    <div>
      <div className="text-center mb-12">
        <h1 className="text-6xl sm:text-7xl font-black tracking-tight mb-4 neon-text leading-tight">
          PvP Prediction Markets
        </h1>
        <p className="text-degen-text-secondary text-lg max-w-xl mx-auto">
          Create markets on anything. Bet against other degens. AI settles it.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
        <div className="flex gap-2">
          {(["open", "resolved", "voided", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-pill ${filter === f ? "filter-pill-active" : ""}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-degen-card border border-degen-border rounded-lg px-3 py-1.5 text-sm text-degen-text focus:outline-none focus:border-degen-accent cursor-pointer"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-degen-accent" />
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-20 text-degen-muted">
          <p className="text-xl mb-2">No markets yet</p>
          <p>Be the first degen to create one</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((market) => (
            <MarketCard key={market.pubkey} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
