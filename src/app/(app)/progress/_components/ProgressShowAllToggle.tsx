"use client";

import Link from "next/link";

import { cn } from "@/lib/utils/cn";

type ProgressShowAllToggleProps = {
  showAll: boolean;
};

const segmentBase =
  "flex-1 rounded-lg py-2 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors";

// PR-timeline range toggle for the History segment. Links carry view=history so
// the merged Progress page re-lands on the History segment after the reload
// (the segment switch itself is client state; this range switch needs a fetch).
export function ProgressShowAllToggle({ showAll }: ProgressShowAllToggleProps) {
  return (
    <div className="flex gap-1.5 rounded-[var(--radius)] border border-border bg-input p-1">
      <Link
        href="/progress?view=history"
        aria-current={showAll ? undefined : "true"}
        className={cn(
          segmentBase,
          showAll
            ? "text-muted-foreground hover:text-foreground"
            : "bg-accent text-background",
        )}
      >
        Last 90 days
      </Link>
      <Link
        href="/progress?showAll=1&view=history"
        aria-current={showAll ? "true" : undefined}
        className={cn(
          segmentBase,
          showAll
            ? "bg-accent text-background"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        All time
      </Link>
    </div>
  );
}
