import type { LiftingExerciseInBlock } from "@/lib/library/projections";
import { formatMuscleGroups, formatRepRange } from "@/lib/library/displayName";

type ExerciseListItemProps = {
  exercise: LiftingExerciseInBlock;
};

export function ExerciseListItem({ exercise }: ExerciseListItemProps) {
  return (
    <li className="rounded-[13px] border border-border bg-card px-[15px] py-3.5">
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-foreground">
          {exercise.name}
        </span>
        {exercise.is_bodyweight ? (
          <span className="inline-flex items-center rounded-md border border-cardio/40 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] text-cardio">
            BW
          </span>
        ) : null}
      </div>
      <p className="mt-1 font-mono text-[10px] font-medium uppercase tabular-nums tracking-[0.1em] text-muted-foreground">
        {formatMuscleGroups(exercise.muscle_groups)} ·{" "}
        {formatRepRange(exercise)}
      </p>
      {exercise.notes ? (
        <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
          {exercise.notes}
        </p>
      ) : null}
    </li>
  );
}
