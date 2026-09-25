import { DeleteLibraryItemButton } from "@/app/(owner)/library/_components/DeleteLibraryItemButton";
import { EditPencilButton } from "@/app/(owner)/library/_components/EditPencilButton";
import type { ExerciseListItem } from "@/lib/library/projections";

type ExerciseListCardProps = {
  exercise: ExerciseListItem;
};

export function ExerciseListCard({ exercise }: ExerciseListCardProps) {
  return (
    <li className="flex items-center gap-3 rounded-[13px] border border-border bg-card px-[15px] py-3.5">
      <div className="min-w-0 flex-1">
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
          {exercise.primary_muscle_group_label ?? "Uncategorized"} ·{" "}
          {exercise.prescribed_min}&ndash;{exercise.prescribed_max} reps
        </p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <EditPencilButton kind="exercise" exercise={exercise} />
        <DeleteLibraryItemButton
          kind="exercise"
          id={exercise.exercise_id}
          name={exercise.name}
        />
      </div>
    </li>
  );
}
