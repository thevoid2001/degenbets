interface CreatorBadgeProps {
  wallet: string;
  reputation?: number;
  marketsCount?: number;
  voidedCount?: number;
}

export function CreatorBadge({
  wallet,
  reputation,
  marketsCount,
  voidedCount,
}: CreatorBadgeProps) {
  const short = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  return (
    <a
      href={`/creator/${wallet}`}
      className="inline-flex items-center gap-2 text-sm text-degen-muted hover:text-degen-text transition-colors"
    >
      <span className="font-mono">{short}</span>
      {reputation !== undefined && (
        <span className="text-yellow-400">&#9733; {reputation}</span>
      )}
      {marketsCount !== undefined && (
        <span>{marketsCount} markets</span>
      )}
      {voidedCount !== undefined && voidedCount > 0 && (
        <span className="text-degen-red">{voidedCount} voided</span>
      )}
    </a>
  );
}
