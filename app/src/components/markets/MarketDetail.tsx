"use client";

import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { OddsBar } from "./OddsBar";
import { Countdown } from "./Countdown";
import { SourceLink } from "./SourceLink";
import { CreatorBadge } from "@/components/creator/CreatorBadge";
import { API_URL } from "@/lib/constants";
import { getConfigPda, getMarketPda } from "@/lib/program";
import type { MarketData } from "@/lib/types";

interface MarketDetailProps {
  market: MarketData;
}

export function MarketDetail({ market }: MarketDetailProps) {
  const { connection } = useConnection();
  const totalPool = Number(market.yes_pool) + Number(market.no_pool);

  const [challengeEnd, setChallengeEnd] = useState<number | null>(null);

  // For resolved markets, fetch resolved_at + challenge_period from on-chain
  useEffect(() => {
    if (market.status !== "resolved") return;
    async function fetchChallengePeriod() {
      try {
        const [configPda] = getConfigPda();
        const configInfo = await connection.getAccountInfo(configPda);
        if (!configInfo || configInfo.data.length < 117) return;

        // offset 109: challenge_period_seconds (8 bytes i64 LE)
        const challengePeriodSeconds = Number(configInfo.data.readBigInt64LE(109));

        const [marketPda] = getMarketPda(market.market_id);
        const marketInfo = await connection.getAccountInfo(marketPda);
        if (!marketInfo) return;

        // Dynamically parse Borsh layout to find resolved_at
        const data = marketInfo.data;
        let offset = 8; // Anchor discriminator
        offset += 32; // creator (Pubkey)
        const questionLen = data.readUInt32LE(offset);
        offset += 4 + questionLen; // question string (len prefix + data)
        const sourceLen = data.readUInt32LE(offset);
        offset += 4 + sourceLen; // resolution_source string
        offset += 8; // yes_pool
        offset += 8; // no_pool
        offset += 8; // resolution_timestamp
        offset += 1; // status (enum)
        // Option<bool> outcome — 1 byte tag + 1 byte value if Some
        const outcomeTag = data[offset];
        offset += 1;
        if (outcomeTag === 1) offset += 1;
        offset += 1; // creator_fee_claimed
        offset += 1; // treasury_fee_claimed
        offset += 8; // market_id
        // resolved_at is now at current offset
        const resolvedAt = Number(data.readBigInt64LE(offset));
        if (resolvedAt > 0) {
          setChallengeEnd(resolvedAt + challengePeriodSeconds);
        }
      } catch (err) {
        console.error("Failed to fetch challenge period:", err);
      }
    }
    fetchChallengePeriod();
  }, [connection, market.status, market.market_id]);

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-2">
        <h1 className="text-2xl font-display font-bold">{market.question}</h1>
        {market.status !== "open" && (
          <span
            className={`px-3 py-1 rounded-lg text-sm font-bold ${
              market.status === "resolved"
                ? market.outcome
                  ? "bg-degen-green/20 text-degen-green"
                  : "bg-degen-red/20 text-degen-red"
                : "bg-yellow-500/20 text-yellow-400"
            }`}
          >
            {market.status === "resolved"
              ? market.outcome
                ? "RESOLVED: YES"
                : "RESOLVED: NO"
              : "VOIDED"}
          </span>
        )}
      </div>

      <div className="mb-6">
        <CreatorBadge wallet={market.creator} />
      </div>

      {market.image_url && (
        <div className="mb-6">
          <img
            src={`${API_URL}${market.image_url}`}
            alt=""
            className="w-full max-h-64 object-cover rounded-lg border border-degen-border"
          />
        </div>
      )}

      <OddsBar yesPool={market.yes_pool} noPool={market.no_pool} />

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="stat-box">
          <p className="text-degen-muted text-xs mb-1">Total Pool</p>
          <p className="text-lg font-bold">{(totalPool / 1e9).toFixed(2)} SOL</p>
        </div>
        <div className="stat-box">
          <p className="text-degen-muted text-xs mb-1">Resolves</p>
          <p className="text-lg font-bold">
            <Countdown timestamp={market.resolution_timestamp} />
          </p>
        </div>
        <div className="stat-box">
          <p className="text-degen-muted text-xs mb-1">Source</p>
          <SourceLink url={market.resolution_source} />
        </div>
      </div>

      {market.status === "resolved" && challengeEnd !== null && (
        <div className="mt-6 p-4 bg-degen-dark rounded-lg border border-degen-border">
          {Math.floor(Date.now() / 1000) < challengeEnd ? (
            <>
              <p className="text-xs text-yellow-400 mb-1">Challenge Period Active</p>
              <p className="text-sm">
                Resolution finalizes in{" "}
                <span className="font-bold text-yellow-400">
                  <Countdown timestamp={challengeEnd} />
                </span>
              </p>
              <p className="text-xs text-degen-muted mt-1">
                Claims are locked until the challenge period ends.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-degen-green mb-1">Challenge Period Ended</p>
              <p className="text-sm text-degen-green font-medium">Claims are open</p>
            </>
          )}
        </div>
      )}

      {market.ai_reasoning && (
        <div className="mt-6 p-4 bg-degen-dark rounded-lg border border-degen-border">
          <p className="text-xs text-degen-muted mb-1">AI Resolution Reasoning</p>
          <p className="text-sm">{market.ai_reasoning}</p>
        </div>
      )}
    </div>
  );
}
