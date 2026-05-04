import { formatWeight } from "@/lib/units";
import type { PRTimelineRow as PRTimelineRowData } from "@/lib/history/projections";
import { ExerciseLink } from "@/components/shared/ExerciseLink";
import { WorkoutLink } from "@/components/shared/WorkoutLink";
import { PRTypeBadge } from "@/app/(app)/history/_components/PRTypeBadge";

type PRTimelineRowProps = {
  row: PRTimelineRowData;
};

function formatPrValue(row: PRTimelineRowData): string {
  if (row.is_bodyweight) {
    return `BW × ${row.reps}`;
  }

  return `${formatWeight(row.weight_kg)} × ${row.reps}`;
}

export function PRTimelineRow({ row }: PRTimelineRowProps) {
  return (
    <li className="rounded-xl border border-border/70 bg-background/60 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ExerciseLink
            exerciseId={row.exercise_id}
            className="block min-h-11 text-base font-semibold text-foreground transition-colors hover:text-accent"
          >
            <span className="block truncate">{row.exercise_name}</span>
          </ExerciseLink>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PRTypeBadge prType={row.pr_type} />
            <span className="text-sm text-foreground">
              {formatPrValue(row)}
            </span>
          </div>
          <WorkoutLink
            completionId={row.completion_id}
            className="mt-3 inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-accent"
          >
            {row.workout_display_name}
          </WorkoutLink>
        </div>
      </div>
    </li>
  );
}
