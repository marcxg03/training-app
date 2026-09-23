"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";

import type {
  LoggerExercise,
  LoggerSetLog,
} from "@/lib/methodology/workout-state";
import { detectPRs } from "@/lib/methodology/pr-detection";
import { createClient } from "@/lib/supabase/client";
import { isRetryable } from "@/lib/sync/classify";
import { enqueue, type SetLogInsertPayload } from "@/lib/sync/queue";
import { lbsToKg } from "@/lib/units";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

type SetEntryFormProps = {
  blockId: string;
  completionId: string;
  defaultFailureChecked?: boolean;
  exercise: LoggerExercise;
  label: string;
  workoutId: string;
  setIndex: number;
  showFailureCheckbox?: boolean;
  userId: string;
  onSaved: (setLog: LoggerSetLog) => void;
};

const textareaClassName =
  "flex min-h-20 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";

const WEIGHT_STEP = 5;
const REPS_STEP = 1;

function stepNumericValue(
  current: string,
  delta: number,
  { min, decimals }: { min: number; decimals: number },
) {
  const parsed = Number(current);
  const base = Number.isFinite(parsed) && current.trim() !== "" ? parsed : 0;
  const next = Math.max(min, base + delta);

  return decimals > 0 ? String(Number(next.toFixed(decimals))) : String(next);
}

function getQueueErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return "Local storage full — clear browser data or contact support";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Could not queue this write.";
}

