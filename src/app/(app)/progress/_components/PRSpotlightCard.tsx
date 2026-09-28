import type { JSX } from "react";
import Link from "next/link";

import { PRHistoryChart } from "@/components/shared/PRHistoryChart";
import type { PRSpotlight } from "@/lib/analytics/pr-history";

// ONE exercise's PR pair (weight + reps, T2-D): a headline row plus the two
// stacked charts, linking into that exercise's full history.
//
// Extracted from PRHistorySection in T2-E, when the Trends surface stopped
// rendering a LIST of these and started rendering exactly one at a time behind
// a selector. Two call sites now share it — the Overview featured slot
// (PRHistorySection) and the Trends browser (PRHistoryBrowser) — so the card
// itself stays one thing rendered two ways, not two drifting copies.
//
// Server-safe: props only, no state, no browser API. The client browser can
// import it without turning it into a second component.
export function PRSpotlightCard({
  spotlight,
}: {
  spotlight: PRSpotlight;
}): JSX.Element {
  const weightPoints = spotlight.model.weight.points;
  const repPoints = spotlight.model.rep.points;
  const latestWeight = weightPoints[weightPoints.length - 1];
  const latestRep = repPoints[repPoints.length - 1];
  const headline = [
    latestWeight ? `${latestWeight.value} lbs` : null,
    latestRep ? `${latestRep.value} reps` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    <Link
      href={`/history/exercises/${spotlight.exercise_id}`}
      className="block rounded-[var(--radius)] transition-opacity hover:opacity-90"
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">
          {spotlight.exercise_name}
        </p>
        <p className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-foreground">
          {headline}
          <span className="ml-2 text-[10px] font-normal uppercase text-faint">
            {spotlight.pr_count} PR{spotlight.pr_count === 1 ? "" : "s"}
          </span>
        </p>
      </div>
      <PRHistoryChart
        model={spotlight.model}
        ariaLabel={`${spotlight.exercise_name} personal-record history`}
      />
    </Link>
  );
}
