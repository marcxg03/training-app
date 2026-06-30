import type { JSX } from "react";

import { HistoryBackLink } from "@/app/(app)/history/_components/HistoryBackLink";
import { ProgressionChart } from "@/app/(app)/history/_components/ProgressionChart";
import { getExerciseProgression } from "@/lib/history/queries";
import type {
  ExerciseProgression,
  ExerciseProgressionPoint,
  ExerciseProgressionPR,
} from "@/lib/history/projections";
import { kgToLbs } from "@/lib/units";

type ExerciseProgressPageProps = {
  params: Promise<{
    exercise_id: string;
  }>;
};

const setDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function formatSetDate(iso: string): string {
  return setDateFormatter.format(new Date(iso)).toUpperCase();
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

function buildChartPoints(
  progression: ExerciseProgression,
): { label: string; value: number }[] {
  return progression.top_sets
    .filter((point) => point.weight_kg !== null)
    .map((point) => ({
      label: formatSetDate(point.logged_at),
      value: Math.round(kgToLbs(point.weight_kg ?? 0)),
    }));
}

export default async function ExerciseProgressPage({
  params,
}: ExerciseProgressPageProps): Promise<JSX.Element> {
  const { exercise_id: exerciseId } = await params;
  const progression = await getExerciseProgression(exerciseId);

  if (progression === null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <header className="flex items-center gap-3">
          <HistoryBackLink href="/history" label="Back to PR timeline" />
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

  const chartPoints = buildChartPoints(progression);
  const recentSets = progression.recent_sets.slice(0, 12);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header className="flex items-center gap-3">
        <HistoryBackLink href="/history" label="Back to PR timeline" />
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
        <h2 className="eyebrow">Top-set weight · progression</h2>
        <ProgressionChart
          points={chartPoints}
          unitLabel="LBS · OLDEST → NEWEST"
        />
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
                  {formatSetDate(point.logged_at)}
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
