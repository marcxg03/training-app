import { EditPencilButton } from "@/app/(app)/library/_components/EditPencilButton";
import type { ExerciseListItem } from "@/lib/library/projections";

type ExerciseListCardProps = {
  exercise: ExerciseListItem;
};

export function ExerciseListCard({ exercise }: ExerciseListCardProps) {
  return (
    <li className="rounded-2xl border border-border/70 bg-card/80 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">
            {exercise.name}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {exercise.primary_muscle_group_label ?? "Uncategorized"} ·{" "}
            {exercise.prescribed_min}–{exercise.prescribed_max} reps
          </p>
        </div>
        <div className="flex items-center gap-2">
          {exercise.is_bodyweight ? (
            <span className="inline-flex rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Bodyweight
            </span>
          ) : null}
          <EditPencilButton kind="exercise" exercise={exercise} />
        </div>
      </div>
    </li>
  );
}
