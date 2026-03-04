"use client";

import Link from "next/link";
import { WalletButton } from "@/components/common/WalletButton";

export function Header() {
  return (
    <header className="border-b border-degen-border bg-degen-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Top row: L icon left, wordmark centered, wallet right */}
        <div className="flex items-center justify-between h-20 sm:h-32">
          <Link href="/" className="logo-glow shrink-0">
            <img
              src="/launchmarket-icon.svg"
              alt=""
              className="h-10 w-10 sm:h-14 sm:w-14"
            />
          </Link>

          <Link href="/" className="logo-glow absolute left-1/2 -translate-x-1/2 hidden sm:block">
            <img
              src="/launchmarket-logo.svg"
              alt="LaunchMarket"
              className="h-36"
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <WalletButton />
          </div>
        </div>

        {/* Nav row: horizontally scrollable on mobile */}
        <nav className="flex items-center justify-center gap-2 pb-3 sm:pb-4 overflow-x-auto scrollbar-hide">
          {[
            { href: "/swipe", label: "Swipe" },
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
