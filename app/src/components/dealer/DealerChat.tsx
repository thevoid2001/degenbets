"use client";

import { useDealer } from "@/hooks/useDealer";

interface DealerChatProps {
  marketPubkey: string;
}

export function DealerChat({ marketPubkey }: DealerChatProps) {
  const { comment, loading } = useDealer(marketPubkey);

  if (loading || !comment) return null;

  return (
    <div className="card border-degen-accent/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-degen-accent font-bold text-sm">AI Dealer</span>
      </div>
      <p className="text-sm italic text-degen-muted">&ldquo;{comment}&rdquo;</p>
    </div>
  );
}
