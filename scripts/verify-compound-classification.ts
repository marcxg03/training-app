// Fixture tests for the D28 compound/isolation name matcher (Slice T2-A).
// Run with:
//   pnpm exec tsx scripts/verify-compound-classification.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// WHY THIS EXISTS (D28): `exercises.is_compound` already gates e1RM in
// `buildE1rmSpotlights`, but every row sits on the `false` DEFAULT — the code
// gate is right and the DATA is wrong. `scripts/classify-compounds.ts` fixes
// the data; this file pins the matcher it uses so the classification can be
// re-run, reviewed, and reused by the future desktop builder without
// re-litigating what counts as a compound.
//
// D28 (locked by Marcus 2026-09-23) — gets estimated-1RM + the weight-PR trend:
//   Bench Press · Incline Press · Overhead/Shoulder Press · Back Squat ·
//   Deadlift (RDL/Sumo/conventional) · Barbell/DB/Chest-Supported Row ·
//   Weighted Dips · Weighted Pull-up/Chin · Lat Pulldown
// Everything else (lateral raise, rear delt, biceps, triceps, chest fly, face
// pull, calf raise, walking lunges, single-arm cables, core) = isolation.
//
// The names below are REAL Block II names, taken from
// `supabase/seed/wiki/current-plan.md`, `spec/BLOCK_II_SEED.md` and the
// `exerciseNameMap` in `supabase/seed/lib/methodology-rules.ts`.
//
// WRITTEN TO FAIL FIRST: before src/lib/methodology/compound-classification.ts
// exists this import throws (module not found) — red. Once the module matches
// the contract below, every case passes — green.
import {
  isCompoundExerciseName,
  normalizeExerciseName,
  explainCompoundClassification,
} from "../src/lib/methodology/compound-classification";

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

// --- normalization -----------------------------------------------------
check("lowercases", normalizeExerciseName("Barbell Bench Press"), "barbell bench press"); // prettier-ignore
check("strips punctuation", normalizeExerciseName("Lat Pulldown (Neutral)"), "lat pulldown neutral"); // prettier-ignore
check("hyphens become spaces", normalizeExerciseName("Pull-Up"), "pull up");
check("collapses whitespace", normalizeExerciseName("  BB   Bench   Press  "), "bb bench press"); // prettier-ignore
check("slashes become spaces", normalizeExerciseName("Back/Glute Extension"), "back glute extension"); // prettier-ignore

// --- D28 COMPOUNDS — must be true --------------------------------------
// Every entry is a real name Marcus has (or a bank alternative in the plan).
const COMPOUND_CASES: string[] = [
  // Bench press family
  "Barbell Bench Press",
  "BB Bench Press",
  "Flat DB Press",
  "Flat Barbell Press",
  "Machine Chest Press",
  // Incline press family
  "Incline DB Press",
  "Incline Smith Press",
  "BB Incline Smith Press",
  "Incline Cable Press",
  // Overhead / shoulder press family
  "Overhead Press",
  "Military Press",
  "Seated DB Shoulder Press",
  "Seated DB Press",
  "Machine Shoulder Press",
  "Seated Overhead BB Press",
  // Back squat
  "Heel Elevated BB Back Squat",
  "BB Back Squat",
  // Deadlift (RDL / sumo / conventional)
  "BB Romanian Deadlift",
  "DB Romanian Deadlift",
  "BB RDL",
  "DB RDL",
  "Sumo Deadlift",
  "Conventional Deadlift",
  // Rows (barbell / DB / chest-supported)
  "Chest Supported Row",
  "Single Arm Chest Supported Row",
  "Bent Over Barbell Row",
  "Bent Over BB Row",
  "DB Row",
  "3-Point Single Arm DB Row",
  "Seated Cable Row",
  // Dips
  "Dips",
  "Weighted Dip",
  // Pull-up / chin-up
  "Bodyweight Pull Ups",
  "Assisted Pull-Up",
  "Weighted Chin Up",
  "Pullups",
  // Lat pulldown
  "Lat Pulldown",
  "Hack Squat",
  "Incline Smith",
  "Incline Smith Machine",
  "Seated Machine Press",
  "Muscle Ups",
  "Single Leg BB Squat",
  "Good Morning",
  "Seated Good Mornings",
  "DB Pullover",
  "Cable/Machine Pullover",
  "Cable Lat Pulldown",
  "Neutral-Grip Pulldown",
  "Wide-Grip Pulldown",
  "Lat Pulldown (neutral)",
  "SA Cable Kneeling Pulldown",
];

