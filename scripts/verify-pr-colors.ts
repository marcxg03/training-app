// Fixture tests for the PR-type color map (Marcus validation feedback, 2026-09-23).
// Run with:
//   pnpm exec tsx scripts/verify-pr-colors.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// The contract: the two PR types must never render the same color again.
// weight -> --pr-weight (#2563EB blue), in_range_rep -> --pr-rep (#7C3AED violet).
// Both are tokens (bg-pr-*/text-pr-*), never raw hex, so the theme stays the
// single source of truth. This map is ALSO the title, legend and series palette
// for the per-exercise PR graphs (PRHistoryChart), so drift here would silently
// mis-label those charts.
//
// T2-D: the charts split into TWO single-axis panels, so the per-type MARKER
// GEOMETRY that existed only to keep two coincident marks readable on one
// canvas is gone — with it, the assertions that the two types differ in radius
// and that the smaller mark leaves a visible ring of the larger. The geometry
// is now ONE shared set of constants (asserted as such below), and what the two
// types must still differ on is what a reader actually distinguishes them by:
// color, label, title, unit, empty state.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  PR_CHART_DOT_HALO,
  PR_CHART_DOT_HALO_WIDTH,
  PR_CHART_DOT_RADIUS,
  PR_CHART_DOT_RADIUS_LATEST,
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
  // Chart fields — a copy/paste that leaves both PR series drawn in the same
  // color (or both charts titled the same, or labelled the same unit, or
  // sharing an empty state that names the wrong PR type) fails here. With the
  // two series now on SEPARATE charts (T2-D) these strings are the only thing
  // telling a reader which chart they are looking at, so their distinctness
  // matters more than it did when a shared legend sat above both.
  "chartStroke",
  "chartDot",
  "swatch",
  "axisLabel",
  "chartTitle",
  "chartEmptyText",
];

for (const field of fields) {
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

// --- marker geometry is SHARED, not per-type (T2-D) -------------------------
// One series per chart means a mark can only overlap another mark of its OWN
// series (two PRs close in both time and value), so both charts draw at one
// size and lean on the halo — not on a size difference — to keep a near-pair
// readable. These assertions pin the geometry that replaced the per-type radii.
check(
  "marker radius is a single shared constant, not a per-type field",
  ["chartDotRadius", "chartDotRadiusLatest", "chartDotHalo", "chartDotHaloWidth"].every(
    (field) => !(field in PR_TYPE_STYLE.weight) && !(field in PR_TYPE_STYLE.in_range_rep),
  ),
  true,
);
check(
  "the newest point is emphasized (latest radius > steady radius)",
  PR_CHART_DOT_RADIUS_LATEST > PR_CHART_DOT_RADIUS,
  true,
);
check(
  "marks are big enough to see on a 390px phone (~0.86 css px per viewBox unit)",
  PR_CHART_DOT_RADIUS * 2 * 0.86 >= 5,
  true,
);
check(
  "dots carry a contrasting halo, so two near-coincident points in ONE series still read as two",
  PR_CHART_DOT_HALO === "stroke-card" && PR_CHART_DOT_HALO_WIDTH > 0,
  true,
);
check(
  "the halo does not eat the mark it rings (halo width < radius)",
  PR_CHART_DOT_HALO_WIDTH < PR_CHART_DOT_RADIUS,
  true,
);

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

// --- the two charts' own copy (T2-D) ----------------------------------------
// With no shared legend, each panel's title and empty state are what identify
// it. An empty state that named the wrong PR type would tell a weight-only lift
// it has no weight PRs.
check("the weight chart is titled Weight PRs", PR_TYPE_STYLE.weight.chartTitle, "Weight PRs");
check("the rep chart is titled Rep PRs", PR_TYPE_STYLE.in_range_rep.chartTitle, "Rep PRs");
check(
  "the weight chart's empty state names WEIGHT PRs",
  PR_TYPE_STYLE.weight.chartEmptyText,
  "No weight PRs yet",
);
check(
  "the rep chart's empty state names REP PRs",
  PR_TYPE_STYLE.in_range_rep.chartEmptyText,
  "No rep PRs yet",
);
for (const prType of dbPrTypes) {
  const style = PR_TYPE_STYLE[prType];
  check(
    `${prType}: its empty state names its own PR type (not the other chart's)`,
    style.chartEmptyText
      .toLowerCase()
      .includes(style.chartTitle.toLowerCase().replace(/s$/, "")),
    true,
  );
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll pr-colors checks passed.");
