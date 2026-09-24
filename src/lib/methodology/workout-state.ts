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
  // Mid-workout the picker shows the movement, not just its name (T2-B).
  // NULL for most of the library — every render site must degrade.
  | "media_path"
  | "media_type"
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

/** The label for a completed set at `setIndex` under a block's scheme.
 *
 * D16: `working_sets` is a soft target, so a user may log working sets BEYOND
 * the scheme's target slots ("+ Add working set"). Those added sets continue the
 * working-set numbering — an index past `warmupSets + workingSets` labels
 * `W{setIndex - warmupSets}` (W3, W4…). The `Set N` fallback is reserved for a
 * truly invalid index (<= 0). */
export function getSetLabel(
  block: Pick<LoggerBlock, "warmupSets" | "workingSets" | "toFailure">,
  setIndex: number,
) {
  const targetStep = getSetSchemeSteps(block).find(
    (step) => step.setIndex === setIndex,
  );

  if (targetStep) {
    return targetStep.label;
  }

  // An index beyond the warm-ups is an added working set — keep counting Ws.
  if (setIndex > block.warmupSets) {
    return `W${setIndex - block.warmupSets}`;
  }

  return `Set ${setIndex}`;
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

/** Which exercise a block is currently on, derived from what has actually been
 * logged — the resume path, and the fallback whenever local selection state is
 * absent (a fresh page load).
 *
 * The MOST RECENTLY logged set decides, not the first (T2-D). Sets are
 * append-only: swapping a block's exercise mid-session leaves the earlier sets
 * attributed to the exercise they were logged under, so reading `setLogs[0]`
 * would snap the picker back to the abandoned exercise on every reload and
 * silently undo the swap. Compared on `set_index` rather than array position,
 * because the loader does not guarantee an order. */
export function getSelectedExerciseIdForBlock(block: LoggerBlock) {
  let latest: LoggerBlock["setLogs"][number] | null = null;

  for (const setLog of block.setLogs) {
    if (latest === null || setLog.set_index > latest.set_index) {
      latest = setLog;
    }
  }

  return latest?.exercise_id ?? null;
}

/** The exercise name a logged set row should carry, or null when it needs none.
 *
 * After a mid-block swap (T2-D) the block's earlier sets are still attributed
 * to the exercise they were logged under — append-only, nothing rewrites them —
 * so those rows say so. A row logged under the CURRENT exercise needs no label:
 * the picker above it already names that exercise. An id the block no longer
 * offers (an ad-hoc exercise removed from local state) degrades to a generic
 * phrase rather than rendering a raw uuid or nothing at all. */
export function priorExerciseLabel(
  block: Pick<LoggerBlock, "exercises">,
  setLogExerciseId: string,
  currentExerciseId: string,
): string | null {
  if (setLogExerciseId === currentExerciseId) {
    return null;
  }

  return (
    block.exercises.find(
      (exercise) => exercise.exercise_id === setLogExerciseId,
    )?.name ?? "a previous exercise"
  );
}

/** True once at least one WORKING set (a set past the warm-ups) is logged. This
 * gates the "Complete block" action so a block can be finished EARLY — stop at 1
 * of 2 working sets on a weak day. The target (working_sets) is soft both ways:
 * add more above it (getSetSchemeSteps + add-set), or finish below it here. */
export function hasLoggedWorkingSet(
  block: Pick<LoggerBlock, "warmupSets" | "setLogs">,
) {
  return block.setLogs.some((setLog) => setLog.set_index > block.warmupSets);
}

export function isBlockComplete(
  block: LoggerBlock,
  completedBlockIds: readonly string[],
) {
  // D16 (2026-09-22): `working_sets` is a SOFT TARGET, not an auto-complete cap.
  // A scheme block ('failure') NO LONGER auto-completes when the logged set count
  // reaches warmupSets + workingSets — the user can always add more working sets
  // (W3, W4…). Every block, scheme or free-form, completes ONLY when its id is in
  // completedBlockIds via the manual "Complete block" / "Done with this block"
  // action. `toFailure` remains a per-set concern, never a completion trigger.
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

/** The set_index for the NEXT added working set on a 'failure' block (D16:
 * working sets beyond the target). Extracted from FailureProtocol's inline
 * `Math.max(maxLoggedIndex + 1, targetCount + 1)` so the offline set_index this
 * writes is named and testable. Continues past both the highest logged index
 * and the target slot count, so an added set never collides with a target slot
 * or a prior added set. */
export function nextAddedSetIndex(
  block: Pick<LoggerBlock, "warmupSets" | "workingSets" | "setLogs">,
) {
  const targetCount = blockSetCount(block);
  const maxLoggedIndex = block.setLogs.reduce(
    (max, setLog) => Math.max(max, setLog.set_index),
    0,
  );

  return Math.max(maxLoggedIndex + 1, targetCount + 1);
}

/** Which scheme actions a 'failure' block should offer (D16 soft-target rule),
 * as pure predicates extracted from FailureProtocol's inline button gating:
 * - `showAdd`  — the full target scheme is logged, so another working set (W3,
 *   W4…) may be added. (The component still ANDs a local `!isAddingSet` UI
 *   guard so the button hides while the pad is open.)
 * - `showComplete` — at least one working set is logged, so a weak day (1 of 2)
 *   can finish early. The target is soft both ways. */
export function getSchemeActions(
  block: Pick<LoggerBlock, "warmupSets" | "workingSets" | "setLogs">,
): { showAdd: boolean; showComplete: boolean } {
  const targetCount = blockSetCount(block);
  const targetComplete = Array.from(
    { length: targetCount },
    (_, offset) => offset + 1,
  ).every((setIndex) =>
    block.setLogs.some((setLog) => setLog.set_index === setIndex),
  );

  return {
    showAdd: targetComplete,
    showComplete: hasLoggedWorkingSet(block),
  };
}

/** The block-type badge label ("upper_body" → "UPPER-BODY"). Hoisted here as the
 * single source (was triplicated across BlockList, BlockHeader, LoggerShell). */
export function formatBlockType(blockType: string) {
  return blockType.replace(/_/g, "-").toUpperCase();
}
