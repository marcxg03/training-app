import Link from "next/link";
import { ChevronRight } from "lucide-react";

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
        className="flex min-h-11 items-center gap-3 rounded-[13px] border border-border bg-card px-[15px] py-3.5 transition-colors hover:border-accent/40"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {workout.name}
          </p>
          <p className="mt-1.5 font-mono text-[10px] font-medium uppercase tabular-nums tracking-[0.1em] text-muted-foreground">
            {formatBlockCount(workout.block_count)}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 flex-none text-ghost" />
      </Link>
    </li>
  );
}
