"use client";

import { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants";
import type { PositionData, UserStatsData } from "@/lib/types";

export function usePositions(wallet?: string) {
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (!wallet) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/user/${wallet}/positions`).then((r) => r.json()),
      fetch(`${API_URL}/api/user/${wallet}/stats`).then((r) => r.json()),
    ])
      .then(([posData, statsData]) => {
        setPositions(posData.positions || []);
        setStats(statsData.stats || null);
      })
      .catch(() => {
        setPositions([]);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [wallet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { positions, stats, loading, refetch: fetchData };
}
