import type { JSX } from "react";

import { HistoryBackLink } from "@/app/(app)/history/_components/HistoryBackLink";
import { ProgressionChart } from "@/components/shared/ProgressionChart";
import {
  buildBestE1rmByDay,
  buildBestRepsByDay,
  dayKeyOf,
  dayLabelOf,
} from "@/lib/analytics/projections";
import { getExerciseProgression } from "@/lib/history/queries";
import { getAppTimezone } from "@/lib/time/server";
import type {
  ExerciseProgression,
  ExerciseProgressionPoint,
  ExerciseProgressionPR,
} from "@/lib/history/projections";
import { kgToLbs, toLbsChartPoints } from "@/lib/units";

type ExerciseProgressPageProps = {
  params: Promise<{
    exercise_id: string;
  }>;
};

// Same local-day convention as the chart above it — one timezone, one label.
function formatSetDate(iso: string, timeZone: string): string {
  return dayLabelOf(dayKeyOf(iso, timeZone));
}

function formatPrValue(
  pr: ExerciseProgressionPR,
  isBodyweight: boolean,
): string {
  if (isBodyweight) {
    return `BW × ${pr.reps}`;
  }

  return `${Math.round(kgToLbs(pr.weight_kg))} × ${pr.reps}`;
}

function formatSetValue(
  point: ExerciseProgressionPoint,
  isBodyweight: boolean,
): string {
  const left =
    isBodyweight || point.weight_kg === null
      ? "BW"
      : `${Math.round(kgToLbs(point.weight_kg))}`;

  return `${left}×${point.reps}`;
}

function StatCard({
  label,
  pr,
  isBodyweight,
}: {
  label: string;
  pr: ExerciseProgressionPR | null;
  isBodyweight: boolean;
}): JSX.Element {
  return (
    <div className="flex-1 rounded-[var(--radius)] border border-border bg-card p-3.5">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums text-foreground">
        {pr ? formatPrValue(pr, isBodyweight) : "—"}
      </p>
    </div>
  );
}

// Chart the best estimated 1RM per day (Epley) — a rep PR at the same weight
// now shows as progress, unlike raw top-set weight. Computed from ALL sets
// (recent_sets), not top_sets: the heaviest set of a day is not always its
// best e1RM set.
//
// e1RM is gated TWICE (D28), and this page is the second gate:
//   - is_bodyweight — no external load, so Epley has nothing to scale.
//   - !is_compound  — an Epley estimate off a lateral raise or a triceps
//     pushdown is noise dressed up as a number. `buildE1rmSpotlights` already
//     dropped these from the Trends spotlights; before this slice the detail
//     page still charted "Estimated 1RM" for EVERY loaded exercise, so an
//     isolation the spotlights deliberately hid still showed an e1RM curve one
//     tap away.
// Both non-e1RM cases fall back to best-reps-per-day, which is the honest
// progression axis when load is not the thing being estimated.
function buildChartConfig(
  progression: ExerciseProgression,
  timeZone: string,
): {
  points: { label: string; value: number }[];
  heading: string;
  unitLabel: string;
  ariaLabel: string;
  note: string | null;
} {
  if (progression.is_bodyweight) {
    return {
      points: buildBestRepsByDay(progression.recent_sets, timeZone),
      heading: "Best reps · progression",
      unitLabel: "REPS · OLDEST → NEWEST",
      ariaLabel: "Best reps progression",
      note: null,
    };
  }

  if (!progression.is_compound) {
    return {
      points: buildBestRepsByDay(progression.recent_sets, timeZone),
      heading: "Best reps · progression",
      unitLabel: "REPS · OLDEST → NEWEST",
      ariaLabel: "Best reps progression",
      note: "Estimated 1RM is a compound-lift stat. Mark this exercise as compound in the Library if it belongs on that list.",
    };
  }

  return {
    points: toLbsChartPoints(
      buildBestE1rmByDay(progression.recent_sets, timeZone),
    ),
    heading: "Estimated 1RM · progression",
    unitLabel: "LBS E1RM · OLDEST → NEWEST",
    ariaLabel: "Estimated one-rep-max progression",
    note: null,
  };
}

export default async function ExerciseProgressPage({
  params,
}: ExerciseProgressPageProps): Promise<JSX.Element> {
  const { exercise_id: exerciseId } = await params;
  const tz = await getAppTimezone();
  const progression = await getExerciseProgression(exerciseId);

  if (progression === null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <header className="flex items-center gap-3">
          <HistoryBackLink
            href="/progress?view=history"
            label="Back to PR timeline"
          />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Exercise
          </h1>
        </header>
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          We couldn&apos;t find this exercise.
        </div>
      </div>
    );
  }

  const chart = buildChartConfig(progression, tz);
  const recentSets = progression.recent_sets.slice(0, 12);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header className="flex items-center gap-3">
        <HistoryBackLink
          href="/progress?view=history"
          label="Back to PR timeline"
        />
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
          {progression.exercise_name}
        </h1>
      </header>

      <div className="flex gap-2.5">
        <StatCard
          label="Weight PR"
          pr={progression.best_weight_pr}
          isBodyweight={progression.is_bodyweight}
        />
        <StatCard
          label="Best in-range"
          pr={progression.best_in_range_pr}
          isBodyweight={progression.is_bodyweight}
        />
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="eyebrow">{chart.heading}</h2>
        <ProgressionChart
          points={chart.points}
          unitLabel={chart.unitLabel}
          ariaLabel={chart.ariaLabel}
        />
        {chart.note ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {chart.note}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="eyebrow">Recent sets</h2>
        {recentSets.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {recentSets.map((point) => (
              <li
                key={point.set_log_id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-3.5 py-2.5"
              >
                <span className="font-mono text-[11px] uppercase tabular-nums text-muted-foreground">
                  {formatSetDate(point.logged_at, tz)}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[13px] font-semibold tabular-nums text-foreground">
                  {formatSetValue(point, progression.is_bodyweight)}
                  {point.is_to_failure ? (
                    <span className="text-[10px] text-warning">F</span>
                  ) : null}
                  {point.is_pr ? (
                    <span className="text-[10px] text-accent">PR</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
            No sets logged yet.
          </div>
        )}
      </section>
    </div>
  );
}
