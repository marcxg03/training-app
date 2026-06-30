import type { AllWorkoutsRow as AllWorkoutsRowData } from "@/lib/history/projections";
import { WorkoutLink } from "@/components/shared/WorkoutLink";
import { SessionStateBadge } from "@/app/(app)/history/_components/SessionStateBadge";

type AllWorkoutsRowProps = {
  row: AllWorkoutsRowData;
};

// `workout_display_name` is "<name> · <date>" (see formatWorkoutDisplayName).
// Split it for the design, which renders the name and date separately.
function splitDisplayName(displayName: string): {
  name: string;
  date: string | null;
} {
  const separatorIndex = displayName.lastIndexOf(" · ");

  if (separatorIndex === -1) {
    return { name: displayName, date: null };
  }

  return {
    name: displayName.slice(0, separatorIndex),
    date: displayName.slice(separatorIndex + 3),
  };
}

export function AllWorkoutsRow({ row }: AllWorkoutsRowProps) {
  const { name, date } = splitDisplayName(row.workout_display_name);

  return (
    <li>
      <WorkoutLink
        completionId={row.completion_id}
        className="block rounded-[var(--radius)] border border-border bg-card px-4 py-3.5 transition-colors hover:border-accent/40"
      >
        <div className="flex items-center gap-2">
          <span
            className={
              row.state === "in_progress"
                ? "truncate text-sm font-semibold text-foreground/70"
                : "truncate text-sm font-semibold text-foreground"
            }
          >
            {name}
          </span>
          {row.pr_count > 0 ? (
            <span className="inline-flex items-center rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-accent">
              {row.pr_count} PR
            </span>
          ) : null}
          {date ? (
            <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tabular-nums text-faint">
              {date}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tabular-nums tracking-[0.08em] text-muted-foreground">
            {row.blocks_completed_count} / {row.blocks_total_count} blocks
          </span>
          <SessionStateBadge state={row.state} />
        </div>
      </WorkoutLink>
    </li>
  );
}
