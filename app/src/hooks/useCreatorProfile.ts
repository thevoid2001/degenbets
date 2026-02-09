"use client";

import { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants";
import type { CreatorProfileData, MarketData } from "@/lib/types";

export function useCreatorProfile(wallet: string) {
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);

    Promise.all([
      fetch(`${API_URL}/api/creator/${wallet}/profile`).then((r) => r.json()),
      fetch(`${API_URL}/api/creator/${wallet}/markets`).then((r) => r.json()),
    ])
      .then(([profileData, marketsData]) => {
        setProfile(profileData.profile || null);
        setMarkets(marketsData.markets || []);
      })
      .catch(() => {
        setProfile(null);
        setMarkets([]);
      })
      .finally(() => setLoading(false));
  }, [wallet]);

  return { profile, markets, loading };
}
