interface OddsBarProps {
  yesPrice: number;
  noPrice: number;
}

export function OddsBar({ yesPrice, noPrice }: OddsBarProps) {
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-degen-green font-medium">YES {yesPct}c</span>
        <span className="text-degen-red font-medium">NO {noPct}c</span>
      </div>
      <div className="w-full h-3 rounded-full overflow-hidden flex bg-degen-dark">
        <div
          className="bg-degen-green/60 transition-all duration-500"
          style={{ width: `${yesPct}%` }}
        />
        <div
          className="bg-degen-red/60 transition-all duration-500"
          style={{ width: `${noPct}%` }}
        />
      </div>
    </div>
  );
}
