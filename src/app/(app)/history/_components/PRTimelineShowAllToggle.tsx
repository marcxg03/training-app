"use client";

import Link from "next/link";

import { cn } from "@/lib/utils/cn";

type PRTimelineShowAllToggleProps = {
  showAll: boolean;
};

const segmentBase =
  "flex-1 rounded-lg py-2 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors";

export function PRTimelineShowAllToggle({
  showAll,
}: PRTimelineShowAllToggleProps) {
  return (
    <div className="flex gap-1.5 rounded-[var(--radius)] border border-border bg-input p-1">
      <Link
        href="/history"
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
        href="/history?showAll=1"
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
