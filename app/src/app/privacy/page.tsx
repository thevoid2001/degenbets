export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-display font-bold">Privacy Policy</h1>
      <p className="text-degen-muted text-sm">Last updated: February 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">1. Overview</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          MarketMint is a decentralized application that prioritizes user privacy. We do not require account creation, email addresses, or any personal identifying information. All interaction with the platform is wallet-based.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">2. Data We Collect</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          <strong className="text-degen-text">On-chain data:</strong> All trades, positions, and market interactions are recorded on the Solana blockchain and are publicly visible by design. This includes your wallet address, transaction amounts, and market participation.
        </p>
        <p className="text-degen-muted text-sm leading-relaxed">
          <strong className="text-degen-text">Backend data:</strong> We store market metadata, trade history, and leaderboard statistics in our database to provide a fast user experience. This data mirrors what is publicly available on-chain.
        </p>
        <p className="text-degen-muted text-sm leading-relaxed">
          <strong className="text-degen-text">Local storage:</strong> We store your theme preference (dark/light mode) in your browser&apos;s local storage. No cookies are used for tracking.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">3. Data We Do Not Collect</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          We do not collect names, email addresses, phone numbers, IP addresses for tracking, location data, or any other personally identifiable information. We do not use analytics trackers, advertising pixels, or third-party tracking scripts.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">4. Third-Party Services</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          The platform interacts with the following third-party services:
        </p>
        <ul className="text-degen-muted text-sm leading-relaxed list-disc list-inside space-y-1">
          <li>Solana RPC providers for blockchain interaction</li>
          <li>Anthropic AI for market resolution oracle</li>
          <li>Cloudflare for content delivery</li>
        </ul>
        <p className="text-degen-muted text-sm leading-relaxed">
          These services may have their own privacy policies. We recommend reviewing them independently.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">5. Data Retention</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          On-chain data is permanent and immutable by nature of the blockchain. Backend database records are retained for the operational lifetime of the platform to support leaderboards and market history.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">6. Contact</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          For questions about this privacy policy, reach out through our community channels or open an issue on our public repository.
        </p>
      </section>
    </div>
  );
}
