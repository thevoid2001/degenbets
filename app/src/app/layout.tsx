import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/components/common/WalletProvider";
import { ThemeProvider } from "@/components/common/ThemeProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ToastProvider } from "@/components/common/ToastProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-display", weight: ["400", "700", "900"] });

export const metadata: Metadata = {
  title: "DegenBets - Prediction Market Launchpad on Solana",
  description: "Create. Bet. Earn. Launch prediction markets on anything, powered by Solana.",
  icons: {
    icon: "/degenbets-neon-icon.svg",
    apple: "/degenbets-neon-icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#00d4ff" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('degenbets-theme');
                  if (theme === 'light') {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrains.variable} ${orbitron.variable} font-sans bg-degen-dark text-degen-text min-h-screen`}
      >
        <ThemeProvider>
          <WalletContextProvider>
            <ToastProvider>
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
                  {children}
                </main>
                <Footer />
              </div>
            </ToastProvider>
          </WalletContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
