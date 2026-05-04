import type { Tables } from "@/lib/supabase/types";

export const QUEUE_STORAGE_NAMESPACE = "training-app:queue";
export const QUEUE_CHANGE_EVENT = "queue-change";
export const MAX_QUEUE_ERROR_LENGTH = 200;

export const queueRowKinds = [
  "set_log_insert",
  "workout_completion_start",
  "workout_completion_block_complete",
  "workout_completion_end",
] as const;

export type QueueRowKind = (typeof queueRowKinds)[number];

export type SetLogInsertPayload = Pick<
  Tables<"set_logs">,
  | "block_id"
  | "exercise_id"
  | "is_to_failure"
  | "logged_at"
  | "notes"
  | "prescribed_max"
  | "prescribed_min"
  | "reps"
  | "set_index"
  | "set_log_id"
  | "user_id"
  | "weight_kg"
  | "workout_id"
>;

export type WorkoutCompletionStartPayload = Pick<
  Tables<"workout_completions">,
  | "completed_at"
  | "completed_block_ids"
  | "completion_id"
  | "started_at"
  | "user_id"
  | "was_ended_early"
  | "workout_id"
>;

export type WorkoutCompletionBlockCompletePayload = {
  block_id: string;
  completion_id: string;
};

export type WorkoutCompletionEndPayload = Pick<
  Tables<"workout_completions">,
  "completed_block_ids" | "completion_id" | "was_ended_early"
> & {
  completed_at: string;
};

type QueueRowBase<K extends string, P> = {
  attempts: number;
  enqueued_at: string;
  id: string;
  kind: K;
  last_attempt_at: string | null;
  last_error: string | null;
  payload: P;
};

export type QueueRow =
  | QueueRowBase<"set_log_insert", SetLogInsertPayload>
  | QueueRowBase<"workout_completion_start", WorkoutCompletionStartPayload>
  | QueueRowBase<
      "workout_completion_block_complete",
      WorkoutCompletionBlockCompletePayload
    >
  | QueueRowBase<"workout_completion_end", WorkoutCompletionEndPayload>;

export type UnknownQueueRow = QueueRowBase<string, unknown>;
export type StoredQueueRow = QueueRow | UnknownQueueRow;

export type QueueChangeDetail = {
  userId: string;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function getQueuePrefix(userId: string) {
  return `${QUEUE_STORAGE_NAMESPACE}:${userId}:`;
}

function getQueueKey(userId: string, rowId: string) {
  return `${getQueuePrefix(userId)}${rowId}`;
}

function isQueueRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredQueueRow(value: unknown): value is StoredQueueRow {
  if (!isQueueRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    "payload" in value &&
    typeof value.attempts === "number" &&
    typeof value.enqueued_at === "string" &&
    (typeof value.last_attempt_at === "string" ||
      value.last_attempt_at === null) &&
    (typeof value.last_error === "string" || value.last_error === null)
  );
}

function normalizeStoredQueueRow(row: StoredQueueRow): StoredQueueRow {
  if (!isQueueRecord(row.payload)) {
    return row;
  }

  const payload = row.payload as Record<string, unknown>;

  if (row.kind === "session_completion_start") {
    return {
      ...row,
      kind: "workout_completion_start",
      payload: {
        ...payload,
        workout_id:
          typeof payload.workout_id === "string"
            ? payload.workout_id
            : payload.session_id,
      },
    } as StoredQueueRow;
  }

  if (row.kind === "session_completion_block_complete") {
    return {
      ...row,
      kind: "workout_completion_block_complete",
    } as StoredQueueRow;
  }

  if (row.kind === "session_completion_end") {
    return {
      ...row,
      kind: "workout_completion_end",
    } as StoredQueueRow;
  }

  if (row.kind === "set_log_insert" && typeof payload.session_id === "string") {
    return {
      ...row,
      payload: {
        ...payload,
        workout_id:
          typeof payload.workout_id === "string"
            ? payload.workout_id
            : payload.session_id,
      },
    } as StoredQueueRow;
  }

  return row;
}

export function isKnownQueueKind(kind: string): kind is QueueRowKind {
  return queueRowKinds.includes(kind as QueueRowKind);
}

export function emitQueueChange(userId: string) {
  if (!hasWindow()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<QueueChangeDetail>(QUEUE_CHANGE_EVENT, {
      detail: { userId },
    }),
  );
}

export function enqueue(userId: string, row: QueueRow) {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(getQueueKey(userId, row.id), JSON.stringify(row));
  emitQueueChange(userId);
}

export function dequeue(userId: string, rowId: string) {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(getQueueKey(userId, rowId));
  emitQueueChange(userId);
}

export function loadQueue(userId: string) {
  if (!hasWindow()) {
    return [] as StoredQueueRow[];
  }

  const prefix = getQueuePrefix(userId);
  const rows: StoredQueueRow[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key || !key.startsWith(prefix)) {
      continue;
    }

    const rawValue = window.localStorage.getItem(key);

    if (!rawValue) {
      continue;
    }

    try {
      const parsedValue = JSON.parse(rawValue);

      if (!isStoredQueueRow(parsedValue)) {
        console.warn("Skipping invalid queue row", key);
        continue;
      }

      const normalizedValue = normalizeStoredQueueRow(parsedValue);

      if (JSON.stringify(parsedValue) !== JSON.stringify(normalizedValue)) {
        window.localStorage.setItem(key, JSON.stringify(normalizedValue));
      }

      rows.push(normalizedValue);
    } catch (error) {
      console.warn("Failed to parse queue row", key, error);
    }
  }

  return rows.sort((left, right) =>
    left.enqueued_at.localeCompare(right.enqueued_at),
  );
}

export function updateAttempt(
  userId: string,
  rowId: string,
  error: string | null,
) {
  if (!hasWindow()) {
    return;
  }

  const key = getQueueKey(userId, rowId);
  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!isStoredQueueRow(parsedValue)) {
      console.warn("Skipping invalid queue row update", key);
      return;
    }

    const nextRow: StoredQueueRow = {
      ...normalizeStoredQueueRow(parsedValue),
      attempts: parsedValue.attempts + 1,
      last_attempt_at: new Date().toISOString(),
      last_error: error ? error.slice(0, MAX_QUEUE_ERROR_LENGTH) : null,
    };

    window.localStorage.setItem(key, JSON.stringify(nextRow));
    emitQueueChange(userId);
  } catch (caughtError) {
    console.warn("Failed to update queue row", key, caughtError);
  }
}
