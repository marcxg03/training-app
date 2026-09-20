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
  /** NOTE: `block_type === "failure"` means the block "uses the structured
   * set-scheme protocol" (warm-ups + working sets, auto-completing at the last
   * set) — it is NOT the to-failure flag. Whether the last working set is
   * actually taken to failure is the separate `toFailure` column below. */
  block_type: NonNullable<Tables<"blocks">["block_type"]>;
  display_order: number;
  /** Per-block set scheme (migration 025). Legacy blocks default to
   * warmupSets:1 / workingSets:2 / toFailure:false — the old fixed 3-set
   * WU + W1 + W2 shape. */
  warmupSets: number;
  workingSets: number;
  toFailure: boolean;
  exercises: LoggerExercise[];
  setLogs: LoggerSetLog[];
};

/** One prescribed set slot in a block's scheme. Roles are DERIVED from
 * set_index position (no set_role column): the first `warmupSets` slots are
 * warm-ups, the rest working sets; the last working set carries the failure
 * checkbox iff the block is `toFailure`. set_index is 1-based. */
export type SetSchemeStep = {
  label: string;
  setIndex: number;
  isWarmup: boolean;
  isLast: boolean;
  showFailureCheckbox: boolean;
};

/** The total number of prescribed sets — the auto-complete threshold for a
 * 'failure' block. */
export function blockSetCount(
  block: Pick<LoggerBlock, "warmupSets" | "workingSets">,
) {
  return block.warmupSets + block.workingSets;
}

/** Expands a block's scheme into its ordered set slots. Warm-ups label
 * WU, WU2, WU3…; working sets label W1..Wm. Used by the logger to render the
 * right number of slots and by set-label lookup on completed sets. */
export function getSetSchemeSteps(
  block: Pick<LoggerBlock, "warmupSets" | "workingSets" | "toFailure">,
): SetSchemeStep[] {
  const total = block.warmupSets + block.workingSets;
  const steps: SetSchemeStep[] = [];

  for (let setIndex = 1; setIndex <= total; setIndex += 1) {
    const isWarmup = setIndex <= block.warmupSets;
    const isLast = setIndex === total;
    const label = isWarmup
      ? setIndex === 1
        ? "WU"
        : `WU${setIndex}`
      : `W${setIndex - block.warmupSets}`;

    steps.push({
      label,
      setIndex,
      isWarmup,
      isLast,
      showFailureCheckbox: isLast && block.toFailure,
    });
  }

  return steps;
}

/** True when `savedIndex` is the final prescribed set of the block's scheme —
 * the set whose save triggers block completion. Pure predicate extracted from
 * the logger's inline `set_index === lastSetIndex` so the completion trigger is
 * named and independently testable. */
export function isLastSchemeSet(
  block: Pick<LoggerBlock, "warmupSets" | "workingSets">,
  savedIndex: number,
) {
  return savedIndex === blockSetCount(block);
}

/** The label for a completed set at `setIndex` under a block's scheme, with a
 * `Set N` fallback for any index outside the scheme (e.g. a legacy stray). */
export function getSetLabel(
  block: Pick<LoggerBlock, "warmupSets" | "workingSets" | "toFailure">,
  setIndex: number,
) {
  return (
    getSetSchemeSteps(block).find((step) => step.setIndex === setIndex)
      ?.label ?? `Set ${setIndex}`
  );
}

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
  // block_type === "failure" = "uses the structured set-scheme protocol" (see
  // LoggerBlock.block_type). The separate `toFailure` column decides whether the
  // last working set is taken to failure; it does not gate completion here.
  if (block.block_type === "failure") {
    return (
      new Set(block.setLogs.map((setLog) => setLog.set_index)).size >=
      blockSetCount(block)
    );
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
