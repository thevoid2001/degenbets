"use client";

import { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants";

export function useDealer(marketPubkey: string) {
  const [comment, setComment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!marketPubkey) return;

    fetch(`${API_URL}/api/markets/${marketPubkey}/dealer`)
      .then((r) => r.json())
      .then((data) => setComment(data.comment || null))
      .catch(() => setComment(null))
      .finally(() => setLoading(false));
  }, [marketPubkey]);

  return { comment, loading };
}
