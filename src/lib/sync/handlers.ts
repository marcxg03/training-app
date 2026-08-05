import { detectPRs } from "@/lib/methodology/pr-detection";
import { createClient } from "@/lib/supabase/client";
import { isRetryable } from "@/lib/sync/classify";
import type {
  QueueRow,
  QueueRowKind,
  SetLogInsertPayload,
  WorkoutCompletionBlockCompletePayload,
  WorkoutCompletionEndPayload,
  WorkoutCompletionStartPayload,
} from "@/lib/sync/queue";

export type HandlerResult = {
  errorMessage?: string | null;
  ok: boolean;
  retryable: boolean;
};

type QueueHandler<K extends QueueRowKind> = (
  row: Extract<QueueRow, { kind: K }>,
) => Promise<HandlerResult>;

function getErrorMessage(error: { message?: string } | null | undefined) {
  return error?.message ?? "Sync failed.";
}

function isConflictError(
  status: number,
  error: { code?: string } | null | undefined,
) {
  return status === 409 || error?.code === "23505";
}

function toFailureResult(
  error: { message?: string; status?: number } | null | undefined,
  status: number,
) {
  const errorLike = error
    ? { ...error, status: error.status ?? status }
    : { status };

  return {
    ok: false,
    retryable: isRetryable(errorLike),
    errorMessage: getErrorMessage(error),
  } satisfies HandlerResult;
}

// Rows queued by a pre-migration-023 build carry no completion_id. Inserting
// them as-is would succeed (the column is nullable) and then be invisible to
// every read path, which all filter on completion_id — a silent data loss, and
// the queue row that could have re-linked them is dequeued on success. Resolve
// the session with the same rule migration 023's backfill uses.
async function resolveLegacyCompletionId(
  supabase: ReturnType<typeof createClient>,
  payload: SetLogInsertPayload,
) {
  const { data, error } = await supabase
    .from("workout_completions")
    .select("completion_id")
    .eq("user_id", payload.user_id)
    .eq("workout_id", payload.workout_id)
    .lte("started_at", payload.logged_at)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { completionId: null, error };
  }

  return { completionId: data?.completion_id ?? null, error: null };
}

async function handleSetLogInsert(
  row: Extract<QueueRow, { kind: "set_log_insert" }>,
) {
  const supabase = createClient();
  let payload = row.payload;

  if (!payload.completion_id) {
    const { completionId, error: lookupError } =
      await resolveLegacyCompletionId(supabase, payload);

    if (lookupError) {
      return toFailureResult(lookupError, 0);
    }

    if (!completionId) {
      // Keep the row in the queue and surface it in QueuePanel rather than
      // writing an unreachable set log.
      return {
        ok: false,
        retryable: false,
        errorMessage:
          "Queued before the session-scoping migration and no matching session was found — this set needs to be re-entered.",
      } satisfies HandlerResult;
    }

    payload = { ...payload, completion_id: completionId };
  }

  const { error, status } = await supabase.from("set_logs").insert(payload);

  if (!error || isConflictError(status, error)) {
    return {
      ok: true,
      retryable: false,
      errorMessage: null,
    } satisfies HandlerResult;
  }

  return toFailureResult(error, status);
}

async function handleWorkoutCompletionStart(
  row: Extract<QueueRow, { kind: "workout_completion_start" }>,
) {
  const supabase = createClient();
  const { error, status } = await supabase
    .from("workout_completions")
    .insert(row.payload);

  if (!error || isConflictError(status, error)) {
    return {
      ok: true,
      retryable: false,
      errorMessage: null,
    } satisfies HandlerResult;
  }

  return toFailureResult(error, status);
}

