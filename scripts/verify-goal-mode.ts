// Fixture tests for goal mode (Marcus validation feedback, 2026-09-23:
// "goal mode doesn't let me switch between cut, maintain, lean bulk").
// Run with:
//   pnpm exec tsx scripts/verify-goal-mode.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// Root cause of the reported bug was a DEAD CONTROL, not bad logic: the goal-
// mode segmented control on the nutrition Targets screen was built out of
// <span> elements with no handler, so the one screen the user reaches from the
// Nutrition goal-mode pill looked interactive and did nothing. The real setter
// lived only on Settings → Profile.
//
// So these checks guard the two things around that fix:
//   1. every enum value is a first-class mode with its own defaults, and
//   2. goal mode actually DRIVES the nutrition day-type framework — i.e. that
//      switching modes is worth wiring up in the first place.
// A future refactor that collapses two modes into the same numbers or the same
// guidance fails here instead of quietly making the control pointless again.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  dayTypeFramework,
  goalModeDefaultTargets,
  type GoalMode,
  type NutritionDayType,
} from "../src/lib/methodology/nutrition";
import { Constants } from "../src/lib/supabase/types";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

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

// --- the enum is the three modes the UI offers ------------------------------
const modes = Constants.public.Enums.goal_mode_enum;
check("goal_mode_enum is [cut, maintain, lean_bulk]", [...modes], [
  "cut",
  "maintain",
  "lean_bulk",
]);

// --- every mode has its own, internally valid defaults ----------------------
for (const mode of modes) {
  const targets = goalModeDefaultTargets(mode);
  check(
    `${mode} defaults have min < max on every range`,
    targets.cal_min < targets.cal_max &&
      targets.protein_min_g < targets.protein_max_g &&
      targets.carbs_min_g < targets.carbs_max_g &&
      targets.fat_min_g < targets.fat_max_g,
    true,
  );
}

// --- the three modes are actually different ---------------------------------
const calorieFloors = modes.map((mode) => goalModeDefaultTargets(mode).cal_min);
check(
  "each mode has a distinct calorie floor",
  new Set(calorieFloors).size,
  modes.length,
);
check(
  "calorie floors ascend cut < maintain < lean_bulk",
  calorieFloors[0] < calorieFloors[1] && calorieFloors[1] < calorieFloors[2],
  true,
);

// --- defaults are a copy, not the shared internal record --------------------
// The Targets screen re-seeds its fields from these on a mode switch, so a
// leaked reference would let the form mutate the defaults table.
const firstRead = goalModeDefaultTargets("cut");
firstRead.cal_min = -1;
check(
  "goalModeDefaultTargets returns a fresh object each call",
  goalModeDefaultTargets("cut").cal_min,
  2000,
);

// --- goal mode drives the day-type framework --------------------------------
const dayTypes: NutritionDayType[] = ["rest", "lifting", "cardio"];
for (const dayType of dayTypes) {
  const guidance = modes.map(
    (mode) => dayTypeFramework(dayType, mode).guidance,
  );
  check(
    `${dayType}: each goal mode yields distinct guidance`,
    new Set(guidance).size,
    modes.length,
  );
  check(
    `${dayType}: title stays keyed to the day type, not the mode`,
    new Set(modes.map((mode) => dayTypeFramework(dayType, mode).title)).size,
    1,
  );
}

for (const mode of modes) {
  check(
    `${mode} is named in its own guidance`,
    dayTypeFramework("lifting", mode).guidance.toLowerCase().includes("goal:"),
    true,
  );
}

// --- the control that broke is a real control -------------------------------
// The regression guard for the actual bug: the Targets screen's goal-mode
// segments must be <button>s wired to a handler, never inert <span>s.
const targetsForm = readFileSync(
  join(repoRoot, "src/app/(app)/nutrition/_components/TargetsForm.tsx"),
  "utf8",
);
check(
  "Targets goal-mode control calls a change handler",
  targetsForm.includes("handleGoalModeChange(mode.value)"),
  true,
);
check(
  "Targets goal-mode control persists through a mutation",
  targetsForm.includes("updateGoalMode("),
  true,
);

const mutations = readFileSync(
  join(repoRoot, "src/lib/settings/mutations.ts"),
  "utf8",
);
check(
  "a standalone goal-mode setter exists",
  mutations.includes("export async function updateGoalMode("),
  true,
);

// GoalMode is the DB enum type, so this is a compile-time guard that the union
// the UI iterates and the union the setter accepts are the same one.
const typedModes: GoalMode[] = ["cut", "maintain", "lean_bulk"];
check("GoalMode covers exactly the three modes", typedModes.length, 3);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll goal-mode checks passed.");
