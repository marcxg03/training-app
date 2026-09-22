// Fixture tests for Slice B2 — cut the methodology hard-blocking guardrails.
// Run with:
//   pnpm exec tsx scripts/verify-schedule-validation.ts
// Exits non-zero on any failure. No test framework needed.
//
// GOAL: a 7-day plan with ZERO full rest days (Block II — Sunday is ATG
// recovery, not rest) must not hard-block. The runtime editor's validateSchedule
// must return hardErrors:[] for a no-rest-day day, and the seed pipeline's
// validateTrainingPlan must return hardViolations:[] for a no-rest-day week.
// The informational layer stays: cardio-before-lift SOFT warnings must still
// populate, and the (former) hard rules must resurface as soft warnings so we
// prove they were softened, not deleted.
//
// WRITTEN TO FAIL FIRST: against the pre-slice code, the no-rest-day cases push
// "Keep at least one rest day…" / "…at least one full rest day." into the HARD
// bucket, so the two "hard bucket is empty" assertions return non-empty and fail.
import {
  validateSchedule,
  type EditableWorkout,
} from "../src/lib/methodology/plan-schedule";
import { validateTrainingPlan } from "../supabase/seed/lib/methodology-rules";
import type { ParsedDaySpec, ParsedWorkoutSpec } from "../supabase/seed/lib/types";

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

// --- (a) validateSchedule: the no-rest-day case must NOT hard-block ---
// isRestDay:false + otherDaysHaveRest:false is exactly the Block II shape (no
// full rest day anywhere in the week). Pre-slice this yields a rest-day error.

const noRestDayWorkouts: EditableWorkout[] = [
  { workout_type: "lifting", timing: "am", display_order: 0 },
];

check(
  "no-rest-day editor case: hardErrors is EMPTY",
  validateSchedule({
    isRestDay: false,
    workouts: noRestDayWorkouts,
    otherDaysHaveRest: false,
  }).hardErrors,
  [],
);

// The rest day itself, with no other rest in the week — also must not block.
check(
  "editing the sole non-rest day (otherDaysHaveRest:false): hardErrors EMPTY",
  validateSchedule({
    isRestDay: true,
    workouts: [],
    otherDaysHaveRest: false,
  }).hardErrors,
  [],
);

// --- (b) validateSchedule: the SOFT informational layer still works ---
// Cardio (am) before lifting (pm) on the same day must still warn.

const cardioBeforeLift: EditableWorkout[] = [
  { workout_type: "cardio", timing: "am", display_order: 0 },
  { workout_type: "lifting", timing: "pm", display_order: 1 },
];

check(
  "cardio-before-lift still produces a soft warning (softened, not deleted)",
  validateSchedule({
    isRestDay: false,
    workouts: cardioBeforeLift,
    otherDaysHaveRest: true,
  }).softWarnings,
  ["Cardio is scheduled before lifting on this day."],
);

check(
  "cardio-before-lift produces NO hard error",
  validateSchedule({
    isRestDay: false,
    workouts: cardioBeforeLift,
    otherDaysHaveRest: true,
  }).hardErrors,
  [],
);

// --- (c) validateTrainingPlan (seed pipeline): no-rest-day week ---
// A 7-day, cardio-only week with ZERO rest days. Cardio workouts trigger no
// push/pull or missing-muscle rules, so the ONLY former-hard rule in play is the
// min-rest-day rule. Pre-slice it lands in hardViolations; post-slice it must be
// empty and the message must resurface as a soft warning.

function cardioWorkout(): ParsedWorkoutSpec {
  return {
    workoutName: "Endurance run",
    workoutType: "cardio",
    timing: "am",
    gym: null,
    description: null,
    displayOrder: 0,
    cardioFormat: "endurance_run",
    cardioDistance: null,
    cardioTargetZone: null,
    blocks: [],
    blockRefs: [],
    focusMuscleGroups: [],
  };
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const noRestWeek: ParsedDaySpec[] = DAYS.map((dayOfWeek) => ({
  dayOfWeek,
  dayLabel: dayOfWeek.toUpperCase(),
  isRestDay: false,
  workouts: [cardioWorkout()],
}));

check(
  "seed no-rest-day week: hardViolations is EMPTY",
  validateTrainingPlan(noRestWeek).hardViolations,
  [],
);

check(
  "seed no-rest-day week: min-rest-day rule resurfaces as a soft warning",
  validateTrainingPlan(noRestWeek).softWarnings.includes(
    "The weekly plan must include at least one full rest day.",
  ),
  true,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log("\nAll schedule-validation checks passed");
