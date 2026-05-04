import type { LiftingExerciseInBlock } from "@/lib/library/projections";
import { formatMuscleGroups, formatRepRange } from "@/lib/library/displayName";

type ExerciseListItemProps = {
  exercise: LiftingExerciseInBlock;
};

export function ExerciseListItem({ exercise }: ExerciseListItemProps) {
  return (
    <li className="rounded-2xl border border-border/70 bg-card/80 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">
            {exercise.name}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatRepRange(exercise)}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {formatMuscleGroups(exercise.muscle_groups)}
          </p>
        </div>
        {exercise.is_bodyweight ? (
          <span className="inline-flex rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Bodyweight
          </span>
        ) : null}
      </div>
      {exercise.notes ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {exercise.notes}
        </p>
      ) : null}
    </li>
  );
}