for (const name of COMPOUND_CASES) {
  check(`compound: ${name}`, isCompoundExerciseName(name), true);
}

// --- D28 ISOLATIONS — must be false ------------------------------------
const ISOLATION_CASES: string[] = [
  // Lateral raise / delts
  "DB Lateral Raise",
  "Cable Lateral Raise",
  "Machine Lateral Raise",
  "Single Arm Cable Lateral Raise",
  // Rear delt
  "Cable Rear Delt Fly",
  "Rear Delt Fly Machine",
  "Reverse Pec Deck",
  "SA Cable Rear Delt Fly",
  // Biceps
  "Barbell Curl",
  "Preacher Curl",
  "DB Curl",
  // Triceps
  "Cable Pushdown",
  "V-Bar Pushdown",
  "Rope Pushdown",
  "Single Arm Cable Pushdown",
  "Overhead Tricep Extension",
  // Chest fly
  "Chest Fly Machine",
  // Face pull
  "Cable Face Pull",
  "Rope Face Pull",
  "Cable Rope Face Pulls",
  // Legs — accessory / unilateral
  "Calf Raise",
  "ATG Calf Raises",
  "Walking Lunges",
  "Back/Glute Extension",
  "Glute-Ham Raise",
  "45° Hyperextension",
  "ATG Split Squat",
  "Leg Press",
  // Core
  "Hanging Leg Raise",
  "Cable Wood Chopper",
  "Pallof Press",
  "L-Sit Crunch",
  "Planks",
  "Decline Bench Curl",
  // Traps / mobility / prehab
  "Barbell Shrug",
  "DB Shrug",
  "Dead Hang",
  "Jefferson Curl",
  "ATG Shoulders",
  "Straight Arm Pulldown",
  "Upright Row",
];

for (const name of ISOLATION_CASES) {
  check(`isolation: ${name}`, isCompoundExerciseName(name), false);
}

// --- traps: isolation patterns must beat compound substrings ------------
// "Pallof Press" contains "press"; "Decline Bench Curl" contains "bench";
// "Straight Arm Pulldown" contains "pulldown"; "Upright Row" contains "row".
// The deny list is evaluated FIRST so none of these can leak an e1RM chart.
check("trap: Pallof Press is not a press", isCompoundExerciseName("Pallof Press"), false); // prettier-ignore
check("trap: Decline Bench Curl is not a bench press", isCompoundExerciseName("Decline Bench Curl"), false); // prettier-ignore
check("trap: Straight Arm Pulldown is not a lat pulldown", isCompoundExerciseName("Straight Arm Pulldown"), false); // prettier-ignore
check("trap: Upright Row is not a row", isCompoundExerciseName("Upright Row"), false); // prettier-ignore
check("trap: Triceps Dip is not a weighted dip", isCompoundExerciseName("Triceps Dip"), false); // prettier-ignore
check("trap: Dip Machine (triceps) is not a weighted dip", isCompoundExerciseName("Tricep Dip Machine"), false); // prettier-ignore

// --- unknown names default to isolation ("everything else = false") -----
check("unknown → false", isCompoundExerciseName("Some Novel Machine Thing"), false); // prettier-ignore
check("empty → false", isCompoundExerciseName(""), false);
check("whitespace → false", isCompoundExerciseName("   "), false);

// --- explain() agrees with the boolean + names the rule -----------------
const benchExplain = explainCompoundClassification("Barbell Bench Press");
check("explain: bench is compound", benchExplain.isCompound, true);
check(
  "explain: bench names a compound rule",
  typeof benchExplain.rule === "string" && benchExplain.rule.length > 0,
  true,
);
const curlExplain = explainCompoundClassification("Barbell Curl");
check("explain: curl is isolation", curlExplain.isCompound, false);
check(
  "explain: curl names the isolation rule that caught it",
  curlExplain.rule.includes("curl"),
  true,
);
const unknownExplain = explainCompoundClassification("Some Novel Machine Thing");
check("explain: unknown is isolation", unknownExplain.isCompound, false);
check(
  "explain: unknown reports the default rule",
  unknownExplain.rule,
  "default (no compound pattern matched)",
);

// explain() must never disagree with the boolean, for every fixture.
for (const name of [...COMPOUND_CASES, ...ISOLATION_CASES]) {
  const explained = explainCompoundClassification(name);
  if (explained.isCompound !== isCompoundExerciseName(name)) {
    failures += 1;
    console.error(`✗ explain/boolean disagree for "${name}"`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log(
  `\nAll compound-classification checks passed (${COMPOUND_CASES.length} compound + ${ISOLATION_CASES.length} isolation fixtures).`,
);
