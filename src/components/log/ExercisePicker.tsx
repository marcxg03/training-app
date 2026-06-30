"use client";

import type { LoggerExercise } from "@/lib/methodology/workout-state";
import { getPrimaryMuscleGroupLabel } from "@/lib/methodology/muscle-groups";
import { cn } from "@/lib/utils/cn";

type ExercisePickerProps = {
  exercises: LoggerExercise[];
  onSelect?: (exercise: LoggerExercise) => void;
  selectedExerciseId: string | null;
};

function formatPrescribedRange(exercise: LoggerExercise) {
  return `${exercise.prescribed_min}–${exercise.prescribed_max}`;
}

export function ExercisePicker({
  exercises,
  onSelect,
  selectedExerciseId,
}: ExercisePickerProps) {
  const isResolved = Boolean(selectedExerciseId);
  const visibleExercises = selectedExerciseId
    ? exercises.filter(
        (exercise) => exercise.exercise_id === selectedExerciseId,
      )
    : exercises;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[16px] font-semibold tracking-tight text-foreground">
          {isResolved ? "Today's exercise" : "Which exercise today?"}
        </p>
        <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Pick one from this block&apos;s bank
        </p>
      </div>
      <ul className="space-y-2.5">
        {visibleExercises.map((exercise) => {
          const isSelected = exercise.exercise_id === selectedExerciseId;
          const primaryMuscleGroup =
            getPrimaryMuscleGroupLabel(exercise.muscle_groups) ?? "Accessory";
          const metaParts = [
            primaryMuscleGroup.toUpperCase(),
            formatPrescribedRange(exercise),
            exercise.is_bodyweight ? "BW" : null,
          ].filter(Boolean);

          return (
            <li key={exercise.exercise_id}>
              <button
                type="button"
                onClick={() => onSelect?.(exercise)}
                disabled={isResolved}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[14px] border px-4 py-[15px] text-left transition disabled:cursor-default",
                  isSelected
                    ? "border-accent bg-accent/[0.12]"
                    : "border-border bg-card hover:border-accent/50",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    isSelected ? "border-accent" : "border-ghost",
                  )}
                >
                  {isSelected ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-foreground">
                    {exercise.name}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block font-mono text-[10px] font-medium tabular-nums tracking-[0.08em]",
                      isSelected ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    {metaParts.join(" · ")}
                  </span>
                  {exercise.notes ? (
                    <span className="mt-1.5 block text-[13px] leading-5 text-muted-foreground">
                      {exercise.notes}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
