import type { JSX } from "react";
import Link from "next/link";

import { PRHistoryChart } from "@/components/shared/PRHistoryChart";
import type { PRSpotlight } from "@/lib/analytics/pr-history";

// Replaces the deleted E1rmSection (T2-B). Same slot, honest data: a PR graph
// pair (weight + reps, T2-D) per featured exercise instead of an Epley
// estimate. Links into the exercise's full history.
function SpotlightCard({ spotlight }: { spotlight: PRSpotlight }): JSX.Element {
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

export function PRHistorySection({
  spotlights,
}: {
  spotlights: PRSpotlight[];
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow mt-2">Strength · PR history</h2>
      {spotlights.length > 0 ? (
        <div className="flex flex-col gap-4">
          {spotlights.map((spotlight) => (
            <SpotlightCard key={spotlight.exercise_id} spotlight={spotlight} />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          No PRs logged yet. Hit a heavier set or more reps in your prescribed
          range and they will chart here.
        </div>
      )}
    </section>
  );
}
