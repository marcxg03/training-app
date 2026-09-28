"use client";

import { useState } from "react";
import { Repeat2 } from "lucide-react";

import { ExerciseImage } from "@/components/shared/ExerciseImage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LoggerExercise } from "@/lib/methodology/workout-state";
import { getPrimaryMuscleGroupLabel } from "@/lib/methodology/muscle-groups";
import { cn } from "@/lib/utils/cn";

type ExercisePickerProps = {
  exercises: LoggerExercise[];
  onSelect?: (exercise: LoggerExercise) => void;
  selectedExerciseId: string | null;
  /** Sets already logged against this block THIS session. Drives whether a
   * swap is free (0) or has to be confirmed (>0). */
  loggedSetCount?: number;
};

function formatPrescribedRange(exercise: LoggerExercise) {
  return `${exercise.prescribed_min}–${exercise.prescribed_max}`;
}

/**
 * The block's exercise choice — and, since T2-D, the ability to CHANGE it
 * (Marcus: "allow me to choose a different workout in the block if i
 * accidentally selected one that i do not like").
 *
 * Two cases, deliberately different:
 *
 * - **No sets logged yet** — the overwhelmingly common "oops, wrong tap".
 *   Swapping is free: nothing has been written, so "Change exercise" just
 *   reopens the bank.
 * - **Sets already logged** — set_logs are APPEND-ONLY and each one carries the
 *   exercise_id it was logged under. A swap therefore cannot re-attribute them
 *   and must not try. It is still allowed (option (a)), behind a confirm that
 *   says plainly where those sets stay; the logged rows then label themselves
 *   with the exercise they belong to, so the screen never implies otherwise.
 */
export function ExercisePicker({
  exercises,
  onSelect,
  selectedExerciseId,
  loggedSetCount = 0,
}: ExercisePickerProps) {
  const [isSwapping, setIsSwapping] = useState(false);
  const [pending, setPending] = useState<LoggerExercise | null>(null);

  const isResolved = Boolean(selectedExerciseId);
  const selectedExercise =
    exercises.find((exercise) => exercise.exercise_id === selectedExerciseId) ??
    null;
  // Resolved and settled: show only the chosen one. Mid-swap (or not yet
  // chosen): show the whole bank so another can be picked.
  const isBrowsing = !isResolved || isSwapping;
  const visibleExercises = isBrowsing
    ? exercises
    : exercises.filter(
        (exercise) => exercise.exercise_id === selectedExerciseId,
      );

  function choose(exercise: LoggerExercise) {
    if (exercise.exercise_id === selectedExerciseId) {
      setIsSwapping(false);
      return;
    }

    if (isResolved && loggedSetCount > 0) {
      setPending(exercise);
      return;
    }

    onSelect?.(exercise);
    setIsSwapping(false);
  }

  function confirmPending() {
    if (pending) {
      onSelect?.(pending);
    }

    setPending(null);
    setIsSwapping(false);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[16px] font-semibold tracking-tight text-foreground">
          {isSwapping
            ? "Change exercise"
            : isResolved
              ? "Today's exercise"
              : "Which exercise today?"}
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
                onClick={() => choose(exercise)}
                disabled={!isBrowsing}
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
                {/* Mid-workout recognition aid. Renders nothing when the
                    exercise has no vendored media (most of the library), and
                    the flex gap collapses — no gap, no broken frame. */}
                <ExerciseImage
                  mediaPath={exercise.media_path}
                  mediaType={exercise.media_type}
                  name={exercise.name}
                  size="thumb"
                />
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

      {/* The swap affordance. Only once a choice exists, and only when the
          block's bank actually holds an alternative. */}
      {isResolved && exercises.length > 1 ? (
        <button
          type="button"
          onClick={() => setIsSwapping((current) => !current)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:border-accent/50 hover:text-foreground"
        >
          <Repeat2 className="h-4 w-4" aria-hidden="true" />
          {isSwapping ? "Keep current exercise" : "Change exercise"}
        </button>
      ) : null}

      <Dialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) {
            setPending(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader className="items-start text-left">
            <DialogTitle className="text-[19px]">
              Switch to {pending?.name}?
            </DialogTitle>
            <DialogDescription className="leading-6">
              The {loggedSetCount} set{loggedSetCount === 1 ? "" : "s"} you
              already logged stay recorded under{" "}
              {selectedExercise?.name ?? "the current exercise"} — nothing saved
              is changed or deleted. Only your next sets go to {pending?.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2.5 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPending(null)}
              className="flex-1 uppercase tracking-[0.05em]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmPending}
              className="flex-1 uppercase tracking-[0.05em]"
            >
              Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
