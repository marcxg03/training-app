// Fixture tests for src/lib/methodology/workout-state.ts — run with:
//   pnpm exec tsx scripts/verify-logger.ts
// Exits non-zero on any failure. No test framework needed.
//
// These pin the week-2 lockout regression (migration 023). A weekly plan
// reuses the same workout_id every week; when the logger loaded set_logs by
// workout_id instead of by completion_id, week 1's WU/W1/W2 made every
// 'failure' block look permanently complete, findLastIncompleteBlock returned
// -1, and the logger page auto-wrote completed_at and locked the user out.
// D16 (2026-09-22) further hardens this: 'failure' blocks no longer auto-complete
// by set count at all (manual completion only), so the count-based lockout path
// is now structurally impossible regardless of which set_logs are loaded.
import {
  findLastIncompleteBlock,
  getSelectedExerciseIdForBlock,
  isBlockComplete,
  priorExerciseLabel,
  type LoggerBlock,
  type LoggerExercise,
  type LoggerSetLog,
} from "../src/lib/methodology/workout-state";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures += 1;
    console.error(
      `✗ ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`,
    );
  } else {
    console.log(`✓ ${name}`);
  }
}

function setLog(setIndex: number, exerciseId = "ex-1"): LoggerSetLog {
  return {
    set_log_id: `set-${setIndex}-${exerciseId}`,
    user_id: "user-1",
    workout_id: "workout-1",
    block_id: "block-1",
    exercise_id: exerciseId,
    set_index: setIndex,
    weight_kg: 100,
    reps: 8,
    is_to_failure: false,
    prescribed_min: 5,
    prescribed_max: 8,
    notes: null,
    logged_at: "2026-08-03T15:00:00.000Z",
    prTypes: [],
  };
}

function block(
  overrides: Partial<LoggerBlock> & Pick<LoggerBlock, "block_id">,
): LoggerBlock {
  return {
    block_name: "Block",
    block_type: "failure",
    display_order: 1,
    warmupSets: 1,
    workingSets: 2,
    toFailure: false,
    exercises: [],
    setLogs: [],
    ...overrides,
  };
}

// --- isBlockComplete: ALL blocks complete manually via completedBlockIds ---
// (D16, 2026-09-22: working_sets is a SOFT TARGET, not an auto-complete cap —
// a 'failure' block no longer auto-completes by set count; it completes only
// when the user taps "Complete block", like free-form/mobility blocks.)

check(
  "failure block with no sets is incomplete",
  isBlockComplete(block({ block_id: "block-1" }), []),
  false,
);

check(
  "failure block with target sets logged is STILL incomplete until manually completed",
  isBlockComplete(
    block({ block_id: "block-1", setLogs: [setLog(1), setLog(2), setLog(3)] }),
    [],
  ),
  false,
);

check(
  "failure block is complete once its id is in completedBlockIds",
  isBlockComplete(
    block({ block_id: "block-1", setLogs: [setLog(1), setLog(2), setLog(3)] }),
    ["block-1"],
  ),
  true,
);

check(
  "failure block with 2 sets is incomplete",
  isBlockComplete(
    block({ block_id: "block-1", setLogs: [setLog(1), setLog(2)] }),
    [],
  ),
  false,
);

// Completion is count-independent now: no number of set logs completes a block
// on its own (only completedBlockIds does).
check(
  "set count never drives completion (count-independent, manual model)",
  isBlockComplete(
    block({
      block_id: "block-1",
      setLogs: [setLog(1, "ex-1"), setLog(1, "ex-2"), setLog(2, "ex-1")],
    }),
    [],
  ),
  false,
);

// --- isBlockComplete: non-failure blocks gate on completedBlockIds ---

check(
  "mobility block ignores set logs and gates on completedBlockIds",
  isBlockComplete(
    block({
      block_id: "block-1",
      block_type: "mobility",
      setLogs: [setLog(1), setLog(2), setLog(3)],
    }),
    [],
  ),
  false,
);

check(
  "mobility block is complete once its id is in completedBlockIds",
  isBlockComplete(
    block({ block_id: "block-1", block_type: "mobility" }),
    ["block-1"],
  ),
  true,
);

// --- findLastIncompleteBlock: THE regression ---

// A fresh session now starts with zero set logs, because the logger fetches
// them by completion_id. Before migration 023 the same block arrived carrying
// last week's three sets and this returned -1 → auto-complete → lockout.
check(
  "fresh session: first failure block is the starting point (not -1)",
  findLastIncompleteBlock(
    [
      block({ block_id: "block-1" }),
      block({ block_id: "block-2", display_order: 2 }),
    ],
    [],
  ),
  0,
);

