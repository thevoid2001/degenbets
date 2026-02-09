"use client";

import { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants";
import type { MarketData } from "@/lib/types";

export function useMarkets(filter: string = "all", category: string = "all") {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (category !== "all") params.set("category", category);
    const qs = params.toString() ? `?${params.toString()}` : "";
    fetch(`${API_URL}/api/markets${qs}`)
      .then((r) => r.json())
      .then((data) => {
        setMarkets(data.markets || []);
      })
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  }, [filter, category]);

  return { markets, loading };
}
