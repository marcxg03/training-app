// Fixture tests for src/lib/methodology/workout-state.ts — run with:
//   pnpm exec tsx scripts/verify-logger.ts
// Exits non-zero on any failure. No test framework needed.
//
// These pin the week-2 lockout regression (migration 023). A weekly plan
// reuses the same workout_id every week; when the logger loaded set_logs by
// workout_id instead of by completion_id, week 1's WU/W1/W2 made every
// 'failure' block look permanently complete, findLastIncompleteBlock returned
// -1, and the logger page auto-wrote completed_at and locked the user out.
import {
  findLastIncompleteBlock,
  getSelectedExerciseIdForBlock,
  isBlockComplete,
  type LoggerBlock,
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
    exercises: [],
    setLogs: [],
    ...overrides,
  };
}

// --- isBlockComplete: 'failure' blocks derive completion from set count ---

check(
  "failure block with no sets is incomplete",
  isBlockComplete(block({ block_id: "block-1" }), []),
  false,
);

check(
  "failure block with 3 distinct set indexes is complete",
  isBlockComplete(
    block({ block_id: "block-1", setLogs: [setLog(1), setLog(2), setLog(3)] }),
    [],
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

// Two exercises logged at the same set_index must not add up to "3 sets".
check(
  "duplicate set indexes do not count toward the 3-set threshold",
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

check(
  "week-2 regression: a block carrying a PRIOR session's 3 sets reports -1",
  findLastIncompleteBlock(
    [block({ block_id: "block-1", setLogs: [setLog(1), setLog(2), setLog(3)] })],
    [],
  ),
  -1,
);

check(
  "advances past a genuinely finished block within one session",
  findLastIncompleteBlock(
    [
      block({
        block_id: "block-1",
        setLogs: [setLog(1), setLog(2), setLog(3)],
      }),
      block({ block_id: "block-2", display_order: 2 }),
    ],
    [],
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

// --- getSelectedExerciseIdForBlock ---

check(
  "selected exercise is null for a session with no sets logged yet",
  getSelectedExerciseIdForBlock(block({ block_id: "block-1" })),
  null,
);

check(
  "selected exercise comes from the first set logged this session",
  getSelectedExerciseIdForBlock(
    block({ block_id: "block-1", setLogs: [setLog(1, "ex-7")] }),
  ),
  "ex-7",
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log("\nAll logger state checks passed");