// D16 strengthens the week-2 guarantee: a block carrying a prior session's sets
// is NOT auto-complete (completion is manual), so it reports as the active block
// (index 0), never -1 → the auto-complete lockout is now structurally impossible.
check(
  "week-2: a block carrying a PRIOR session's sets is NOT auto-complete → still incomplete (0), no lockout",
  findLastIncompleteBlock(
    [block({ block_id: "block-1", setLogs: [setLog(1), setLog(2), setLog(3)] })],
    [],
  ),
  0,
);

check(
  "advances past a manually-completed block within one session",
  findLastIncompleteBlock(
    [
      block({
        block_id: "block-1",
        setLogs: [setLog(1), setLog(2), setLog(3)],
      }),
      block({ block_id: "block-2", display_order: 2 }),
    ],
    ["block-1"],
  ),
  1,
);

// An empty blocks array also yields -1, which the logger page reads as
// "workout finished" and would auto-write completed_at for. page.tsx guards
// blocks.length === 0 before creating a completion — this pins why.
check(
  "empty blocks array returns -1 (why page.tsx guards blocks.length === 0)",
  findLastIncompleteBlock([], []),
  -1,
);

// The REAL "workout finished" signal: a POPULATED blocks list whose ids are ALL
// in completedBlockIds returns -1 → LoggerShell's advanceToNextBlock calls
// completeSession (last-block finish → summary). This is the empty-array guard's
// non-trivial sibling — the last block being completed must end the workout.
check(
  "all blocks complete (populated list, every id in completedBlockIds) returns -1 → finish",
  findLastIncompleteBlock(
    [
      block({ block_id: "b1" }),
      block({ block_id: "b2", display_order: 2 }),
    ],
    ["b1", "b2"],
  ),
  -1,
);

check(
  "one of two blocks complete advances to b2 (index 1), does NOT finish",
  findLastIncompleteBlock(
    [
      block({ block_id: "b1" }),
      block({ block_id: "b2", display_order: 2 }),
    ],
    ["b1"],
  ),
  1,
);

// --- getSelectedExerciseIdForBlock ---

check(
  "selected exercise is null for a session with no sets logged yet",
  getSelectedExerciseIdForBlock(block({ block_id: "block-1" })),
  null,
);

check(
  "selected exercise comes from the set logged this session",
  getSelectedExerciseIdForBlock(
    block({ block_id: "block-1", setLogs: [setLog(1, "ex-7")] }),
  ),
  "ex-7",
);

// T2-D — the mid-block SWAP contract. A block whose exercise was changed after
// sets were already logged holds set_logs against BOTH exercises (append-only:
// the earlier ones are never rewritten). The picker must resume on the exercise
// the user swapped TO, i.e. the one the LATEST set was logged under — reading
// setLogs[0] would snap it back to the abandoned exercise on every reload and
// silently undo the swap.
check(
  "after a swap, the selection follows the LATEST set, not the first",
  getSelectedExerciseIdForBlock(
    block({
      block_id: "block-1",
      setLogs: [setLog(1, "ex-old"), setLog(2, "ex-new")],
    }),
  ),
  "ex-new",
);

// The loader does not guarantee row order, so the comparison must be on
// set_index rather than array position.
check(
  "latest-set selection is decided by set_index, not array order",
  getSelectedExerciseIdForBlock(
    block({
      block_id: "block-1",
      setLogs: [setLog(3, "ex-new"), setLog(1, "ex-old"), setLog(2, "ex-old")],
    }),
  ),
  "ex-new",
);

// --- priorExerciseLabel: honest attribution of already-logged sets (T2-D) ---
function exercise(id: string, name: string): LoggerExercise {
  return {
    exercise_id: id,
    name,
    notes: "",
    prescribed_min: 6,
    prescribed_max: 8,
    muscle_groups: ["chest"],
    is_bodyweight: false,
    media_path: null,
    media_type: null,
  };
}

const swappedBlock = {
  exercises: [exercise("ex-old", "Incline Press"), exercise("ex-new", "Dip")],
};

check(
  "a set logged under the CURRENT exercise needs no label (the picker names it)",
  priorExerciseLabel(swappedBlock, "ex-new", "ex-new"),
  null,
);
check(
  "a set logged under the PREVIOUS exercise says which one it belongs to",
  priorExerciseLabel(swappedBlock, "ex-old", "ex-new"),
  "Incline Press",
);
check(
  "an exercise the block no longer offers degrades to a phrase, never a raw id",
  priorExerciseLabel(swappedBlock, "ex-gone", "ex-new"),
  "a previous exercise",
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log("\nAll logger state checks passed");
