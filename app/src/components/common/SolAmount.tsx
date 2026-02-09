interface SolAmountProps {
  lamports: number;
  className?: string;
}

export function SolAmount({ lamports, className = "" }: SolAmountProps) {
  const sol = lamports / 1e9;
  const formatted = sol >= 1000
    ? `${(sol / 1000).toFixed(1)}K`
    : sol >= 1
      ? sol.toFixed(2)
      : sol.toFixed(4);

  return <span className={className}>{formatted} SOL</span>;
}
