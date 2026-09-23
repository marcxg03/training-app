import { Trophy } from "lucide-react";

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

const iconClasses: Record<PRTimelineRowData["pr_type"], string> = {
  weight: "text-accent",
  in_range_rep: "text-success",
};

export function PRTimelineRow({ row }: PRTimelineRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card px-4 py-3.5">
      <Trophy
        aria-hidden
        className={`h-[18px] w-[18px] shrink-0 ${iconClasses[row.pr_type]}`}
        fill="currentColor"
      />
      <div className="min-w-0 flex-1">
        <ExerciseLink
          exerciseId={row.exercise_id}
          className="block min-h-6 truncate text-sm font-semibold text-foreground transition-colors hover:text-accent"
        >
          {row.exercise_name}
        </ExerciseLink>
        <WorkoutLink
          completionId={row.completion_id}
          className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 transition-colors hover:opacity-80"
        >
          <PRTypeBadge prType={row.pr_type} />
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
            {row.workout_display_name}
          </span>
        </WorkoutLink>
      </div>
      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
        {formatPrValue(row)}
      </span>
    </li>
  );
}
