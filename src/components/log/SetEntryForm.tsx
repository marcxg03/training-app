"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type {
  LoggerExercise,
  LoggerSetLog,
} from "@/lib/methodology/workout-state";
import { detectPRs } from "@/lib/methodology/pr-detection";
import { createClient } from "@/lib/supabase/client";
import { isRetryable } from "@/lib/sync/classify";
import { enqueue, type SetLogInsertPayload } from "@/lib/sync/queue";
import { lbsToKg } from "@/lib/units";
import { Button } from "@/components/ui/button";

type SetEntryFormProps = {
  blockId: string;
  defaultFailureChecked?: boolean;
  exercise: LoggerExercise;
  label: string;
  workoutId: string;
  setIndex: number;
  showFailureCheckbox?: boolean;
  userId: string;
  onSaved: (setLog: LoggerSetLog) => void;
};

const inputClassName =
  "flex min-h-11 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";

const textareaClassName =
  "flex min-h-24 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";

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
  const [notes, setNotes] = useState("");
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

    if (!exercise.is_bodyweight) {
      if (/^-?\d+\.\d{2,}$/.test(weight.trim())) {
        setError("Enter a weight with no more than 1 decimal place.");
        return;
      }

      parsedWeightLbs = Number(weight);

      if (!weight || Number.isNaN(parsedWeightLbs) || parsedWeightLbs <= 0) {
        setError(
          "Enter a weight or mark this exercise as bodyweight in your plan.",
        );
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
      block_id: blockId,
      exercise_id: exercise.exercise_id,
      set_index: setIndex,
      weight_kg: exercise.is_bodyweight
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

    if (!exercise.is_bodyweight) {
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
          isBodyweight: exercise.is_bodyweight,
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
    <div className="space-y-4 rounded-xl border border-border/70 bg-background/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Set {setIndex}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {!exercise.is_bodyweight ? (
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              WEIGHT (LBS)
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className={inputClassName}
            />
          </label>
        ) : null}

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            REPS
          </span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            className={inputClassName}
          />
        </label>
      </div>

      {showFailureCheckbox ? (
        <label className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={toFailure}
            onChange={(event) => setToFailure(event.target.checked)}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
          />
          Mark this set as to failure
        </label>
      ) : null}

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          NOTES
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={textareaClassName}
        />
      </label>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button type="button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save set"}
      </Button>
    </div>
  );
}
