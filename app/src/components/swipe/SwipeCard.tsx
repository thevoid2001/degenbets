"use client";

import { OddsBar } from "@/components/markets/OddsBar";
import { Countdown } from "@/components/markets/Countdown";
import { API_URL } from "@/lib/constants";
import type { MarketData } from "@/lib/types";

interface SwipeCardProps {
  market: MarketData;
  style?: React.CSSProperties;
  className?: string;
  overlayDirection?: "left" | "right" | null;
  overlayOpacity?: number;
  bind?: Record<string, (e: any) => void>;
}

const categoryColors: Record<string, string> = {
  sports: "bg-blue-500/20 text-blue-400",
  crypto: "bg-orange-500/20 text-orange-400",
  politics: "bg-purple-500/20 text-purple-400",
  entertainment: "bg-pink-500/20 text-pink-400",
  misc: "bg-gray-500/20 text-gray-400",
};

export function SwipeCard({
  market,
  style,
  className = "",
  overlayDirection,
  overlayOpacity = 0,
  bind,
}: SwipeCardProps) {
  const totalLiquidity = market.total_minted || 0;
  const cat = market.category || "misc";

  return (
    <div className={`swipe-card ${className}`} style={style} {...bind}>
      <div className="card !p-0 overflow-hidden relative">
        {/* YES/NO swipe overlays */}
        <div
          className="swipe-overlay swipe-overlay-yes rounded-xl z-10"
          style={{ opacity: overlayDirection === "right" ? overlayOpacity : 0 }}
        >
          YES
        </div>
        <div
          className="swipe-overlay swipe-overlay-no rounded-xl z-10"
          style={{ opacity: overlayDirection === "left" ? overlayOpacity : 0 }}
        >
          NO
        </div>

        {/* Market image */}
        {market.image_url ? (
          <img
            src={market.image_url.startsWith("http") ? market.image_url : `${API_URL}${market.image_url}`}
            alt=""
            className="w-full h-48 object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-degen-accent/20 via-degen-card to-degen-accent-alt/20 flex items-center justify-center">
            <svg className="w-16 h-16 text-degen-muted/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Category badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${categoryColors[cat]}`}>
              {cat}
            </span>
          </div>

          {/* Question */}
          <h2 className="text-lg font-bold leading-snug line-clamp-3">
            {market.question}
          </h2>

          {/* Odds bar */}
          <OddsBar yesPrice={market.yes_price} noPrice={market.no_price} />

          {/* Footer stats */}
          <div className="flex justify-between items-center text-sm text-degen-muted">
            <span className="font-medium">
              {(totalLiquidity / 1e9).toFixed(2)} SOL
            </span>
            <Countdown timestamp={market.resolution_timestamp} />
          </div>
        </div>
      </div>
    </div>
  );
}
