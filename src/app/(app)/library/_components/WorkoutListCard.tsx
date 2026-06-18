import Link from "next/link";

import { workoutDetailHref } from "@/lib/library/crossLinks";
import type { WorkoutDefSummary } from "@/lib/library/projections";

type WorkoutListCardProps = {
  workout: WorkoutDefSummary;
};

function formatBlockCount(count: number): string {
  return `${count} ${count === 1 ? "block" : "blocks"}`;
}

export function WorkoutListCard({ workout }: WorkoutListCardProps) {
  return (
    <li>
      <Link
        href={workoutDetailHref(workout.workout_def_id)}
        className="block rounded-2xl border border-border/70 bg-card/80 px-4 py-4 transition-colors hover:border-accent/40"
      >
        <div className="flex min-h-11 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {workout.name}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatBlockCount(workout.block_count)}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}
