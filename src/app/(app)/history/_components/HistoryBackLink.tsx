import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type HistoryBackLinkProps = {
  href: string;
  label: string;
};

export function HistoryBackLink({ href, label }: HistoryBackLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card-alt text-subtle transition-colors hover:border-accent/60 hover:text-accent"
    >
      <ArrowLeft aria-hidden className="h-5 w-5" />
    </Link>
  );
}
