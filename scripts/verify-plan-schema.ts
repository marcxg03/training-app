// Fixture tests for the Plan Editor's day schema — run with:
//   pnpm exec tsx scripts/verify-plan-schema.ts
// Exits non-zero on any failure. No test framework needed.
//
// Covers the session-content rules added when the editor learned to compose a
// session's blocks: a lifting session is an ordered list of Library blocks with
// no preset; a cardio/recovery session is exactly one block carrying a preset
// activity. Those invariants are what keep saveDay's workout_blocks writes
// inside the table's CHECK (both preset columns set, or both NULL).
import { blocksLockReason } from "../src/lib/plan/mutations";
import { daySchema, type DayFormValues } from "../src/lib/plan/schemas";

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

const BLOCK_A = "11111111-1111-4111-8111-111111111111";
const BLOCK_B = "22222222-2222-4222-8222-222222222222";
const ACTIVITY = "33333333-3333-4333-8333-333333333333";

type Row = DayFormValues["workouts"][number];

function workout(overrides: Partial<Row> = {}): Row {
  return {
    workout_id: null,
    workout_def_id: null,
    workout_name: "Session",
    workout_type: "lifting",
    blocks: [],
    cardio_format: null,
    timing: "anytime",
    gym: "",
    display_order: 0,
    has_history: false,
    ...overrides,
  };
}

function day(workouts: Row[]): DayFormValues {
  return { is_rest_day: false, workouts };
}

/** First error message on the session-content path, or null. */
function blocksError(row: Row): string | null {
  const result = daySchema.safeParse(day([row]));
  if (result.success) {
    return null;
  }
  const issue = result.error.issues.find((i) => i.path.includes("blocks"));
  return issue?.message ?? null;
}

const liftingBlock = (block_id: string, block_name = "Block") => ({
  block_id,
  block_name,
  preset_activity_id: null,
});

// --- lifting sessions -------------------------------------------------------

check(
  "lifting: empty block list is allowed (session can be filled in later)",
  blocksError(workout({ blocks: [] })),
  null,
);

check(
  "lifting: an ordered list of distinct blocks is allowed",
  blocksError({
    ...workout(),
    blocks: [liftingBlock(BLOCK_A, "Chest 1"), liftingBlock(BLOCK_B, "Biceps")],
  }),
  null,
);

// workout_blocks is keyed (workout_id, block_id, display_order) — the same
// block twice also reads as a duplicate in the logger.
check(
  "lifting: the same block twice is rejected, naming the block",
  blocksError({
    ...workout(),
    blocks: [liftingBlock(BLOCK_A, "Chest 1"), liftingBlock(BLOCK_A, "Chest 1")],
  }),
  '"Chest 1" is already in this session',
);

check(
  "lifting: a preset activity is rejected (presets are cardio/recovery only)",
  blocksError({
    ...workout(),
    blocks: [{ ...liftingBlock(BLOCK_A), preset_activity_id: ACTIVITY }],
  }),
  "Only cardio and recovery sessions have a preset activity",
);

// --- cardio / recovery sessions --------------------------------------------

check(
  "recovery: one block carrying an activity is allowed",
  blocksError({
    ...workout({ workout_type: "recovery" }),
    blocks: [{ block_id: BLOCK_A, block_name: "Recovery", preset_activity_id: ACTIVITY }],
  }),
  null,
);

check(
  "recovery: a block with no activity is rejected",
  blocksError({
    ...workout({ workout_type: "recovery" }),
    blocks: [liftingBlock(BLOCK_A, "Recovery")],
  }),
  "Pick an activity for this session",
);

check(
  "cardio: two blocks are rejected (a single activity per session)",
  blocksError({
    ...workout({ workout_type: "cardio", cardio_format: "endurance_run" }),
    blocks: [
      { block_id: BLOCK_A, block_name: "Cardio", preset_activity_id: ACTIVITY },
      { block_id: BLOCK_B, block_name: "Cardio", preset_activity_id: ACTIVITY },
    ],
  }),
  "A cardio or recovery session holds a single activity",
);

check(
  "cardio: no blocks at all is allowed (activity can be picked later)",
  blocksError({
    ...workout({ workout_type: "cardio", cardio_format: "endurance_run" }),
    blocks: [],
  }),
  null,
);

// --- pre-existing rules still hold -----------------------------------------

check(
  "new cardio session still requires a format",
  daySchema.safeParse(
    day([workout({ workout_type: "cardio", cardio_format: null })]),
  ).success,
  false,
);

check(
  "an existing cardio row (workout_id set) does not require a format",
  daySchema.safeParse(
    day([
      workout({
        workout_id: "44444444-4444-4444-8444-444444444444",
        workout_type: "cardio",
        cardio_format: null,
      }),
    ]),
  ).success,
  true,
);

check(
  "a lifting session still rejects a cardio format",
  daySchema.safeParse(
    day([workout({ workout_type: "lifting", cardio_format: "speed_run" })]),
  ).success,
  false,
);

// --- server-side block lock (saveDay) --------------------------------------
// The UI renders these sessions read-only; this pins that the SERVER refuses
// them too, so a stale or forged client payload can't rewrite the snapshot.

const LOGGED_ID = "55555555-5555-4555-8555-555555555555";
const DEF_ID = "66666666-6666-4666-8666-666666666666";

check(
  "unlogged ad-hoc session: blocks are editable",
  blocksLockReason(workout({ workout_id: LOGGED_ID }), new Set()),
  null,
);

check(
  "logged session: blocks are locked",
  blocksLockReason(
    workout({ workout_id: LOGGED_ID, workout_name: "Upper" }),
    new Set([LOGGED_ID]),
  )?.reason.includes("logged history"),
  true,
);

check(
  "catalog-linked session: blocks are locked",
  blocksLockReason(
    workout({ workout_id: LOGGED_ID, workout_def_id: DEF_ID, workout_name: "Upper" }),
    new Set(),
  )?.reason.includes("workout catalog"),
  true,
);

check(
  "a brand-new session is never locked (no id to have history)",
  blocksLockReason(workout({ workout_id: null }), new Set([LOGGED_ID])),
  null,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log("\nAll plan schema checks passed");
