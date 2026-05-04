import Link from "next/link";

import { allSessionsHref } from "@/lib/history/crossLinks";

export function HistoryHeaderLink() {
  return (
    <Link
      href={allSessionsHref()}
      className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:border-accent/60 hover:text-accent"
    >
      All Sessions
    </Link>
  );
}
