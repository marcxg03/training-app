// Fixture tests for the plan_templates snapshot summariser (T3-A). Run with:
//   pnpm exec tsx scripts/verify-program-summary.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// WHAT THIS GUARDS
//   `snapshot_json` is an untyped jsonb dump whose shape CHANGED between the
//   rows that are already in production: versions 1–3 (2026-04-30) have no
//   liftingBlocks/cardioActivities/recoveryActivities keys; versions 4–6 do.
//   A list view that assumes one shape throws on the other, and because this
//   renders in a server component a throw is a 500 on the whole hub, not one
//   bad row. Every case below is a real or plausible snapshot shape, plus the
//   hostile ones (null, array, string, missing keys) that a jsonb column can
//   legally hold.
//
// WRITTEN TO FAIL FIRST: before src/lib/admin/program-summary.ts exists this
// import throws.
import { summarizeProgramSnapshot } from "../src/lib/admin/program-summary";

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

// --- the shape actually in production (v4–v6) ---------------------------
const MODERN = {
  name: "Block II — Hypertrophy",
  masterPlanTitle: "Master Plan",
  overviewTitle: "Overview",
  days: [
    { dayOfWeek: "mon", isRestDay: false },
    { dayOfWeek: "tue", isRestDay: false },
    { dayOfWeek: "sun", isRestDay: true },
  ],
  liftingBlocks: [{ blockName: "Chest" }],
  cardioActivities: [],
  recoveryActivities: [],
  nutritionTargets: {},
  historicalPrs: [],
  validation: {},
};

const modern = summarizeProgramSnapshot(MODERN, "Version 6");
check("modern: reads the name", modern.name, "Block II — Hypertrophy");
check("modern: counts days", modern.dayCount, 3);
check("modern: counts rest days", modern.restDayCount, 1);
check("modern: detects blocks", modern.hasBlocks, true);

// --- the OLDER shape also in production (v1–v3) -------------------------
// No liftingBlocks/cardioActivities/recoveryActivities keys at all.
const LEGACY = {
  name: "Block I",
  overviewTitle: "Overview",
  masterPlanTitle: "Master Plan",
  days: [{ dayOfWeek: "mon", isRestDay: false }],
  nutritionTargets: {},
  historicalPrs: [],
  validation: {},
};

const legacy = summarizeProgramSnapshot(LEGACY, "Version 1");
check("legacy: reads the name", legacy.name, "Block I");
check("legacy: counts days", legacy.dayCount, 1);
check("legacy: reports no blocks rather than throwing", legacy.hasBlocks, false); // prettier-ignore

// --- name fallback chain ------------------------------------------------
check(
  "falls back to masterPlanTitle",
  summarizeProgramSnapshot({ masterPlanTitle: "MP" }, "Version 2").name,
  "MP",
);
check(
  "falls back to overviewTitle",
  summarizeProgramSnapshot({ overviewTitle: "OV" }, "Version 2").name,
  "OV",
);
check(
  "falls back to the row label when nameless",
  summarizeProgramSnapshot({ days: [] }, "Version 2").name,
  "Version 2",
);
// An empty or whitespace name is not a name.
check(
  "empty name falls through",
  summarizeProgramSnapshot({ name: "   " }, "Version 2").name,
  "Version 2",
);
check(
  "a non-string name falls through",
  summarizeProgramSnapshot({ name: 42 }, "Version 2").name,
  "Version 2",
);
check(
  "name is trimmed",
  summarizeProgramSnapshot({ name: "  Padded  " }, "V").name,
  "Padded",
);

// --- days keyed by weekday rather than listed ---------------------------
const KEYED = {
  name: "Keyed",
  days: { mon: { isRestDay: false }, sun: { isRestDay: true } },
};
check("object-keyed days are counted", summarizeProgramSnapshot(KEYED, "V").dayCount, 2); // prettier-ignore
check("object-keyed rest days are counted", summarizeProgramSnapshot(KEYED, "V").restDayCount, 1); // prettier-ignore

// --- hostile values a jsonb column can legally hold ---------------------
// Each of these must return a renderable row, never throw.
for (const [label, value] of [
  ["null", null],
  ["a string", "just a string"],
  ["a number", 7],
  ["an array", [1, 2, 3]],
  ["an empty object", {}],
] as const) {
  const summary = summarizeProgramSnapshot(value, "Version 9");
  check(`${label}: degrades to the fallback name`, summary.name, "Version 9");
  check(`${label}: reports unknown day count`, summary.dayCount, null);
}

// A `days` value of the wrong type must not be counted as zero — zero days is
// a claim, null is "the snapshot does not say".
check(
  "days of the wrong type reports null, not 0",
  summarizeProgramSnapshot({ name: "X", days: "monday" }, "V").dayCount,
  null,
);
check(
  "an empty days array really is 0",
  summarizeProgramSnapshot({ name: "X", days: [] }, "V").dayCount,
  0,
);

// --- shape keys ---------------------------------------------------------
check("shape keys are sorted", summarizeProgramSnapshot({ b: 1, a: 2 }, "V").shapeKeys, ["a", "b"]); // prettier-ignore
check("shape keys of a non-object are empty", summarizeProgramSnapshot(null, "V").shapeKeys, []); // prettier-ignore

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll program-summary checks passed.");