export function SetEntryForm({
  blockId,
  completionId,
  defaultFailureChecked = false,
  exercise,
  label,
  workoutId,
  setIndex,
  showFailureCheckbox = false,
  userId,
  onSaved,
}: SetEntryFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Exercise-level flag is the single authority: weighted variants are
  // separate exercises in the Library (e.g. "Weighted Pull Ups").
  const isBodyweight = exercise.is_bodyweight;
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [reps, setReps] = useState("");
  const [toFailure, setToFailure] = useState(defaultFailureChecked);
  const [weight, setWeight] = useState("");

  async function handleSave() {
    const parsedReps = Number(reps);

    if (!Number.isInteger(parsedReps) || parsedReps < 1) {
      setError("Enter at least 1 rep.");
      return;
    }

    let parsedWeightLbs: number | null = null;

    if (!isBodyweight) {
      if (/^-?\d+\.\d{2,}$/.test(weight.trim())) {
        setError("Enter a weight with no more than 1 decimal place.");
        return;
      }

      parsedWeightLbs = Number(weight);

      if (!weight || Number.isNaN(parsedWeightLbs) || parsedWeightLbs <= 0) {
        setError("Enter a weight.");
        return;
      }
    }

    setError(null);
    setIsSaving(true);

    const loggedAt = new Date().toISOString();
    const setLogId = crypto.randomUUID();
    const insertPayload: SetLogInsertPayload = {
      set_log_id: setLogId,
      user_id: userId,
      workout_id: workoutId,
      completion_id: completionId,
      block_id: blockId,
      exercise_id: exercise.exercise_id,
      set_index: setIndex,
      weight_kg: isBodyweight
        ? 0
        : parsedWeightLbs === null
          ? null
          : lbsToKg(parsedWeightLbs),
      reps: parsedReps,
      is_to_failure: showFailureCheckbox ? toFailure : false,
      prescribed_min: exercise.prescribed_min,
      prescribed_max: exercise.prescribed_max,
      notes: notes.trim() || null,
      logged_at: loggedAt,
    };

    const {
      data: insertedSetLog,
      error: insertError,
      status,
    } = await supabase
      .from("set_logs")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      if (
        isRetryable({
          code: insertError.code,
          message: insertError.message,
          status,
        })
      ) {
        try {
          enqueue(userId, {
            id: crypto.randomUUID(),
            kind: "set_log_insert",
            payload: insertPayload,
            attempts: 0,
            enqueued_at: loggedAt,
            last_attempt_at: null,
            last_error: null,
          });
        } catch (queueError) {
          setError(getQueueErrorMessage(queueError));
          setIsSaving(false);
          return;
        }

        onSaved({
          ...insertPayload,
          workout_id: insertPayload.workout_id,
          weight_kg: insertPayload.weight_kg ?? null,
          notes: insertPayload.notes ?? null,
          is_to_failure: insertPayload.is_to_failure ?? false,
          prTypes: [],
        });
        setIsSaving(false);
        return;
      }

      setError(insertError.message);
      setIsSaving(false);
      return;
    }

    let prTypes: LoggerSetLog["prTypes"] = [];

    if (!isBodyweight) {
      const { data: prHistory, error: prHistoryError } = await supabase
        .from("pr_history")
        .select("pr_type, reps, weight_kg")
        .eq("user_id", userId)
        .eq("exercise_id", exercise.exercise_id);

      if (prHistoryError) {
        console.error("Failed to load PR history", prHistoryError);
      } else {
        const maxWeightKg = prHistory
          .filter((row) => row.pr_type === "weight")
          .reduce<
            number | null
          >((highest, row) => (highest === null || row.weight_kg > highest ? row.weight_kg : highest), null);

        const maxRepsAtWeight = prHistory
          .filter(
            (row) =>
              row.pr_type === "in_range_rep" &&
              row.weight_kg === insertedSetLog.weight_kg,
          )
          .reduce<
            number | null
          >((highest, row) => (highest === null || row.reps > highest ? row.reps : highest), null);

        const detectedPRs = detectPRs(insertedSetLog, {
          isBodyweight,
          maxRepsAtWeight,
          maxWeightKg,
        });

        prTypes = detectedPRs.map((detection) => detection.prType);

        for (const detection of detectedPRs) {
          const { error: prInsertError } = await supabase
            .from("pr_history")
            .insert({
              user_id: userId,
              exercise_id: detection.exerciseId,
              set_log_id: insertedSetLog.set_log_id,
              pr_type: detection.prType,
              weight_kg: detection.weightKg,
              reps: detection.reps,
              achieved_at: detection.achievedAt,
            });

          if (prInsertError && prInsertError.code !== "23505") {
            console.error("Failed to insert PR history row", prInsertError);
          }
        }
      }
    }

    onSaved({
      ...insertedSetLog,
      workout_id: insertedSetLog.workout_id,
      prTypes,
    });
    router.refresh();
    setIsSaving(false);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-accent bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Set {setIndex}
        </p>
      </div>

      <div
        className={cn(
          "grid gap-3.5",
          isBodyweight ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        {!isBodyweight ? (
          <div>
            <p className="mb-2 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
              Weight (lbs)
            </p>
            <div className="flex items-center justify-between gap-2 rounded-[13px] border border-border bg-input p-1.5">
              <button
                type="button"
                aria-label="Decrease weight"
                onClick={() =>
                  setWeight((current) =>
                    stepNumericValue(current, -WEIGHT_STEP, {
                      min: 0,
                      decimals: 1,
                    }),
                  )
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-border text-subtle transition hover:text-foreground"
              >
                <Minus className="h-5 w-5" />
              </button>
              <input
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                aria-label="Weight in pounds"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                className="w-full min-w-0 bg-transparent text-center font-mono text-2xl font-semibold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="Increase weight"
                onClick={() =>
                  setWeight((current) =>
                    stepNumericValue(current, WEIGHT_STEP, {
                      min: 0,
                      decimals: 1,
                    }),
                  )
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-border text-subtle transition hover:text-foreground"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
            Reps · range {exercise.prescribed_min}–{exercise.prescribed_max}
          </p>
          <div className="flex items-center justify-between gap-2 rounded-[13px] border border-border bg-input p-1.5">
            <button
              type="button"
              aria-label="Decrease reps"
              onClick={() =>
                setReps((current) =>
                  stepNumericValue(current, -REPS_STEP, {
                    min: 1,
                    decimals: 0,
                  }),
                )
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-border text-subtle transition hover:text-foreground"
            >
              <Minus className="h-5 w-5" />
            </button>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              aria-label="Reps"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              className="w-full min-w-0 bg-transparent text-center font-mono text-2xl font-semibold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              aria-label="Increase reps"
              onClick={() =>
                setReps((current) =>
                  stepNumericValue(current, REPS_STEP, { min: 1, decimals: 0 }),
                )
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-border text-subtle transition hover:text-foreground"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {showFailureCheckbox ? (
        <button
          type="button"
          role="switch"
          aria-checked={toFailure}
          onClick={() => setToFailure((current) => !current)}
          className="flex w-full items-center justify-between rounded-xl border border-border px-3.5 py-2.5"
        >
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
            Taken to failure
          </span>
          <span
            className={cn(
              "inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors",
              toFailure ? "bg-accent" : "bg-border",
            )}
          >
            <span
              className={cn(
                "h-5 w-5 shrink-0 rounded-full bg-foreground transition-transform",
                toFailure ? "translate-x-5" : "translate-x-0",
              )}
            />
          </span>
        </button>
      ) : null}

      {showNotes ? (
        <label className="block space-y-2">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={textareaClassName}
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setShowNotes(true)}
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:text-foreground"
        >
          + note
        </button>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="w-full gap-2 text-[14px] font-bold uppercase tracking-[0.08em]"
      >
        <Check className="h-5 w-5" />
        {isSaving ? "Saving…" : `Log ${label}`}
      </Button>
    </div>
  );
}