async function handleWorkoutCompletionBlockComplete(
  row: Extract<QueueRow, { kind: "workout_completion_block_complete" }>,
) {
  const supabase = createClient();
  const {
    data: existingCompletion,
    error: loadError,
    status: loadStatus,
  } = await supabase
    .from("workout_completions")
    .select("completed_block_ids")
    .eq("completion_id", row.payload.completion_id)
    .maybeSingle();

  if (loadError) {
    return toFailureResult(loadError, loadStatus);
  }

  if (!existingCompletion) {
    return {
      ok: false,
      retryable: false,
      errorMessage: "Workout completion not found.",
    } satisfies HandlerResult;
  }

  if (existingCompletion.completed_block_ids.includes(row.payload.block_id)) {
    return {
      ok: true,
      retryable: false,
      errorMessage: null,
    } satisfies HandlerResult;
  }

  const { error: updateError, status: updateStatus } = await supabase
    .from("workout_completions")
    .update({
      completed_block_ids: [
        ...existingCompletion.completed_block_ids,
        row.payload.block_id,
      ],
    })
    .eq("completion_id", row.payload.completion_id);

  if (!updateError) {
    return {
      ok: true,
      retryable: false,
      errorMessage: null,
    } satisfies HandlerResult;
  }

  return toFailureResult(updateError, updateStatus);
}

async function handleWorkoutCompletionEnd(
  row: Extract<QueueRow, { kind: "workout_completion_end" }>,
) {
  const supabase = createClient();
  const { error, status } = await supabase
    .from("workout_completions")
    .update({
      completed_at: row.payload.completed_at,
      completed_block_ids: row.payload.completed_block_ids,
      was_ended_early: row.payload.was_ended_early,
    })
    .eq("completion_id", row.payload.completion_id);

  if (!error) {
    return {
      ok: true,
      retryable: false,
      errorMessage: null,
    } satisfies HandlerResult;
  }

  return toFailureResult(error, status);
}

export const handlers: {
  [K in QueueRowKind]: QueueHandler<K>;
} = {
  set_log_insert: handleSetLogInsert,
  workout_completion_start: handleWorkoutCompletionStart,
  workout_completion_block_complete: handleWorkoutCompletionBlockComplete,
  workout_completion_end: handleWorkoutCompletionEnd,
};

export async function runPrDetectionForSetLog(setLog: SetLogInsertPayload) {
  const supabase = createClient();
  const { data: exercise, error: exerciseError } = await supabase
    .from("exercises")
    .select("is_bodyweight")
    .eq("exercise_id", setLog.exercise_id)
    .maybeSingle();

  if (exerciseError) {
    console.error("Failed to load exercise for PR detection", exerciseError);
    return;
  }

  if (!exercise || exercise.is_bodyweight || setLog.weight_kg === null) {
    return;
  }

  const { data: prHistory, error: prHistoryError } = await supabase
    .from("pr_history")
    .select("pr_type, reps, weight_kg")
    .eq("user_id", setLog.user_id)
    .eq("exercise_id", setLog.exercise_id);

  if (prHistoryError) {
    console.error("Failed to load PR history", prHistoryError);
    return;
  }

  const maxWeightKg = prHistory
    .filter((row) => row.pr_type === "weight")
    .reduce<
      number | null
    >((highest, row) => (highest === null || row.weight_kg > highest ? row.weight_kg : highest), null);

  const maxRepsAtWeight = prHistory
    .filter(
      (row) =>
        row.pr_type === "in_range_rep" && row.weight_kg === setLog.weight_kg,
    )
    .reduce<
      number | null
    >((highest, row) => (highest === null || row.reps > highest ? row.reps : highest), null);

  const detectedPRs = detectPRs(setLog, {
    isBodyweight: exercise.is_bodyweight,
    maxRepsAtWeight,
    maxWeightKg,
  });

  for (const detection of detectedPRs) {
    const { error: prInsertError } = await supabase.from("pr_history").insert({
      user_id: setLog.user_id,
      exercise_id: detection.exerciseId,
      set_log_id: setLog.set_log_id,
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

export type QueuePayloads = {
  set_log_insert: SetLogInsertPayload;
  workout_completion_block_complete: WorkoutCompletionBlockCompletePayload;
  workout_completion_end: WorkoutCompletionEndPayload;
  workout_completion_start: WorkoutCompletionStartPayload;
};
