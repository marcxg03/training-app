import type { Enums, Tables, TablesInsert } from "@/lib/supabase/types";

export type LoggerExercise = Pick<
  Tables<"exercises">,
  | "exercise_id"
  | "name"
  | "notes"
  | "prescribed_min"
  | "prescribed_max"
  | "muscle_groups"
  | "is_bodyweight"
>;

export type LoggerSetLog = Pick<
  Tables<"set_logs">,
  | "set_log_id"
  | "user_id"
  | "session_id"
  | "block_id"
  | "exercise_id"
  | "set_index"
  | "weight_kg"
  | "reps"
  | "is_to_failure"
  | "prescribed_min"
  | "prescribed_max"
  | "notes"
  | "logged_at"
> & {
  prTypes: Enums<"pr_type_enum">[];
};

export type LoggerBlock = Pick<
  Tables<"blocks">,
  "block_id" | "block_name" | "block_type" | "display_order"
> & {
  exercises: LoggerExercise[];
  setLogs: LoggerSetLog[];
};

export type LoggerSession = Pick<
  Tables<"sessions">,
  "session_id" | "session_name" | "session_type"
> & {
  dayOfWeek: Enums<"day_of_week_enum">;
};

export type SessionCompletionRecord = Tables<"session_completions">;

type SessionCompletionStore = {
  create: (
    payload: TablesInsert<"session_completions">,
  ) => Promise<SessionCompletionRecord>;
  findLatestForToday: (args: {
    sessionId: string;
    startedAfterIso: string;
    userId: string;
  }) => Promise<SessionCompletionRecord | null>;
};

export async function getOrCreateSessionCompletion(
  store: SessionCompletionStore,
  sessionId: string,
  userId: string,
  startedAfterIso: string,
  nowIso: string = new Date().toISOString(),
) {
  const existing = await store.findLatestForToday({
    sessionId,
    startedAfterIso,
    userId,
  });

  if (existing) {
    return existing;
  }

  return store.create({
    user_id: userId,
    session_id: sessionId,
    started_at: nowIso,
    completed_block_ids: [],
    was_ended_early: false,
  });
}

export function getSelectedExerciseIdForBlock(block: LoggerBlock) {
  return block.setLogs[0]?.exercise_id ?? null;
}

export function isBlockComplete(
  block: LoggerBlock,
  completedBlockIds: readonly string[],
) {
  if (block.block_type === "failure") {
    return new Set(block.setLogs.map((setLog) => setLog.set_index)).size >= 3;
  }

  return completedBlockIds.includes(block.block_id);
}

export function findLastIncompleteBlock(
  blocks: readonly LoggerBlock[],
  completedBlockIds: readonly string[],
) {
  return blocks.findIndex(
    (block) => !isBlockComplete(block, completedBlockIds),
  );
}
