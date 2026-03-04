export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-display font-bold">Terms of Service</h1>
      <p className="text-degen-muted text-sm">Last updated: February 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">1. Platform Description</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          MarketMint is a decentralized prediction market platform built on the Solana blockchain. Users can create markets on real-world events, buy and sell outcome shares, and earn returns based on correct predictions. MarketMint does not provide financial advice and is not a licensed financial service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">2. Eligibility</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          You must be of legal age in your jurisdiction to use this platform. You are responsible for ensuring that your use of MarketMint complies with all applicable laws and regulations in your jurisdiction. Prediction markets may be restricted or prohibited in certain regions.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">3. User Responsibilities</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          You are solely responsible for the security of your wallet and private keys. MarketMint does not custody your funds at any time &mdash; all transactions occur directly on the Solana blockchain. You acknowledge that you may lose some or all of the funds you commit to prediction markets.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">4. Market Resolution</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          Markets are resolved by an automated oracle system that uses AI to evaluate publicly available information. A challenge period exists after resolution during which outcomes may be contested. The platform authority retains the ability to void markets in cases of ambiguity, manipulation, or error. Resolution decisions are final after the challenge period expires.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">5. Fees</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          The platform charges a 5% platform fee and a 1.5% creator fee on each market&apos;s total pool at resolution. The remaining 93.5% is distributed to holders of winning outcome shares. Fees are deducted automatically by the on-chain program and are non-refundable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">6. Risk Disclosure</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          Participation in prediction markets involves risk. You may lose the entire amount you wager. Past performance of markets or traders does not guarantee future results. Cryptocurrency and blockchain-based applications carry additional risks including smart contract vulnerabilities, network congestion, and price volatility. Only participate with funds you can afford to lose.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">7. Limitation of Liability</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          MarketMint is provided &ldquo;as is&rdquo; without warranties of any kind. The platform operators shall not be liable for any losses resulting from smart contract bugs, incorrect market resolutions, blockchain network issues, or any other cause. Your use of the platform is entirely at your own risk.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">8. Modifications</h2>
        <p className="text-degen-muted text-sm leading-relaxed">
          We reserve the right to modify these terms at any time. Continued use of the platform constitutes acceptance of any changes. Material changes will be communicated through the platform interface.
        </p>
      </section>
    </div>
  );
}
