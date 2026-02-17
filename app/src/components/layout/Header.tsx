"use client";

import Link from "next/link";
import { WalletButton } from "@/components/common/WalletButton";
import { useTheme } from "@/components/common/ThemeProvider";

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-degen-border bg-degen-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Top row: D icon left, wordmark centered, actions right */}
        <div className="flex items-center justify-between h-20 sm:h-32">
          <Link href="/" className="logo-glow shrink-0">
            <img
              src="/degenbets-neon-icon.svg"
              alt=""
              className="h-10 w-10 sm:h-14 sm:w-14"
            />
          </Link>

          <Link href="/" className="logo-glow absolute left-1/2 -translate-x-1/2 hidden sm:block">
            <img
              src="/degenbets-neon-logo.svg"
              alt="DegenBets"
              className="h-36"
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-degen-border hover:border-degen-accent/50 text-degen-muted hover:text-degen-accent transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <WalletButton />
          </div>
        </div>

        {/* Nav row: horizontally scrollable on mobile */}
        <nav className="flex items-center justify-center gap-2 pb-3 sm:pb-4 overflow-x-auto scrollbar-hide">
          {[
            { href: "/", label: "Markets" },
            { href: "/create", label: "Create" },
            { href: "/portfolio", label: "Portfolio" },
            { href: "/leaderboard", label: "Leaderboard" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="nav-pill">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
