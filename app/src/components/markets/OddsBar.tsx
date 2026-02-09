interface OddsBarProps {
  yesPool: number;
  noPool: number;
}

export function OddsBar({ yesPool, noPool }: OddsBarProps) {
  const total = yesPool + noPool;
  const yesPct = total > 0 ? Math.round((yesPool / total) * 100) : 50;
  const noPct = 100 - yesPct;

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-degen-green font-medium">YES {yesPct}%</span>
        <span className="text-degen-red font-medium">NO {noPct}%</span>
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
