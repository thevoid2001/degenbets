"use client";

import { useState, useEffect } from "react";

interface SplashScreenProps {
  onEnter: () => void;
}

export function SplashScreen({ onEnter }: SplashScreenProps) {
  const [phase, setPhase] = useState(0);
  // 0: initial (black), 1: icon appears, 2: text reveals, 3: tagline + button, 4: exit

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const handleEnter = () => {
    setPhase(4);
    setTimeout(onEnter, 600);
  };

  return (
    <div
      className={`splash-overlay ${phase === 4 ? "splash-exit" : ""}`}
      onClick={phase >= 3 ? handleEnter : undefined}
    >
      {/* Animated background grid */}
      <div className="splash-grid" />

      {/* Glow orbs */}
      <div className="splash-orb splash-orb-1" />
      <div className="splash-orb splash-orb-2" />
      <div className="splash-orb splash-orb-3" />

      <div className="splash-content">
        {/* Icon */}
        <div className={`splash-icon ${phase >= 1 ? "splash-icon-visible" : ""}`}>
          <div className="splash-icon-inner">
            <svg width="120" height="120" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="splashBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#2563EB" />
                </linearGradient>
                <linearGradient id="splashSwoosh" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="40%" stopColor="#ffffff" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect x="20" y="20" width="160" height="160" rx="32" fill="url(#splashBg)" />
              <path d="M 22 108 Q 65 78, 110 76 Q 150 74, 178 85 L 178 94 Q 150 86, 110 88 Q 65 90, 22 116 Z" fill="url(#splashSwoosh)" />
              <path d="M 58 48 L 80 48 L 80 130 L 142 130 L 142 152 L 58 152 Z" fill="#ffffff" />
            </svg>
          </div>
          {/* Pulse ring */}
          <div className={`splash-pulse-ring ${phase >= 1 ? "splash-pulse-active" : ""}`} />
        </div>

        {/* Logo text */}
        <div className={`splash-title ${phase >= 2 ? "splash-title-visible" : ""}`}>
          {"LAUNCHMARKET".split("").map((char, i) => (
            <span
              key={i}
              className="splash-letter"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {char}
            </span>
          ))}
        </div>

        {/* Tagline */}
        <p className={`splash-tagline ${phase >= 3 ? "splash-tagline-visible" : ""}`}>
          Prediction Market Launchpad on Solana
        </p>

        {/* Enter button */}
        <button
          className={`splash-enter ${phase >= 3 ? "splash-enter-visible" : ""}`}
          onClick={handleEnter}
        >
          <span>Enter App</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Skip hint */}
      {phase >= 1 && phase < 3 && (
        <button className="splash-skip" onClick={handleEnter}>
          Skip
        </button>
      )}
    </div>
  );
}
