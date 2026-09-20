// Slice B3 — parser-in-isolation verification of Marcus's Block II seed plan.
// Run with:
//   pnpm exec tsx scripts/verify-block-ii-parse.ts
// Exits non-zero on any failure. No test framework, no live Supabase.
//
// It reads the authored seed markdown (supabase/seed/wiki/*.md — the same files
// `npm run seed` reads, resolved via wikiPaths), runs parsePlanFromWiki on them,
// and asserts the Block II shape + the adjustable set-schemes (Slice B1/D4/D15):
//   - 7 days, Mon..Sun in order, with the right session names/types
//   - Monday "Upper" parses into 3 rounds, each a non-empty exercise bank
//   - Thursday "Push" dips block → toFailure=true, workingSets=2
//   - the 2-working-set lifts → workingSets=2 & toFailure=false
//   - validateTrainingPlan(days).hardViolations is empty (B2 made these soft)
//
// WRITTEN TO FAIL FIRST: before the seed markdown exists parsePlanFromWiki throws
// on the missing files; before the parser emits the scheme fields the toFailure /
// workingSets assertions read `undefined` and fail.
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  parsePlanFromWiki,
  validateTrainingPlan,
} from "../supabase/seed/lib/methodology-rules";
import type { ParsedBlock, ParsedDaySpec } from "../supabase/seed/lib/types";
import { wikiPaths } from "../src/lib/utils/wiki-paths";

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

async function readWikiFiles() {
  const entries = Object.entries(wikiPaths) as Array<
    [keyof typeof wikiPaths, string]
  >;
  const contents = await Promise.all(
    entries.map(async ([key, relativePath]) => {
      const absolutePath = path.join(process.cwd(), relativePath);
      const content = await fs.readFile(absolutePath, "utf8");
      return [key, content] as const;
    }),
  );
  return Object.fromEntries(contents) as Parameters<
    typeof parsePlanFromWiki
  >[0];
}

function findDay(days: ParsedDaySpec[], label: string) {
  const day = days.find((entry) => entry.dayLabel === label);
  if (!day) {
    throw new Error(`Missing ${label} in parsed plan.`);
  }
  return day;
}

function findLifting(day: ParsedDaySpec, workoutName: string) {
  const workout = day.workouts.find(
    (entry) => entry.workoutName === workoutName,
  );
  if (!workout) {
    throw new Error(`Missing "${workoutName}" workout on ${day.dayLabel}.`);
  }
  return workout;
}

function blockWithExercise(blocks: ParsedBlock[], exerciseName: string) {
  const block = blocks.find((candidate) =>
    candidate.exercises.some((exercise) => exercise.name === exerciseName),
  );
  if (!block) {
    throw new Error(`No block contains exercise "${exerciseName}".`);
  }
  return block;
}

async function main() {
  const files = await readWikiFiles();
  const spec = parsePlanFromWiki(files);

  // --- (a) seven days, Mon..Sun in order ---
  check(
    "day count is 7",
    spec.days.length,
    7,
  );
  check(
    "days are Mon..Sun in order",
    spec.days.map((day) => day.dayLabel),
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  );

  // --- (b) session names / types across the split ---
  const monday = findDay(spec.days, "Monday");
  const wednesday = findDay(spec.days, "Wednesday");
  const thursday = findDay(spec.days, "Thursday");
  const friday = findDay(spec.days, "Friday");
  const saturday = findDay(spec.days, "Saturday");
  const tuesday = findDay(spec.days, "Tuesday");

  check(
    "Wednesday is Basketball (cardio)",
    wednesday.workouts.map((w) => [w.workoutName, w.workoutType]),
    [["Basketball", "cardio"]],
  );
  check(
    "Saturday is HYROX (cardio)",
    saturday.workouts.map((w) => [w.workoutName, w.workoutType]),
    [["HYROX", "cardio"]],
  );
  check(
    "Friday is Pull (lifting) then Basketball (cardio)",
    friday.workouts.map((w) => [w.workoutName, w.workoutType]),
    [
      ["Pull", "lifting"],
      ["Basketball", "cardio"],
    ],
  );

  // --- (c) Monday "Upper" → 3 rounds, each a non-empty bank ---
  const upper = findLifting(monday, "Upper");
  check("Monday Upper has 3 rounds/blocks", upper.blocks.length, 3);
  check(
    "each Monday round carries a non-empty exercise bank",
    upper.blocks.every((block) => block.exercises.length >= 1),
    true,
  );

  // --- (d) the schemes ---
  // Thursday dips → 2 working sets to failure.
  const push = findLifting(thursday, "Push");
  const dips = blockWithExercise(push.blocks, "Dips");
  check("Thursday dips block toFailure", dips.toFailure, true);
  check("Thursday dips block workingSets", dips.workingSets, 2);

  // A representative 2-working-set NON-failure lift (Monday round 1 + Tuesday
  // deadlift) → workingSets=2, toFailure=false.
  const round1 = upper.blocks[0];
  check("Monday round 1 workingSets", round1.workingSets, 2);
  check("Monday round 1 toFailure", round1.toFailure, false);

  const lower = findLifting(tuesday, "Lower");
  const deadlift = lower.blocks[0];
  check("Tuesday deadlift workingSets", deadlift.workingSets, 2);
  check("Tuesday deadlift toFailure", deadlift.toFailure, false);

  // Every failure-typed block that is NOT the dips block must be toFailure=false
  // (D11 B3: structured scheme, block_type='failure' but not taken to failure).
  const strayFailure = spec.liftingBlocks.filter(
    (block) =>
      block.blockType === "failure" &&
      block.toFailure === true &&
      !block.exercises.some((exercise) => exercise.name === "Dips"),
  );
  check(
    "only the dips block is toFailure among failure blocks",
    strayFailure.map((block) => block.blockName),
    [],
  );

  // --- (e) B2: no hard methodology violations ---
  check(
    "validateTrainingPlan hardViolations is empty",
    validateTrainingPlan(spec.days).hardViolations,
    [],
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll Block II parse checks passed");
}

main().catch((error) => {
  console.error(`✗ verify-block-ii-parse threw: ${(error as Error).message}`);
  process.exit(1);
});
