"use client";

import { MarketForm } from "@/components/markets/MarketForm";

export default function CreateMarketPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-display font-bold mb-2 neon-text">Create a Market</h1>
        <p className="text-degen-muted">
          Ask a question. Provide a source. Let degens bet on it.
        </p>
      </div>
      <MarketForm />
    </div>
  );
}
