"use client";

import { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants";

interface Trade {
  id: number;
  side: boolean;
  action: string;
  sol_amount: number;
  shares: number;
  price_after: number;
  timestamp: string;
  user: string;
}

interface PriceChartProps {
  marketId: number;
  currentYesPrice: number;
}

export function PriceChart({ marketId, currentYesPrice }: PriceChartProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; trade: Trade } | null>(null);

  useEffect(() => {
    async function fetchTrades() {
      try {
        const res = await fetch(`${API_URL}/api/trades/${marketId}`);
        const data = await res.json();
        setTrades(data.trades || []);
      } catch {
        setTrades([]);
      } finally {
        setLoading(false);
      }
    }
    fetchTrades();
  }, [marketId]);

  // Build price points: start at 0.5, then each trade's price_after
  const pricePoints: { price: number; timestamp: string; trade?: Trade }[] = [];

  if (trades.length > 0) {
    // Starting point
    pricePoints.push({
      price: 0.5,
      timestamp: trades[0].timestamp,
    });
    for (const t of trades) {
      // price_after represents the YES price after this trade
      // For NO-side trades, price_after is the NO price, so YES = 1 - price_after
      const yesPrice = t.side ? t.price_after : 1 - t.price_after;
      pricePoints.push({ price: yesPrice, timestamp: t.timestamp, trade: t });
    }
  }

  // Add current price as final point
  pricePoints.push({
    price: currentYesPrice,
    timestamp: new Date().toISOString(),
  });

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-bold mb-4">Price Chart</h3>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-degen-accent" />
        </div>
      </div>
    );
  }

  // Chart dimensions
  const W = 600;
  const H = 200;
  const PAD_L = 45;
  const PAD_R = 10;
  const PAD_T = 10;
  const PAD_B = 30;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  // Y-axis: 0 to 1 (price range)
  const minP = 0;
  const maxP = 1;

  const toX = (i: number) => PAD_L + (i / Math.max(1, pricePoints.length - 1)) * chartW;
  const toY = (p: number) => PAD_T + chartH - ((p - minP) / (maxP - minP)) * chartH;

  // Build SVG path
  const linePath = pricePoints
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(pt.price).toFixed(1)}`)
    .join(" ");

  // Gradient fill path
  const fillPath = `${linePath} L ${toX(pricePoints.length - 1).toFixed(1)} ${toY(0).toFixed(1)} L ${toX(0).toFixed(1)} ${toY(0).toFixed(1)} Z`;

  // Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1.0];

  // Format time
  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  // X-axis labels (first, middle, last)
  const xLabels: { i: number; label: string }[] = [];
  if (pricePoints.length >= 2) {
    xLabels.push({ i: 0, label: formatTime(pricePoints[0].timestamp) });
    if (pricePoints.length > 2) {
      const mid = Math.floor(pricePoints.length / 2);
      xLabels.push({ i: mid, label: formatTime(pricePoints[mid].timestamp) });
    }
    xLabels.push({ i: pricePoints.length - 1, label: "Now" });
  }

  const lastPrice = pricePoints[pricePoints.length - 1]?.price ?? 0.5;
  const firstPrice = pricePoints[0]?.price ?? 0.5;
  const priceChange = lastPrice - firstPrice;
  const isUp = priceChange >= 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Price Chart</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-degen-muted">YES Price</span>
          <span className={`text-sm font-bold ${isUp ? "text-degen-green" : "text-degen-red"}`}>
            {(lastPrice * 100).toFixed(1)}c
            <span className="ml-1 text-xs">
              ({isUp ? "+" : ""}{(priceChange * 100).toFixed(1)}c)
            </span>
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          onMouseLeave={() => setHoverPoint(null)}
        >
          <defs>
            <linearGradient id={`chartGrad-${marketId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? "rgb(0,255,136)" : "rgb(255,68,68)"} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isUp ? "rgb(0,255,136)" : "rgb(255,68,68)"} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yLabels.map((v) => (
            <g key={v}>
              <line
                x1={PAD_L}
                y1={toY(v)}
                x2={W - PAD_R}
                y2={toY(v)}
                stroke="rgb(var(--degen-border))"
                strokeWidth="0.5"
                strokeDasharray={v === 0.5 ? "4 4" : "none"}
                opacity={v === 0.5 ? 0.8 : 0.3}
              />
              <text
                x={PAD_L - 6}
                y={toY(v) + 4}
                textAnchor="end"
                fill="rgb(var(--degen-muted))"
                fontSize="10"
              >
                {(v * 100).toFixed(0)}c
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {xLabels.map(({ i, label }) => (
            <text
              key={i}
              x={toX(i)}
              y={H - 5}
              textAnchor="middle"
              fill="rgb(var(--degen-muted))"
              fontSize="9"
            >
              {label}
            </text>
          ))}

          {/* Fill area */}
          {pricePoints.length > 1 && (
            <path d={fillPath} fill={`url(#chartGrad-${marketId})`} />
          )}

          {/* Price line */}
          {pricePoints.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke={isUp ? "rgb(0,255,136)" : "rgb(255,68,68)"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Trade dots */}
          {pricePoints.map((pt, i) => {
            if (!pt.trade) return null;
            return (
              <circle
                key={i}
                cx={toX(i)}
                cy={toY(pt.price)}
                r="3"
                fill={pt.trade.side ? "rgb(0,255,136)" : "rgb(255,68,68)"}
                stroke="rgb(var(--degen-card))"
                strokeWidth="1.5"
                className="cursor-pointer"
                onMouseEnter={() =>
                  setHoverPoint({ x: toX(i), y: toY(pt.price), trade: pt.trade! })
                }
              />
            );
          })}

          {/* Hover tooltip */}
          {hoverPoint && (
            <g>
              <line
                x1={hoverPoint.x}
                y1={PAD_T}
                x2={hoverPoint.x}
                y2={PAD_T + chartH}
                stroke="rgb(var(--degen-muted))"
                strokeWidth="0.5"
                strokeDasharray="3 3"
              />
              <circle cx={hoverPoint.x} cy={hoverPoint.y} r="5" fill="rgb(var(--degen-accent))" />
            </g>
          )}

          {/* No trades message */}
          {trades.length === 0 && (
            <text
              x={W / 2}
              y={H / 2}
              textAnchor="middle"
              fill="rgb(var(--degen-muted))"
              fontSize="13"
            >
              No trades yet
            </text>
          )}
        </svg>

        {/* Hover tooltip box */}
        {hoverPoint && (
          <div
            className="absolute bg-degen-card border border-degen-border rounded-lg p-2 text-xs pointer-events-none shadow-lg z-10"
            style={{
              left: `${(hoverPoint.x / W) * 100}%`,
              top: `${(hoverPoint.y / H) * 100 - 15}%`,
              transform: "translateX(-50%) translateY(-100%)",
            }}
          >
            <p className="font-bold">
              {hoverPoint.trade.action.toUpperCase()}{" "}
              <span className={hoverPoint.trade.side ? "text-degen-green" : "text-degen-red"}>
                {hoverPoint.trade.side ? "YES" : "NO"}
              </span>
            </p>
            {hoverPoint.trade.sol_amount > 0 && (
              <p className="text-degen-muted">{(hoverPoint.trade.sol_amount / 1e9).toFixed(4)} SOL</p>
            )}
            <p className="text-degen-muted">{formatTime(hoverPoint.trade.timestamp)}</p>
          </div>
        )}
      </div>

      {/* Recent trades table */}
      {trades.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-degen-muted mb-2 font-medium">Recent Trades</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {[...trades].reverse().slice(0, 20).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-degen-border/50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      t.action === "buy"
                        ? "bg-degen-green/15 text-degen-green"
                        : "bg-degen-red/15 text-degen-red"
                    }`}
                  >
                    {t.action.toUpperCase()}
                  </span>
                  <span className={t.side ? "text-degen-green" : "text-degen-red"}>
                    {t.side ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {t.sol_amount > 0 && (
                    <span className="text-degen-muted">{(t.sol_amount / 1e9).toFixed(4)} SOL</span>
                  )}
                  <span className="font-mono text-degen-muted">
                    {t.user.slice(0, 4)}...{t.user.slice(-4)}
                  </span>
                  <span className="text-degen-muted/60">{formatTime(t.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
