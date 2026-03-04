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
  title: "LaunchMarket - Prediction Market Launchpad on Solana",
  description: "Launch. Trade. Earn. Launch prediction markets on anything, powered by Solana.",
  metadataBase: new URL("https://degenbets-a4f.pages.dev"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/launchmarket-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "LaunchMarket - Prediction Markets on Solana",
    description: "Launch. Trade. Earn. Launch prediction markets on anything, powered by Solana.",
    url: "https://degenbets-a4f.pages.dev",
    siteName: "LaunchMarket",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "LaunchMarket - Prediction Markets on Solana" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LaunchMarket - Prediction Markets on Solana",
    description: "Launch. Trade. Earn. Launch prediction markets on anything.",
    images: ["/og-image.png"],
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
        <meta name="theme-color" content="#3B82F6" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
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
