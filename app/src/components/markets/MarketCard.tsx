import { OddsBar } from "./OddsBar";
import { Countdown } from "./Countdown";
import { API_URL } from "@/lib/constants";
import type { MarketData } from "@/lib/types";

interface MarketCardProps {
  market: MarketData;
}

export function MarketCard({ market }: MarketCardProps) {
  const totalReserve = market.yes_reserve + market.no_reserve;

  return (
    <a href={`/market/${market.pubkey}`}>
      <div className="card cursor-pointer overflow-hidden !p-0 h-full flex flex-col hover:border-degen-accent/50 transition-all">
        {market.image_url && (
          <img
            src={market.image_url.startsWith("http") ? market.image_url : `${API_URL}${market.image_url}`}
            alt=""
            className="w-full h-40 object-cover"
          />
        )}
        <div className="p-4 flex flex-col flex-1">
          <div className="flex justify-between items-start mb-3 flex-1">
            <h3 className="text-sm font-bold leading-snug line-clamp-3">
              {market.question}
            </h3>
            {market.status === "resolved" && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ml-2 ${
                  market.outcome
                    ? "bg-degen-green/20 text-degen-green"
                    : "bg-degen-red/20 text-degen-red"
                }`}
              >
                {market.outcome ? "YES" : "NO"}
              </span>
            )}
            {market.status === "voided" && (
              <span className="px-2 py-0.5 rounded text-xs font-bold shrink-0 ml-2 bg-yellow-500/20 text-yellow-400">
                VOIDED
              </span>
            )}
          </div>

          <div className="mt-auto">
            <OddsBar yesPrice={market.yes_price} noPrice={market.no_price} />

            <div className="flex justify-between items-center mt-3 text-xs text-degen-muted">
              <span className="font-medium">{(totalReserve / 1e9).toFixed(2)} SOL</span>
              <Countdown timestamp={market.resolution_timestamp} />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
