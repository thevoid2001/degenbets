import MarketPageClient from "./client";

export function generateStaticParams() {
  return [{ id: "0" }];
}

export default function MarketPage() {
  return <MarketPageClient />;
}
