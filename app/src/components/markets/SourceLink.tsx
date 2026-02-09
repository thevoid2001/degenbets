interface SourceLinkProps {
  url: string;
}

export function SourceLink({ url }: SourceLinkProps) {
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-degen-accent hover:text-degen-accent/80 text-sm font-mono inline-flex items-center gap-1"
    >
      <span>&#128206;</span> {hostname}
    </a>
  );
}
