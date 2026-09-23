// Fixture tests for the adjustable per-block set-scheme (Slice B1 + D16 revision).
// Run with:
//   pnpm exec tsx scripts/verify-set-scheme.ts
// Exits non-zero on any failure. No test framework needed.
//
// The set scheme is three additive columns on `blocks`
// (warmup_sets / working_sets / to_failure, migration 025) projected onto
// LoggerBlock as warmupSets / workingSets / toFailure.
//
// D16 (2026-09-22): `working_sets` is a SOFT TARGET, not a hard auto-complete
// cap. isBlockComplete NO LONGER auto-completes a 'failure' block by set count —
// a scheme block completes ONLY when its block_id is in completedBlockIds
// (manual "Complete block" tap), exactly like the non-failure free-form path.
// getSetSchemeSteps still expands the TARGET slots (warmups + target working);
// getSetLabel continues the working-set numbering for ADDED sets beyond the
// target (W3, W4…), keeping `Set N` only for truly invalid indexes.
//
// WRITTEN TO FAIL FIRST: against the pre-D16 code (isBlockComplete auto-completes
// a 'failure' block at warmupSets+workingSets distinct indexes) the cases below
// that log the full target count with an EMPTY completedBlockIds return true
// where the new model requires false.
import {
  getSchemeActions,
  getSetLabel,
  getSetSchemeSteps,
  hasLoggedWorkingSet,
  isBlockComplete,
  isLastSchemeSet,
  nextAddedSetIndex,
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

// --- (a) D16: a 'failure' block is MANUAL-complete, count-independent ---
// The set count NEVER auto-completes the block. Only completedBlockIds membership
// does. These are the RED assertions: pre-D16 code returns true at the count.

check(
  "failure {1,2}: 2 logged sets, not in completedBlockIds → INCOMPLETE",
  isBlockComplete(
    block({ block_id: "block-1", setLogs: [setLog(1), setLog(2)] }),
    [],
  ),
  false,
);

check(
  "failure {1,2}: 3 logged sets (target met) but NOT in completedBlockIds → INCOMPLETE",
  isBlockComplete(
    block({ block_id: "block-1", setLogs: [setLog(1), setLog(2), setLog(3)] }),
    [],
  ),
  false,
);

check(
  "failure {1,2}: 3 logged sets AND in completedBlockIds → COMPLETE",
  isBlockComplete(
    block({ block_id: "block-1", setLogs: [setLog(1), setLog(2), setLog(3)] }),
    ["block-1"],
  ),
  true,
);

check(
  "failure {1,2}: ZERO logged sets but in completedBlockIds → COMPLETE (manual)",
  isBlockComplete(block({ block_id: "block-1", setLogs: [] }), ["block-1"]),
  true,
);

// {0,2,failure}: even the exact target count does not auto-complete.
check(
  "failure {0,2}: 2 logged sets (target met), empty completedBlockIds → INCOMPLETE",
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
  false,
);

check(
  "failure {0,2}: 2 logged sets AND in completedBlockIds → COMPLETE",
  isBlockComplete(
    block({
      block_id: "block-1",
      warmupSets: 0,
      workingSets: 2,
      toFailure: true,
      setLogs: [setLog(1), setLog(2)],
    }),
    ["block-1"],
  ),
  true,
);

// Added working sets BEYOND the target still don't auto-complete.
check(
  "failure {0,2}: 4 logged sets (2 over target), empty completedBlockIds → INCOMPLETE",
  isBlockComplete(
    block({
      block_id: "block-1",
      warmupSets: 0,
      workingSets: 2,
      toFailure: true,
      setLogs: [setLog(1), setLog(2), setLog(3), setLog(4)],
    }),
    [],
  ),
  false,
);

// --- (b) Non-failure block: explicit-complete path (unchanged by D16) ---

check(
  "mobility block gates on completedBlockIds (incomplete despite logged sets)",
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

// D16 parity: failure and non-failure blocks now share the SAME completion rule.
check(
  "failure and mobility blocks complete identically on completedBlockIds membership",
  [
    isBlockComplete(block({ block_id: "b", block_type: "failure" }), ["b"]),
    isBlockComplete(block({ block_id: "b", block_type: "mobility" }), ["b"]),
  ],
  [true, true],
);

// --- (c) getSetSchemeSteps: the failure-checkbox gate (guards the D11 regression) ---
// The last TARGET step carries showFailureCheckbox iff the block is toFailure.

check(
  "{1,2,toFailure:true}: last step shows the failure checkbox",
  getSetSchemeSteps({ warmupSets: 1, workingSets: 2, toFailure: true }).at(-1)
    ?.showFailureCheckbox,
  true,
);

check(
  "{1,2,toFailure:false}: last step hides the failure checkbox",
  getSetSchemeSteps({ warmupSets: 1, workingSets: 2, toFailure: false }).at(-1)
    ?.showFailureCheckbox,
  false,
);

// --- (d) getSetSchemeSteps labels the TARGET slots (warmup=0 emits no WU) ---

check(
  "{0,2,failure}: target labels are the two working sets only (no WU)",
  getSetSchemeSteps({ warmupSets: 0, workingSets: 2, toFailure: true }).map(
    (step) => step.label,
  ),
  ["W1", "W2"],
);

check(
  "{1,2}: target labels are WU + W1 + W2",
  getSetSchemeSteps({ warmupSets: 1, workingSets: 2, toFailure: false }).map(
    (step) => step.label,
  ),
  ["WU", "W1", "W2"],
);

// --- (e) D16: getSetLabel continues working-set numbering PAST the target ---
// Added working sets (index beyond warmup+working) label W3, W4… — NOT `Set N`.

check(
  "{0,2}: added set index 3 (target=2) labels W3, not `Set 3`",
  getSetLabel({ warmupSets: 0, workingSets: 2, toFailure: false }, 3),
  "W3",
);

check(
  "{0,2}: added set index 4 labels W4 (sequence continues)",
  getSetLabel({ warmupSets: 0, workingSets: 2, toFailure: false }, 4),
  "W4",
);

check(
  "{1,2}: added set index 4 (after WU+W1+W2) labels W3",
  getSetLabel({ warmupSets: 1, workingSets: 2, toFailure: false }, 4),
  "W3",
);

check(
  "{1,2}: in-scheme index 3 still labels W2 (target slot)",
  getSetLabel({ warmupSets: 1, workingSets: 2, toFailure: false }, 3),
  "W2",
);

// `Set N` fallback survives only for a truly invalid index (<= 0).
check(
  "{0,2}: invalid index 0 falls back to `Set 0`",
  getSetLabel({ warmupSets: 0, workingSets: 2, toFailure: false }, 0),
  "Set 0",
);

// --- (f) isLastSchemeSet: still identifies the final TARGET slot ---
// (No longer a completion trigger under D16, but remains a valid scheme predicate.)

check(
  "{0,2}: index 2 IS the last target scheme set",
  isLastSchemeSet({ warmupSets: 0, workingSets: 2 }, 2),
  true,
);

check(
  "{0,2}: index 1 is NOT the last target scheme set",
  isLastSchemeSet({ warmupSets: 0, workingSets: 2 }, 1),
  false,
);

// --- hasLoggedWorkingSet: gates "Complete block" (soft target DOWNWARD) ---
check(
  "no working set yet (only warm-up logged) → cannot complete early",
  hasLoggedWorkingSet(block({ block_id: "b", warmupSets: 1, setLogs: [setLog(1)] })),
  false,
);
check(
  "1 of 2 working sets logged (WU + W1) → CAN complete early (weak day)",
  hasLoggedWorkingSet(
    block({ block_id: "b", warmupSets: 1, setLogs: [setLog(1), setLog(2)] }),
  ),
  true,
);
check(
  "warmup=0: first logged set is a working set → can complete",
  hasLoggedWorkingSet(block({ block_id: "b", warmupSets: 0, setLogs: [setLog(1)] })),
  true,
);
check(
  "no sets logged at all → cannot complete",
  hasLoggedWorkingSet(block({ block_id: "b", warmupSets: 1, setLogs: [] })),
  false,
);

// --- nextAddedSetIndex: the set_index the offline queue writes for an ADDED
// working set (D16). Extracted pure from FailureProtocol's inline
// Math.max(maxLoggedIndex + 1, targetCount + 1). ---

check(
  "{1,2}: WU+W1+W2 logged (idx 1,2,3) → next added set is index 4",
  nextAddedSetIndex(
    block({
      block_id: "b",
      warmupSets: 1,
      workingSets: 2,
      setLogs: [setLog(1), setLog(2), setLog(3)],
    }),
  ),
  4,
);

check(
  "{0,2}: W1+W2 logged (idx 1,2) → next added set is index 3",
  nextAddedSetIndex(
    block({
      block_id: "b",
      warmupSets: 0,
      workingSets: 2,
      setLogs: [setLog(1), setLog(2)],
    }),
  ),
  3,
);

// --- getSchemeActions: the Add/Complete button predicates (D16 soft target). ---

check(
  "{1,2} weak day [WU,W1] → showAdd:false (target not met), showComplete:true (≥1 working)",
  getSchemeActions(
    block({
      block_id: "b",
      warmupSets: 1,
      workingSets: 2,
      setLogs: [setLog(1), setLog(2)],
    }),
  ),
  { showAdd: false, showComplete: true },
);

check(
  "{1,2} target complete [WU,W1,W2] → showAdd:true, showComplete:true",
  getSchemeActions(
    block({
      block_id: "b",
      warmupSets: 1,
      workingSets: 2,
      setLogs: [setLog(1), setLog(2), setLog(3)],
    }),
  ),
  { showAdd: true, showComplete: true },
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log("\nAll set-scheme checks passed");
