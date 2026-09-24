// Fixture tests for the PR-type color map (Marcus validation feedback, 2026-09-23).
// Run with:
//   pnpm exec tsx scripts/verify-pr-colors.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// The contract: the two PR types must never render the same color again.
// weight -> --pr-weight (#2563EB blue), in_range_rep -> --pr-rep (#7C3AED violet).
// Both are tokens (bg-pr-*/text-pr-*), never raw hex, so the theme stays the
// single source of truth. This map is ALSO the legend and series palette for
// the per-exercise PR graph (PRHistoryChart, T2-B), so drift here would
// silently mis-label that chart.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  PR_TYPE_STYLE,
  prTypeStyle,
  type PRType,
  type PRTypeStyle,
} from "../src/lib/methodology/pr-colors";
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

// --- every DB pr_type value has a style -------------------------------------
const dbPrTypes = Constants.public.Enums.pr_type_enum;
check("pr_type_enum is [weight, in_range_rep]", [...dbPrTypes], [
  "weight",
  "in_range_rep",
]);

for (const prType of dbPrTypes) {
  check(
    `${prType} has a style entry`,
    typeof PR_TYPE_STYLE[prType] === "object" && PR_TYPE_STYLE[prType] !== null,
    true,
  );
  check(`prTypeStyle(${prType}) === PR_TYPE_STYLE[${prType}]`, prTypeStyle(prType), PR_TYPE_STYLE[prType]);
}

// --- weight = blue, rep = violet --------------------------------------------
check("weight pill uses the pr-weight token", PR_TYPE_STYLE.weight.pill, "bg-pr-weight text-white");
check("rep pill uses the pr-rep token", PR_TYPE_STYLE.in_range_rep.pill, "bg-pr-rep text-white");
check("weight text uses the pr-weight token", PR_TYPE_STYLE.weight.text, "text-pr-weight");
check("rep text uses the pr-rep token", PR_TYPE_STYLE.in_range_rep.text, "text-pr-rep");

// --- the two types are distinguishable on EVERY field -----------------------
// This is the actual bug guard: a copy/paste that leaves both types sharing a
// color or label fails here rather than shipping an indistinguishable UI.
/** Keys of PRTypeStyle whose value is a class string (not a geometry number). */
type PRTypeStyleClassField = {
  [K in keyof PRTypeStyle]: PRTypeStyle[K] extends string ? K : never;
}[keyof PRTypeStyle];

const fields: PRTypeStyleClassField[] = [
  "pill",
  "text",
  "surface",
  "shortLabel",
  "label",
  "inlineLabel",
  // T2-B chart fields — a copy/paste that leaves both PR series drawn in the
  // same color (or both axes labelled the same unit) fails here.
  "chartStroke",
  "chartDot",
  "swatch",
  "axisLabel",
];

// Geometry fields that must ALSO differ: when one set earns both PR types at
// the same instant the two marks land on the identical coordinate, and only
// the size difference keeps both visible. (chartDotHalo is deliberately the
// SAME on both — they halo to one card background — and the halo WIDTHS are
// free to match or not, so neither is in this list; the halo invariants that
// do matter are asserted per-series below.)
const distinctFields: (keyof PRTypeStyle)[] = [
  ...fields,
  "chartDotRadius",
  "chartDotRadiusLatest",
];

for (const field of distinctFields) {
  check(
    `weight and rep differ on "${field}"`,
    PR_TYPE_STYLE.weight[field] !== PR_TYPE_STYLE.in_range_rep[field],
    true,
  );
}

// --- no raw hex anywhere in the map (tokens only) ---------------------------
for (const [prType, style] of Object.entries(PR_TYPE_STYLE) as [
  PRType,
  PRTypeStyle,
][]) {
  for (const field of fields) {
    check(
      `${prType}.${field} carries no hardcoded hex`,
      /#[0-9a-fA-F]{3,8}\b/.test(style[field]),
      false,
    );
  }
}

// --- coincident marks stay readable ----------------------------------------
// The exact geometry the T2-B drive's check 7 asserts in a real browser, held
// here as a unit invariant: with both marks on one coordinate, the smaller
// dot plus its halo must leave a visible ring of the larger dot's fill.
// (halo is centered on the edge, so it eats radius/2 outward.)
for (const pair of [
  ["chartDotRadius", "steady points"],
  ["chartDotRadiusLatest", "newest points"],
] as const) {
  const [field, label] = pair;
  const weight = PR_TYPE_STYLE.weight[field];
  const rep = PR_TYPE_STYLE.in_range_rep[field];
  const outer = Math.max(weight, rep);
  const innerStyle = weight < rep ? PR_TYPE_STYLE.weight : PR_TYPE_STYLE.in_range_rep;
  const visibleRing = outer - (Math.min(weight, rep) + innerStyle.chartDotHaloWidth / 2);

  check(
    `coincident ${label}: the outer mark still shows a >=1px ring (got ${visibleRing.toFixed(2)})`,
    visibleRing >= 1,
    true,
  );
}

for (const prType of dbPrTypes) {
  const style = PR_TYPE_STYLE[prType];
  check(
    `${prType} dots carry a contrasting halo so one mark on another reads as two`,
    style.chartDotHalo === "stroke-card" && style.chartDotHaloWidth > 0,
    true,
  );
  check(
    `${prType} newest point is emphasized (latest radius > steady radius)`,
    style.chartDotRadiusLatest > style.chartDotRadius,
    true,
  );
}

// --- the tokens the classes reference actually exist ------------------------
const globalsCss = readFileSync(join(repoRoot, "src/app/globals.css"), "utf8");
check(
  "--pr-weight is defined as the #2563EB rgb triplet",
  /--pr-weight:\s*37\s+99\s+235\s*;/.test(globalsCss),
  true,
);
check(
  "--pr-rep is defined as the #7C3AED rgb triplet",
  /--pr-rep:\s*124\s+58\s+237\s*;/.test(globalsCss),
  true,
);

const tailwindConfig = readFileSync(join(repoRoot, "tailwind.config.ts"), "utf8");
check(
  "tailwind maps pr-weight to the token",
  tailwindConfig.includes('"pr-weight": "rgb(var(--pr-weight) / <alpha-value>)"'),
  true,
);
check(
  "tailwind maps pr-rep to the token",
  tailwindConfig.includes('"pr-rep": "rgb(var(--pr-rep) / <alpha-value>)"'),
  true,
);

// --- the chart fields are real Tailwind utilities over the SAME tokens ------
// `stroke-pr-weight` / `fill-pr-rep` only exist because the colors live in the
// tailwind theme; a hand-written class name that does not derive from the
// token would render as nothing (SVG default black) with no error.
for (const prType of dbPrTypes) {
  const style = PR_TYPE_STYLE[prType];
  const token = prType === "weight" ? "pr-weight" : "pr-rep";
  check(`${prType}.chartStroke is stroke-${token}`, style.chartStroke, `stroke-${token}`);
  check(`${prType}.chartDot is fill-${token}`, style.chartDot, `fill-${token}`);
  check(`${prType}.swatch is bg-${token}`, style.swatch, `bg-${token}`);
}
check("weight series is measured in LBS", PR_TYPE_STYLE.weight.axisLabel, "LBS");
check("rep series is measured in REPS", PR_TYPE_STYLE.in_range_rep.axisLabel, "REPS");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll pr-colors checks passed.");
