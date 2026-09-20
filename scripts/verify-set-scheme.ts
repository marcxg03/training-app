// Fixture tests for the adjustable per-block set-scheme (Slice B1).
// Run with:
//   pnpm exec tsx scripts/verify-set-scheme.ts
// Exits non-zero on any failure. No test framework needed.
//
// The set scheme is three additive columns on `blocks`
// (warmup_sets / working_sets / to_failure, migration 025) projected onto
// LoggerBlock as warmupSets / workingSets / toFailure. isBlockComplete must
// auto-complete a 'failure' block at warmupSets + workingSets distinct set
// indexes — NOT the hardcoded 3 it used before this slice.
//
// WRITTEN TO FAIL FIRST: against the pre-slice code (threshold hardcoded to 3)
// the {warmup:0, working:2, to_failure:true} case with 2 sets returns false
// where it must return true.
import {
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
    warmupSets: 1,
    workingSets: 2,
    toFailure: false,
    exercises: [],
    setLogs: [],
    ...overrides,
  };
}

// --- (a) Legacy default block {warmup:1, working:2} → threshold 3 ---

check(
  "legacy default {1,2}: 2 distinct set indexes is INCOMPLETE",
  isBlockComplete(
    block({ block_id: "block-1", setLogs: [setLog(1), setLog(2)] }),
    [],
  ),
  false,
);

check(
  "legacy default {1,2}: 3 distinct set indexes is COMPLETE",
  isBlockComplete(
    block({ block_id: "block-1", setLogs: [setLog(1), setLog(2), setLog(3)] }),
    [],
  ),
  true,
);

// --- (b) 2 working sets to failure {warmup:0, working:2} → threshold 2 ---
// This is the RED assertion: pre-slice code hardcodes >= 3, so 2 sets returns
// false where the scheme requires true.

check(
  "{0,2,failure}: 1 distinct set index is INCOMPLETE",
  isBlockComplete(
    block({
      block_id: "block-1",
      warmupSets: 0,
      workingSets: 2,
      toFailure: true,
      setLogs: [setLog(1)],
    }),
    [],
  ),
  false,
);

check(
  "{0,2,failure}: 2 distinct set indexes is COMPLETE",
  isBlockComplete(
    block({
      block_id: "block-1",
      warmupSets: 0,
      workingSets: 2,
      toFailure: true,
      setLogs: [setLog(1), setLog(2)],
    }),
    [],
  ),
  true,
);

// A wider scheme {2,3} → threshold 5, to prove it is not fixed at 2 or 3.
check(
  "{2,3}: 4 distinct set indexes is INCOMPLETE",
  isBlockComplete(
    block({
      block_id: "block-1",
      warmupSets: 2,
      workingSets: 3,
      setLogs: [setLog(1), setLog(2), setLog(3), setLog(4)],
    }),
    [],
  ),
  false,
);

check(
  "{2,3}: 5 distinct set indexes is COMPLETE",
  isBlockComplete(
    block({
      block_id: "block-1",
      warmupSets: 2,
      workingSets: 3,
      setLogs: [setLog(1), setLog(2), setLog(3), setLog(4), setLog(5)],
    }),
    [],
  ),
  true,
);

// Duplicate set indexes (two exercises at the same slot) still count once.
check(
  "{0,2,failure}: duplicate set indexes do not double-count",
  isBlockComplete(
    block({
      block_id: "block-1",
      warmupSets: 0,
      workingSets: 2,
      toFailure: true,
      setLogs: [setLog(1, "ex-1"), setLog(1, "ex-2")],
    }),
    [],
  ),
  false,
);

// --- (c) Non-failure block: explicit-complete path, ignores the scheme ---

check(
  "mobility block ignores set count and gates on completedBlockIds (incomplete)",
  isBlockComplete(
    block({
      block_id: "block-1",
      block_type: "mobility",
      warmupSets: 0,
      workingSets: 2,
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

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log("\nAll set-scheme checks passed");
