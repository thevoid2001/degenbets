import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-display font-black neon-text mb-4">404</h1>
      <h2 className="text-xl font-bold text-degen-text mb-2">Market Not Found</h2>
      <p className="text-degen-muted mb-8 max-w-md">
        This page doesn&apos;t exist. Maybe the market got voided, or maybe you just fat-fingered the URL.
      </p>
      <Link href="/" className="btn-primary">
        Back to Markets
      </Link>
    </div>
  );
}
