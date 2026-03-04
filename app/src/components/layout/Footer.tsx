import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-degen-border py-8 mt-auto">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <p className="text-degen-text font-display font-bold tracking-wide mb-2">
              LAUNCHMARKET
            </p>
            <p className="text-degen-muted text-sm">
              Prediction market launchpad on Solana. $LAUNCH
            </p>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <Link href="/terms" className="text-degen-muted hover:text-degen-accent transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-degen-muted hover:text-degen-accent transition-colors">
              Privacy Policy
            </Link>
          </div>

          <div className="flex flex-col gap-1 text-sm text-degen-muted md:text-right">
            <span>2% platform fee</span>
            <span>1% creator fee</span>
            <span>97% to winners</span>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-degen-border flex items-center justify-between text-xs text-degen-muted">
          <span>Launched on MetaDAO</span>
          <span>Powered by Solana</span>
        </div>
      </div>
    </footer>
  );
}
