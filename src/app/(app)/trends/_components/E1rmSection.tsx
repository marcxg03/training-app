import type { JSX } from "react";
import Link from "next/link";

import { ProgressionChart } from "@/components/shared/ProgressionChart";
import type { E1rmSpotlight } from "@/lib/analytics/projections";
import { kgToLbs, toLbsChartPoints } from "@/lib/units";

// Sparkline card per spotlighted exercise: name, current e1RM, delta vs the
// start of the window, and the trend line. Links into the full history page.
function SpotlightCard({
  spotlight,
}: {
  spotlight: E1rmSpotlight;
}): JSX.Element {
  const points = toLbsChartPoints(spotlight.points);
  const current = points[points.length - 1]?.value ?? 0;
  // Delta in unrounded lbs, rounded once at the end — per-point rounding can
  // turn a 0.8 lb gain into +0 or +2 depending on luck.
  const rawKgDelta =
    spotlight.points.length > 1
      ? spotlight.points[spotlight.points.length - 1].value -
        spotlight.points[0].value
      : 0;
  const delta = Math.round(kgToLbs(Math.abs(rawKgDelta))) * Math.sign(rawKgDelta);
  const deltaLabel =
    spotlight.points.length > 1 ? `${delta >= 0 ? "+" : ""}${delta} lbs` : "—";

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
          {current}
          <span className="ml-1.5 text-[10px] font-normal uppercase text-faint">
            e1rm
          </span>
          <span
            className={`ml-2 text-[11px] ${delta >= 0 ? "text-accent" : "text-warning"}`}
          >
            {deltaLabel}
          </span>
        </p>
      </div>
      <ProgressionChart
        points={points}
        unitLabel="LBS E1RM"
        ariaLabel={`${spotlight.exercise_name} estimated one-rep-max trend`}
      />
    </Link>
  );
}

export function E1rmSection({
  spotlights,
}: {
  spotlights: E1rmSpotlight[];
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow mt-2">Strength · estimated 1RM</h2>
      {spotlights.length > 0 ? (
        <div className="flex flex-col gap-4">
          {spotlights.map((spotlight) => (
            <SpotlightCard key={spotlight.exercise_id} spotlight={spotlight} />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          Log some weighted sets and your e1RM trends will appear here.
        </div>
      )}
    </section>
  );
}
