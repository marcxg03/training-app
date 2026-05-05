"use client";

import type { LoggerExercise } from "@/lib/methodology/workout-state";
import { getPrimaryMuscleGroupLabel } from "@/lib/methodology/muscle-groups";

type ExercisePickerProps = {
  exercises: LoggerExercise[];
  onSelect?: (exercise: LoggerExercise) => void;
  selectedExerciseId: string | null;
};

function formatPrescribedRange(exercise: LoggerExercise) {
  return `${exercise.prescribed_min}-${exercise.prescribed_max} reps`;
}

export function ExercisePicker({
  exercises,
  onSelect,
  selectedExerciseId,
}: ExercisePickerProps) {
  const visibleExercises = selectedExerciseId
    ? exercises.filter(
        (exercise) => exercise.exercise_id === selectedExerciseId,
      )
    : exercises;

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Pick an exercise from this block&apos;s bank
      </p>
      <ul className="space-y-3">
        {visibleExercises.map((exercise) => {
          const primaryMuscleGroup =
            getPrimaryMuscleGroupLabel(exercise.muscle_groups) ?? "Accessory";

          return (
            <li key={exercise.exercise_id}>
              <button
                type="button"
                onClick={() => onSelect?.(exercise)}
                disabled={Boolean(selectedExerciseId)}
                className="flex w-full flex-col gap-3 rounded-xl border border-border/70 bg-background/60 px-4 py-4 text-left transition hover:border-accent/50 hover:bg-background disabled:cursor-default disabled:border-accent/60 disabled:bg-accent/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-foreground">
                      {exercise.name}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {formatPrescribedRange(exercise)} · {primaryMuscleGroup}
                    </p>
                  </div>
                  {exercise.is_bodyweight ? (
                    <span className="inline-flex min-h-6 items-center rounded-full border border-border px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Bodyweight
                    </span>
                  ) : null}
                </div>
                {exercise.notes ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {exercise.notes}
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
