"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useClaimWinnings } from "@/hooks/useClaimWinnings";
import { useClaimCreatorFee } from "@/hooks/useClaimCreatorFee";
import { useToast } from "@/components/common/ToastProvider";
import { getConfigPda, getPositionPda, getMarketPda } from "@/lib/program";
import type { MarketData } from "@/lib/types";

interface ClaimPanelProps {
  market: MarketData;
  onTxSuccess?: () => void;
}

export function ClaimPanel({ market, onTxSuccess }: ClaimPanelProps) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { claimWinnings, claimRefund, loading: claimLoading } = useClaimWinnings();
  const { claimCreatorFee, loading: creatorClaimLoading } = useClaimCreatorFee();

  const [userYesShares, setUserYesShares] = useState(0);
  const [userNoShares, setUserNoShares] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const [challengeEnd, setChallengeEnd] = useState<number | null>(null);
  const [creatorFeeClaimed, setCreatorFeeClaimed] = useState(false);
  const [totalMinted, setTotalMinted] = useState(0);
  const [treasuryFee, setTreasuryFee] = useState(0);
  const [creatorFee, setCreatorFee] = useState(0);
  const [yesReserve, setYesReserve] = useState(0);
  const [noReserve, setNoReserve] = useState(0);
  const { addToast } = useToast();
  const [txResult, setTxResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const isCreator = publicKey?.toBase58() === market.creator;
  const isResolved = market.status === "resolved";
  const isVoided = market.status === "voided";

  // Fetch on-chain data: position, market state, challenge period
  useEffect(() => {
    if (!publicKey) return;

    async function fetchData() {
      try {
        const marketPda = new PublicKey(market.pubkey);

        // Fetch position
        const [positionPda] = getPositionPda(marketPda, publicKey!);
        const posInfo = await connection.getAccountInfo(positionPda);
        if (posInfo && posInfo.data.length >= 89) {
          setUserYesShares(Number(posInfo.data.readBigUInt64LE(72)));
          setUserNoShares(Number(posInfo.data.readBigUInt64LE(80)));
          setClaimed(posInfo.data[88] === 1);
        }

        // Fetch market account for AMM state + fee claimed flags
        const marketInfo = await connection.getAccountInfo(marketPda);
        if (marketInfo) {
          const data = marketInfo.data;
          let offset = 8; // discriminator
          offset += 32; // creator
          const qLen = data.readUInt32LE(offset);
          offset += 4 + qLen;
          const sLen = data.readUInt32LE(offset);
          offset += 4 + sLen;

          const yr = Number(data.readBigUInt64LE(offset)); offset += 8;
          const nr = Number(data.readBigUInt64LE(offset)); offset += 8;
          const tm = Number(data.readBigUInt64LE(offset)); offset += 8;
          offset += 8; // initial_liquidity
          offset += 2; // swap_fee_bps
          setYesReserve(yr);
          setNoReserve(nr);
          setTotalMinted(tm);

          offset += 8; // resolution_timestamp
          offset += 1; // status
          const outcomeTag = data[offset]; offset += 1;
          if (outcomeTag === 1) offset += 1;
          setCreatorFeeClaimed(data[offset] === 1); offset += 1;
          offset += 1; // treasury_fee_claimed
          offset += 8; // market_id
          const resolvedAt = Number(data.readBigInt64LE(offset)); offset += 8;
          offset += 1; // bump
          const tf = Number(data.readBigUInt64LE(offset)); offset += 8;
          const cf = Number(data.readBigUInt64LE(offset)); offset += 8;
          setTreasuryFee(tf);
          setCreatorFee(cf);

          // Fetch challenge period from config
          if (isResolved && resolvedAt > 0) {
            const [configPda] = getConfigPda();
            const configInfo = await connection.getAccountInfo(configPda);
            if (configInfo && configInfo.data.length >= 117) {
              const challengeSecs = Number(configInfo.data.readBigInt64LE(109));
              setChallengeEnd(resolvedAt + challengeSecs);
            }
          }
        }
      } catch (err) {
        console.error("ClaimPanel fetch error:", err);
      }
    }
    fetchData();
  }, [publicKey, connection, market.pubkey, market.market_id, market.status, claimLoading, creatorClaimLoading]);

  const now = Math.floor(Date.now() / 1000);
  const challengeActive = challengeEnd !== null && now < challengeEnd;
  const canClaim = !challengeActive;

  // Calculate user's payout
  const isWinner =
    isResolved &&
    market.outcome !== null &&
    ((market.outcome && userYesShares > 0) || (!market.outcome && userNoShares > 0));

  const calcWinnings = () => {
    if (!isResolved || market.outcome === null || totalMinted === 0) return 0;
    const prizePool = totalMinted - treasuryFee - creatorFee;
    const winningShares = market.outcome ? userYesShares : userNoShares;
    return (winningShares / totalMinted) * prizePool;
  };

  const calcRefund = () => {
    const totalShares = userYesShares + userNoShares;
    return Math.floor(totalShares / 2);
  };

  const calcCreatorPayout = () => {
    if (!isResolved || market.outcome === null || totalMinted === 0) return 0;
    const prizePool = totalMinted - treasuryFee - creatorFee;
    const winningReserve = market.outcome ? yesReserve : noReserve;
    const lpValue = (winningReserve / totalMinted) * prizePool;
    return creatorFee + lpValue;
  };

  const winningsLamports = calcWinnings();
  const refundLamports = calcRefund();
  const creatorPayoutLamports = calcCreatorPayout();

  const hasPosition = userYesShares > 0 || userNoShares > 0;
  const isLoser = isResolved && hasPosition && !isWinner;

  const handleClaimWinnings = async () => {
    setTxResult(null);
    try {
      await claimWinnings(market.pubkey, market.market_id);
      setTxResult({ type: "success", msg: "Winnings claimed!" });
      addToast("success", `Claimed ${(winningsLamports / 1e9).toFixed(4)} SOL`);
      onTxSuccess?.();
    } catch (err: any) {
      const msg = err?.message?.slice(0, 100) || "Claim failed";
      setTxResult({ type: "error", msg });
      addToast("error", msg);
    }
  };

  const handleClaimRefund = async () => {
    setTxResult(null);
    try {
      await claimRefund(market.pubkey, market.market_id);
      setTxResult({ type: "success", msg: "Refund claimed!" });
      addToast("success", `Refund claimed: ${(refundLamports / 1e9).toFixed(4)} SOL`);
      onTxSuccess?.();
    } catch (err: any) {
      const msg = err?.message?.slice(0, 100) || "Refund failed";
      setTxResult({ type: "error", msg });
      addToast("error", msg);
    }
  };

  const handleClaimCreatorFee = async () => {
    setTxResult(null);
    try {
      await claimCreatorFee(market.pubkey);
      setTxResult({ type: "success", msg: "Creator fee + LP return claimed!" });
      addToast("success", `Creator earnings claimed: ${(creatorPayoutLamports / 1e9).toFixed(4)} SOL`);
      onTxSuccess?.();
    } catch (err: any) {
      const msg = err?.message?.slice(0, 100) || "Claim failed";
      setTxResult({ type: "error", msg });
      addToast("error", msg);
    }
  };

  return (
    <div className="card sticky top-4 space-y-4">
      <h3 className="text-lg font-bold">
        {isResolved
          ? `Resolved: ${market.outcome ? "YES" : "NO"}`
          : "Market Voided"}
      </h3>

      {/* Challenge period warning */}
      {isResolved && challengeActive && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
          <p className="text-yellow-400 font-medium">Challenge Period Active</p>
          <p className="text-degen-muted text-xs mt-1">
            Claims unlock in {formatTimeRemaining(challengeEnd! - now)}
          </p>
        </div>
      )}

      {/* User position */}
      {publicKey && hasPosition && (
        <div className="p-3 bg-degen-dark rounded-lg space-y-2">
          <p className="text-sm font-medium">Your Position</p>
          {userYesShares > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-degen-green">YES shares</span>
              <span className="font-bold">{(userYesShares / 1e9).toFixed(4)}</span>
            </div>
          )}
          {userNoShares > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-degen-red">NO shares</span>
              <span className="font-bold">{(userNoShares / 1e9).toFixed(4)}</span>
            </div>
          )}

          {/* Outcome display */}
          {isResolved && !claimed && (
            <div className="pt-2 border-t border-degen-border">
              {isWinner ? (
                <div className="flex justify-between text-sm">
                  <span className="text-degen-green font-medium">You won!</span>
                  <span className="text-degen-green font-bold">
                    {(winningsLamports / 1e9).toFixed(4)} SOL
                  </span>
                </div>
              ) : (
                <p className="text-sm text-degen-red">
                  Your {market.outcome ? "NO" : "YES"} shares are worthless
                </p>
              )}
            </div>
          )}

          {isVoided && !claimed && (
            <div className="pt-2 border-t border-degen-border">
              <div className="flex justify-between text-sm">
                <span className="text-degen-muted">Refund</span>
                <span className="font-bold">{(refundLamports / 1e9).toFixed(4)} SOL</span>
              </div>
            </div>
          )}

          {claimed && (
            <div className="pt-2 border-t border-degen-border">
              <p className="text-sm text-degen-green">Already claimed</p>
            </div>
          )}
        </div>
      )}

      {/* Claim buttons */}
      {publicKey && !claimed && hasPosition && (
        <>
          {isResolved && isWinner && (
            <button
              onClick={handleClaimWinnings}
              disabled={claimLoading || !canClaim}
              className="w-full py-3 rounded-lg font-bold transition-all bg-degen-green/20 text-degen-green border border-degen-green/50 hover:bg-degen-green/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claimLoading
                ? "Claiming..."
                : !canClaim
                  ? "Locked — Challenge Period"
                  : `Claim ${(winningsLamports / 1e9).toFixed(4)} SOL`}
            </button>
          )}

          {isVoided && (
            <button
              onClick={handleClaimRefund}
              disabled={claimLoading}
              className="w-full py-3 rounded-lg font-bold transition-all bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claimLoading
                ? "Claiming..."
                : `Claim Refund — ${(refundLamports / 1e9).toFixed(4)} SOL`}
            </button>
          )}
        </>
      )}

      {/* Loser message */}
      {publicKey && isLoser && !claimed && (
        <p className="text-sm text-degen-muted text-center">
          Better luck next time, degen.
        </p>
      )}

      {/* No position */}
      {publicKey && !hasPosition && !isCreator && (
        <p className="text-sm text-degen-muted text-center">
          You have no position in this market.
        </p>
      )}

      {/* Creator fee claim */}
      {publicKey && isCreator && isResolved && (
        <div className="pt-4 border-t border-degen-border space-y-3">
          <p className="text-sm font-medium">Creator Earnings</p>
          <div className="p-3 bg-degen-dark rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-degen-muted">Creator fee (1%)</span>
              <span className="font-bold">{(creatorFee / 1e9).toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-degen-muted">LP return</span>
              <span className="font-bold">
                {((creatorPayoutLamports - creatorFee) / 1e9).toFixed(4)} SOL
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-degen-border">
              <span className="font-medium">Total</span>
              <span className="font-bold text-degen-accent">
                {(creatorPayoutLamports / 1e9).toFixed(4)} SOL
              </span>
            </div>
          </div>

          {creatorFeeClaimed ? (
            <p className="text-sm text-degen-green text-center">Creator fee claimed</p>
          ) : (
            <button
              onClick={handleClaimCreatorFee}
              disabled={creatorClaimLoading || !canClaim}
              className="w-full py-3 rounded-lg font-bold transition-all bg-degen-accent/20 text-degen-accent border border-degen-accent/50 hover:bg-degen-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatorClaimLoading
                ? "Claiming..."
                : !canClaim
                  ? "Locked — Challenge Period"
                  : `Claim ${(creatorPayoutLamports / 1e9).toFixed(4)} SOL`}
            </button>
          )}
        </div>
      )}

      {/* Not connected */}
      {!publicKey && (
        <p className="text-sm text-degen-muted text-center">
          Connect wallet to view your position
        </p>
      )}

      {/* Transaction result */}
      {txResult && (
        <div
          className={`p-3 rounded-lg text-sm font-medium text-center ${
            txResult.type === "success"
              ? "bg-degen-green/10 border border-degen-green/30 text-degen-green"
              : "bg-degen-red/10 border border-degen-red/30 text-degen-red"
          }`}
        >
          {txResult.msg}
        </div>
      )}
    </div>
  );
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "now";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
