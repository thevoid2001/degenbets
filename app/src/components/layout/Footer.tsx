export function Footer() {
  return (
    <footer className="border-t border-degen-border py-8 mt-auto">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-degen-muted text-sm font-display font-bold tracking-wide">
            DEGENBETS
          </p>
          <div className="flex items-center gap-6 text-sm text-degen-muted">
            <span>5% platform fee</span>
            <span>1.5% creator fee</span>
            <span>93.5% to winners</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
