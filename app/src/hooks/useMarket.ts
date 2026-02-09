"use client";

import { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants";
import type { MarketData, PositionData } from "@/lib/types";

export function useMarket(id: string) {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (!id) return;
    setLoading(true);

    Promise.all([
      fetch(`${API_URL}/api/markets/${id}`).then((r) => r.json()),
      fetch(`${API_URL}/api/markets/${id}/positions`).then((r) => r.json()),
    ])
      .then(([marketData, posData]) => {
        setMarket(marketData.market || null);
        setPositions(posData.positions || []);
      })
      .catch(() => {
        setMarket(null);
        setPositions([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { market, positions, loading, refetch: fetchData };
}
