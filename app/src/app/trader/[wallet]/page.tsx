import TraderProfileClient from "./client";

export function generateStaticParams() {
  return [{ wallet: "0" }];
}

export default function TraderPage() {
  return <TraderProfileClient />;
}
