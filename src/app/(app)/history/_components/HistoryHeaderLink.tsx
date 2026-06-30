import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { allWorkoutsHref } from "@/lib/history/crossLinks";

export function HistoryHeaderLink() {
  return (
    <Link
      href={allWorkoutsHref()}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle transition-colors hover:border-accent/60 hover:text-accent"
    >
      All workouts
      <ArrowRight aria-hidden className="h-4 w-4 text-accent" />
    </Link>
  );
}
