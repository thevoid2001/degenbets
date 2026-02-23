"use client";

import { useState, useMemo, useCallback } from "react";
import { useMarkets } from "./useMarkets";
import type { MarketData } from "@/lib/types";

export function useSwipeMarkets() {
  const { markets, loading } = useMarkets("open");
  const [index, setIndex] = useState(0);

  // Sort by most recent first
  const sorted = useMemo(
    () => [...markets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [markets]
  );

  const currentMarket: MarketData | null = sorted[index] ?? null;

  // Next 2 markets for rendering stacked cards behind
  const nextMarkets: MarketData[] = useMemo(
    () => sorted.slice(index + 1, index + 3),
    [sorted, index]
  );

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  const skip = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  const exhausted = !loading && index >= sorted.length;

  return { currentMarket, nextMarkets, advance, skip, loading, exhausted };
}
