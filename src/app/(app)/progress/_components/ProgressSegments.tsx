"use client";

import { useState, type ReactNode } from "react";

import { SegmentedControl } from "@/components/shared";
import { cn } from "@/lib/utils/cn";

export type ProgressSegment = "Overview" | "Trends" | "History";

const SEGMENTS: ProgressSegment[] = ["Overview", "Trends", "History"];

/**
 * Client segment switcher for /progress (D19). The server renders all three
 * segments' content (real, server-fetched) and passes them as props; this
 * component only toggles which one is visible via `hidden` — server-first, no
 * re-fetch on switch. `initial` lets a deep link (?view=history / ?view=trends)
 * land on a given segment. The three segments are Overview (the glance),
 * Trends (all analytical charts), and History (PR timeline + all workouts).
 */
export function ProgressSegments({
  overview,
  trends,
  history,
  initial = "Overview",
}: {
  overview: ReactNode;
  trends: ReactNode;
  history: ReactNode;
  initial?: ProgressSegment;
}) {
  const [active, setActive] = useState<ProgressSegment>(initial);

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        options={SEGMENTS}
        value={active}
        onChange={(value) => setActive(value as ProgressSegment)}
        ariaLabel="Progress views"
      />

      <div
        className={cn(
          active === "Overview" ? "flex" : "hidden",
          "flex-col gap-5",
        )}
      >
        {overview}
      </div>
      <div
        className={cn(
          active === "Trends" ? "flex" : "hidden",
          "flex-col gap-5",
        )}
      >
        {trends}
      </div>
      <div
        className={cn(
          active === "History" ? "flex" : "hidden",
          "flex-col gap-5",
        )}
      >
        {history}
      </div>
    </div>
  );
}
