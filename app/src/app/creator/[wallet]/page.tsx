import CreatorPageClient from "./client";

export function generateStaticParams() {
  return [{ wallet: "0" }];
}

export default function CreatorPage() {
  return <CreatorPageClient />;
}
