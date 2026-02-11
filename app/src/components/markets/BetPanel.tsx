"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useBuy } from "@/hooks/useBuy";
import { useSell } from "@/hooks/useSell";
import { useDealer } from "@/hooks/useDealer";
import { getConfigPda, getPositionPda } from "@/lib/program";
import { PROGRAM_ID } from "@/lib/constants";
import type { MarketData } from "@/lib/types";

const QUICK_AMOUNTS = [0.1, 0.5, 1.0, 5.0];

interface BetPanelProps {
  market: MarketData;
  onTxSuccess?: () => void;
}

export function BetPanel({ market, onTxSuccess }: BetPanelProps) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [side, setSide] = useState<boolean | null>(null);
  const [amount, setAmount] = useState("");
  const { buy, loading } = useBuy();
  const { sell, loading: sellLoading } = useSell();
  const { comment } = useDealer(market.pubkey);

  const [paused, setPaused] = useState(false);
  const [minBetLamports, setMinBetLamports] = useState(0);
  const [bettingCutoffSeconds, setBettingCutoffSeconds] = useState(0);
  const [exitFeeBps, setExitFeeBps] = useState(0);

  // User's current position (shares)
  const [userYesShares, setUserYesShares] = useState(0);
  const [userNoShares, setUserNoShares] = useState(0);
  const [sellSharesInput, setSellSharesInput] = useState("");

  // Fetch config for pause, min bet, cutoff, exit fee
  useEffect(() => {
    async function fetchConfig() {
      try {
        const [configPda] = getConfigPda();
        const info = await connection.getAccountInfo(configPda);
        if (info && info.data.length >= 119) {
          // Config layout offsets (after 8-byte discriminator):
          // 92: paused (1 byte)
          // 93: min_bet_lamports (8 bytes)
          // 101: betting_cutoff_seconds (8 bytes)
          // 109: challenge_period_seconds (8 bytes)
          // 117: exit_fee_bps (2 bytes)
          setPaused(info.data[92] === 1);
          setMinBetLamports(Number(info.data.readBigUInt64LE(93)));
          setBettingCutoffSeconds(Number(info.data.readBigInt64LE(101)));
          setExitFeeBps(info.data.readUInt16LE(117));
        }
      } catch (err) {
        console.error("Failed to fetch config:", err);
      }
    }
    fetchConfig();
  }, [connection]);

  // Fetch user's position on this market
  useEffect(() => {
    if (!publicKey) {
      setUserYesShares(0);
      setUserNoShares(0);
      return;
    }
    async function fetchPosition() {
      try {
        const marketPda = new PublicKey(market.pubkey);
        const [positionPda] = getPositionPda(marketPda, publicKey!);
        const info = await connection.getAccountInfo(positionPda);
        if (info && info.data.length >= 82) {
          // Position layout: 8 disc + 32 market + 32 user + 8 yes_shares + 8 no_shares
          const yes = Number(info.data.readBigUInt64LE(72));
          const no = Number(info.data.readBigUInt64LE(80));
          setUserYesShares(yes);
          setUserNoShares(no);
        } else {
          setUserYesShares(0);
          setUserNoShares(0);
        }
      } catch {
        setUserYesShares(0);
        setUserNoShares(0);
      }
    }
    fetchPosition();
  }, [publicKey, connection, market.pubkey, loading, sellLoading]);

  const now = Math.floor(Date.now() / 1000);
  const cutoffTime = market.resolution_timestamp - bettingCutoffSeconds;
  const isBettingClosed = bettingCutoffSeconds > 0 && now >= cutoffTime;
  const minBetSol = minBetLamports / 1e9;

  // Use API-provided prices (already computed from AMM reserves)
  const yesPrice = market.yes_price ?? 0.5;
  const noPrice = market.no_price ?? 0.5;
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

  const amountNum = parseFloat(amount) || 0;
  const amountLamports = Math.floor(amountNum * 1e9);

  // Calculate potential payout using share-based model
  // Each winning share pays out ~0.97 SOL (after 3% total fees: 2% treasury + 1% creator)
  const PAYOUT_PER_SHARE = 0.97;
  const calcPayout = () => {
    if (side === null || amountNum <= 0) return 0;
    const price = side ? yesPrice : noPrice;
    if (price <= 0) return 0;
    // shares bought = SOL spent / price per share
    const sharesBought = amountNum / price;
    return sharesBought * PAYOUT_PER_SHARE;
  };

  const payoutSol = calcPayout();
  const profitSol = payoutSol - amountNum;
  const profitPct = amountNum > 0 ? (profitSol / amountNum) * 100 : 0;

  const handleBuy = async () => {
    if (!publicKey || side === null || amountLamports <= 0) return;
    await buy(market.market_id, amountLamports, side);
    // Refresh market data from backend after sync completes
    setTimeout(() => onTxSuccess?.(), 1500);
  };

  const handleSell = async (sellSide: boolean) => {
    const sellNum = parseFloat(sellSharesInput) || 0;
    const sellSharesRaw = Math.floor(sellNum * 1e9);
    const maxShares = sellSide ? userYesShares : userNoShares;
    const finalShares = sellSharesRaw > 0 ? Math.min(sellSharesRaw, maxShares) : maxShares;
    if (finalShares <= 0) return;
    try {
      await sell(market.pubkey, finalShares, sellSide, market.market_id);
      setSellSharesInput("");
      setTimeout(() => onTxSuccess?.(), 1500);
    } catch (err) {
      // error logged in hook
    }
  };

  const belowMinBet = minBetLamports > 0 && amountLamports > 0 && amountLamports < minBetLamports;
  const betDisabled = !publicKey || side === null || amountNum <= 0 || loading || paused || isBettingClosed || belowMinBet;
  const hasPosition = userYesShares > 0 || userNoShares > 0;
  const canSell = hasPosition && !isBettingClosed && !paused;

  return (
    <div className="card sticky top-4">
      <h3 className="text-lg font-bold mb-4">Buy Shares</h3>

      {paused && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm font-medium text-center">
          Platform Paused
        </div>
      )}

      {isBettingClosed && !paused && (
        <div className="mb-4 p-3 bg-degen-red/10 border border-degen-red/30 rounded-lg text-degen-red text-sm font-medium text-center">
          Trading Closed — Too close to resolution
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setSide(true)}
          className={`py-3 rounded-lg font-bold transition-all ${
            side === true
              ? "bg-degen-green/30 text-degen-green border-2 border-degen-green"
              : "bg-degen-card border border-degen-border text-degen-muted hover:text-degen-green"
          }`}
        >
          YES {yesPct}c
        </button>
        <button
          onClick={() => setSide(false)}
          className={`py-3 rounded-lg font-bold transition-all ${
            side === false
              ? "bg-degen-red/30 text-degen-red border-2 border-degen-red"
              : "bg-degen-card border border-degen-border text-degen-muted hover:text-degen-red"
          }`}
        >
          NO {noPct}c
        </button>
      </div>

      <div className="mb-4">
        <label className="text-sm text-degen-muted mb-2 block">Amount (SOL)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="input-field"
          min="0"
          step="0.01"
        />
        <div className="flex gap-2 mt-2">
          {QUICK_AMOUNTS.map((qa) => (
            <button
              key={qa}
              onClick={() => setAmount(qa.toString())}
              className="px-3 py-1 text-xs rounded bg-degen-dark border border-degen-border text-degen-muted hover:text-degen-text transition-colors"
            >
              {qa}
            </button>
          ))}
        </div>
        {belowMinBet && (
          <p className="text-xs text-degen-red mt-1">Minimum bet: {minBetSol} SOL</p>
        )}
      </div>

      {side !== null && amountNum > 0 && (
        <div className="mb-4 p-3 bg-degen-dark rounded-lg space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-degen-muted">Share price:</span>
            <span className="font-bold">{((side ? yesPrice : noPrice) * 100).toFixed(1)}c</span>
          </div>
          <div className="flex justify-between">
            <span className="text-degen-muted">Shares received (est):</span>
            <span className="font-bold">{(amountNum / (side ? yesPrice : noPrice)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-degen-muted">If {side ? "YES" : "NO"} wins, you receive:</span>
            <span className="font-bold">{payoutSol.toFixed(4)} SOL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-degen-muted">Profit:</span>
            <span className={`font-bold ${profitSol > 0 ? "text-degen-green" : "text-degen-red"}`}>
              +{profitSol.toFixed(4)} SOL ({profitPct.toFixed(0)}%)
            </span>
          </div>
        </div>
      )}

      <button
        onClick={handleBuy}
        disabled={betDisabled}
        className="btn-primary w-full"
      >
        {!publicKey
          ? "Connect Wallet"
          : loading
            ? "Buying..."
            : side === null
              ? "Pick a Side"
              : `Buy ${amountNum} SOL of ${side ? "YES" : "NO"}`}
      </button>

      {/* Sell Position Section */}
      {hasPosition && (() => {
        const yesSharesSol = userYesShares / 1e9;
        const noSharesSol = userNoShares / 1e9;
        const yesValue = yesSharesSol * yesPrice;
        const noValue = noSharesSol * noPrice;
        const totalValue = yesValue + noValue;
        const yesPayout = yesSharesSol * PAYOUT_PER_SHARE;
        const noPayout = noSharesSol * PAYOUT_PER_SHARE;

        return (
        <div className="mt-6 pt-6 border-t border-degen-border">
          <h4 className="text-sm font-bold mb-3">Your Position</h4>

          {/* Position value summary */}
          <div className="mb-3 p-3 bg-degen-dark rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-degen-muted">Current value:</span>
              <span className="font-bold">{totalValue.toFixed(4)} SOL</span>
            </div>
            {userYesShares > 0 && (
              <div className="flex justify-between">
                <span className="text-degen-muted">If YES wins:</span>
                <span className="font-bold text-degen-green">{yesPayout.toFixed(4)} SOL</span>
              </div>
            )}
            {userNoShares > 0 && (
              <div className="flex justify-between">
                <span className="text-degen-muted">If NO wins:</span>
                <span className="font-bold text-degen-green">{noPayout.toFixed(4)} SOL</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {userYesShares > 0 && (
              <div className="p-3 bg-degen-dark rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-degen-green font-bold text-sm">YES</span>
                    <span className="text-sm text-degen-muted ml-2">
                      {yesSharesSol.toFixed(4)} shares
                    </span>
                  </div>
                  {canSell && (
                    <button
                      onClick={() => handleSell(true)}
                      disabled={sellLoading}
                      className="px-3 py-1 text-xs font-bold rounded bg-degen-red/20 text-degen-red border border-degen-red/30 hover:bg-degen-red/30 transition-colors"
                    >
                      {sellLoading ? "Selling..." : `Sell for ~${yesValue.toFixed(4)} SOL`}
                    </button>
                  )}
                </div>
                <div className="text-xs text-degen-muted">
                  Value: {yesValue.toFixed(4)} SOL @ {(yesPrice * 100).toFixed(1)}c/share
                </div>
              </div>
            )}
            {userNoShares > 0 && (
              <div className="p-3 bg-degen-dark rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-degen-red font-bold text-sm">NO</span>
                    <span className="text-sm text-degen-muted ml-2">
                      {noSharesSol.toFixed(4)} shares
                    </span>
                  </div>
                  {canSell && (
                    <button
                      onClick={() => handleSell(false)}
                      disabled={sellLoading}
                      className="px-3 py-1 text-xs font-bold rounded bg-degen-red/20 text-degen-red border border-degen-red/30 hover:bg-degen-red/30 transition-colors"
                    >
                      {sellLoading ? "Selling..." : `Sell for ~${noValue.toFixed(4)} SOL`}
                    </button>
                  )}
                </div>
                <div className="text-xs text-degen-muted">
                  Value: {noValue.toFixed(4)} SOL @ {(noPrice * 100).toFixed(1)}c/share
                </div>
              </div>
            )}
            {canSell && (
              <div>
                <label className="text-xs text-degen-muted mb-1 block">
                  Shares to sell — leave empty to sell all
                </label>
                <input
                  type="number"
                  value={sellSharesInput}
                  onChange={(e) => setSellSharesInput(e.target.value)}
                  placeholder="All"
                  className="input-field text-sm"
                  min="0"
                  step="any"
                />
                <p className="text-xs text-degen-muted mt-1">
                  Swap fee: {exitFeeBps / 100}% · Actual SOL received may vary due to slippage
                </p>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {comment && (
        <div className="mt-4 p-3 bg-degen-dark rounded-lg border border-degen-border">
          <p className="text-xs text-degen-accent mb-1">AI Dealer</p>
          <p className="text-sm italic">&ldquo;{comment}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
