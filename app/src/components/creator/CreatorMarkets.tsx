import { MarketCard } from "@/components/markets/MarketCard";
import type { MarketData } from "@/lib/types";

interface CreatorMarketsProps {
  markets: MarketData[];
}

export function CreatorMarkets({ markets }: CreatorMarketsProps) {
  if (markets.length === 0) {
    return (
      <div className="text-center py-10 text-degen-muted">
        <p>No markets created yet</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {markets.map((market) => (
        <MarketCard key={market.pubkey} market={market} />
      ))}
    </div>
  );
}
