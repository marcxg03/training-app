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
  workout_id: string;
};

export type LoggerBlock = {
  block_id: string;
  block_name: string;
  block_type: NonNullable<Tables<"blocks">["block_type"]>;
  display_order: number;
  exercises: LoggerExercise[];
  setLogs: LoggerSetLog[];
};

export type LoggerWorkout = {
  workout_id: string;
  workout_name: string;
  workout_type: Enums<"session_type_enum">;
  dayOfWeek: Enums<"day_of_week_enum">;
};

export type WorkoutCompletionRecord = Tables<"workout_completions">;

type SessionCompletionStore = {
  create: (
    payload: TablesInsert<"workout_completions">,
  ) => Promise<WorkoutCompletionRecord>;
  findLatestForToday: (args: {
    workoutId: string;
    startedAfterIso: string;
    userId: string;
  }) => Promise<WorkoutCompletionRecord | null>;
};

export async function getOrCreateWorkoutCompletion(
  store: SessionCompletionStore,
  workoutId: string,
  userId: string,
  startedAfterIso: string,
  nowIso: string = new Date().toISOString(),
) {
  const existing = await store.findLatestForToday({
    workoutId,
    startedAfterIso,
    userId,
  });

  if (existing) {
    return existing;
  }

  return store.create({
    user_id: userId,
    workout_id: workoutId,
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
