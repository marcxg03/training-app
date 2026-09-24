// Fixture tests for the per-exercise PR-history chart (T2-B) — the honest
// replacement for the deleted estimated-1RM surfaces. Run with:
//   pnpm exec tsx scripts/verify-pr-history-chart.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// WHAT THIS GUARDS
//   Marcus killed e1RM because it was a derived guess. The replacement charts
//   ONLY real logged PR events, so the shaping layer has to be exact:
//     - the two pr_history types land in the right series and nowhere else
//     - points are chronological regardless of the query's ordering
//     - the two y-axes scale INDEPENDENTLY (lbs on the left, reps on the
//       right) — one shared domain would flatten reps into the floor
//     - a weight-only exercise, a rep-only exercise, and a brand-new exercise
//       all render instead of throwing or emitting NaN
//
// Gotcha (load-bearing, same as verify-charts.ts): Next's tsconfig uses
// jsx:preserve, so tsx compiles components to classic React.createElement —
// React must be on globalThis and this script builds elements without JSX.
import * as React from "react";
(globalThis as Record<string, unknown>).React = React;

import { renderToStaticMarkup } from "react-dom/server";

import { PRHistoryChart } from "../src/components/shared/PRHistoryChart";
import {
  buildPRChartModel,
  buildPRSpotlights,
  type PRHistoryRow,
  type PRSpotlightRow,
} from "../src/lib/analytics/pr-history";
import { DEFAULT_APP_TIMEZONE } from "../src/lib/time/appDay";
import { PR_TYPE_STYLE } from "../src/lib/methodology/pr-colors";

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

function approx(name: string, actual: number, expected: number, eps = 1e-9) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > eps) {
    failures += 1;
    console.error(`✗ ${name}: expected ~${expected}, got ${actual}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

const TZ = DEFAULT_APP_TIMEZONE;

// 100 kg -> 220 lbs, 110 kg -> 243 lbs (rounded at the display boundary).
function row(
  prId: string,
  prType: PRHistoryRow["pr_type"],
  weightKg: number,
  reps: number,
  achievedAt: string,
): PRHistoryRow {
  return {
    pr_id: prId,
    pr_type: prType,
    weight_kg: weightKg,
    reps,
    achieved_at: achievedAt,
  };
}

// --- both series built correctly ------------------------------------------
const mixed: PRHistoryRow[] = [
  row("w1", "weight", 100, 5, "2026-07-01T17:00:00Z"),
  row("r1", "in_range_rep", 90, 8, "2026-07-05T17:00:00Z"),
  row("w2", "weight", 110, 3, "2026-07-10T17:00:00Z"),
  row("r2", "in_range_rep", 90, 12, "2026-07-20T17:00:00Z"),
];
const mixedModel = buildPRChartModel(mixed, TZ);

check(
  "series split: weight PRs only in the weight series",
  mixedModel.weight.map((p) => p.pr_id),
  ["w1", "w2"],
);
check(
  "series split: rep PRs only in the rep series",
  mixedModel.rep.map((p) => p.pr_id),
  ["r1", "r2"],
);
check("mixed model is not empty", mixedModel.isEmpty, false);
check(
  "weight series plots LBS (kg converted at the display boundary)",
  mixedModel.weight.map((p) => p.value),
  [220, 243],
);
check(
  "rep series plots REPS",
  mixedModel.rep.map((p) => p.value),
  [8, 12],
);
check(
  "every point carries both raw facts (weight lbs + reps)",
  mixedModel.rep.map((p) => ({ lbs: p.weightLbs, reps: p.reps })),
  [
    { lbs: 198, reps: 8 },
    { lbs: 198, reps: 12 },
  ],
);
check(
  "day labels come from the app-timezone day key",
  [mixedModel.startLabel, mixedModel.endLabel],
  ["JUL 1", "JUL 20"],
);

// --- chronological order, regardless of query ordering ---------------------
// getExerciseProgression returns PRs achieved_at DESC. The chart must not
// draw the history backwards.
const reversed = [...mixed].reverse();
check(
  "chronological: descending input is sorted ascending",
  buildPRChartModel(reversed, TZ).weight.map((p) => p.achieved_at),
  ["2026-07-01T17:00:00Z", "2026-07-10T17:00:00Z"],
);
check(
  "chronological: x increases with time",
  mixedModel.weight[0].x < mixedModel.weight[1].x,
  true,
);
// Ties break on pr_id so two PRs earned by the SAME set are deterministic.
const sameInstant = buildPRChartModel(
  [
    row("b", "weight", 100, 5, "2026-07-01T17:00:00Z"),
    row("a", "weight", 100, 6, "2026-07-01T17:00:00Z"),
  ],
  TZ,
);
check(
  "chronological: same-instant PRs break ties on pr_id",
  sameInstant.weight.map((p) => p.pr_id),
  ["a", "b"],
);

// --- dual axis: INDEPENDENT weight and rep ranges --------------------------
// The whole point of the dual axis. Weight spans 220..243 lbs and reps span
// 8..12; each series must fill its OWN axis (y 0 -> 1), not share one domain
// in which 8 reps would sit invisibly on the floor under a 243 lb point.
check(
  "dual axis: weight axis is built from weight PRs only (lbs)",
  mixedModel.weightAxis,
  { min: 220, max: 243 },
);
check(
  "dual axis: rep axis is built from rep PRs only (reps)",
  mixedModel.repAxis,
  { min: 8, max: 12 },
);
approx("dual axis: weight min sits at y=0", mixedModel.weight[0].y, 0);
approx("dual axis: weight max sits at y=1", mixedModel.weight[1].y, 1);
approx("dual axis: rep min sits at y=0", mixedModel.rep[0].y, 0);
approx("dual axis: rep max sits at y=1", mixedModel.rep[1].y, 1);

// A shared domain would put 8 reps at (8-8)/(243-8) ≈ 0 AND 12 reps at ≈ 0.017
// — the mutant this kills.
check(
  "dual axis: the two axes are genuinely different domains",
  JSON.stringify(mixedModel.weightAxis) !== JSON.stringify(mixedModel.repAxis),
  true,
);

// x is SHARED: two PR types earned on the same day line up vertically.
const sameDay = buildPRChartModel(
  [
    row("w", "weight", 100, 5, "2026-07-01T17:00:00Z"),
    row("r", "in_range_rep", 100, 5, "2026-07-01T17:00:00Z"),
    row("w2", "weight", 110, 5, "2026-07-11T17:00:00Z"),
  ],
  TZ,
);
approx(
  "shared x axis: same-instant weight and rep PRs share an x",
  sameDay.weight[0].x - sameDay.rep[0].x,
  0,
);

// --- a weight-only exercise ------------------------------------------------
const weightOnly = buildPRChartModel(
  [
    row("w1", "weight", 60, 5, "2026-07-01T17:00:00Z"),
    row("w2", "weight", 70, 5, "2026-07-08T17:00:00Z"),
  ],
  TZ,
);
check("weight-only: rep series is empty", weightOnly.rep.length, 0);
check("weight-only: rep axis is null (no right axis to draw)", weightOnly.repAxis, null);
check("weight-only: weight axis still scales", weightOnly.weightAxis, {
  min: 132,
  max: 154,
});
check("weight-only: not empty", weightOnly.isEmpty, false);

// --- a rep-only exercise ---------------------------------------------------
// Every rep PR row still carries the weight it was hit at, but with no weight
// PRs there is no LEFT axis — the weight axis must not be synthesized from
// rep rows.
const repOnly = buildPRChartModel(
  [
    row("r1", "in_range_rep", 40, 10, "2026-07-01T17:00:00Z"),
    row("r2", "in_range_rep", 40, 14, "2026-07-08T17:00:00Z"),
  ],
  TZ,
);
check("rep-only: weight series is empty", repOnly.weight.length, 0);
check("rep-only: weight axis is null", repOnly.weightAxis, null);
check("rep-only: rep axis scales from the rep PRs", repOnly.repAxis, {
  min: 10,
  max: 14,
});
check("rep-only: not empty", repOnly.isEmpty, false);

// --- the empty case --------------------------------------------------------
const empty = buildPRChartModel([], TZ);
check(
  "empty: no points, no axes, no labels",
  {
    weight: empty.weight.length,
    rep: empty.rep.length,
    weightAxis: empty.weightAxis,
    repAxis: empty.repAxis,
    startLabel: empty.startLabel,
    endLabel: empty.endLabel,
    isEmpty: empty.isEmpty,
  },
  {
    weight: 0,
    rep: 0,
    weightAxis: null,
    repAxis: null,
    startLabel: null,
    endLabel: null,
    isEmpty: true,
  },
);

// --- one-point and flat series (the states that produce NaN) ---------------
const onePoint = buildPRChartModel(
  [row("w1", "weight", 100, 5, "2026-07-01T17:00:00Z")],
  TZ,
);
approx("one point: x centers", onePoint.weight[0].x, 0.5);
approx("one point: y centers", onePoint.weight[0].y, 0.5);
check("one point: axis is padded so the domain is never zero-width", onePoint.weightAxis, {
  min: 219,
  max: 221,
});

// --- the FIRST state of every newly-PR'd exercise --------------------------
// One set that earns BOTH a weight PR and an in-range rep PR, and nothing
// else. Both series are single points: x centers (no time span) and each y
// centers inside its own padded one-value axis, so the two marks land on the
// IDENTICAL coordinate. That coordinate is the truth — the fix is not to move
// a mark but to make the two marks different sizes, so the smaller sits inside
// the larger and a human sees two series where the legend promises two.
const coincident = buildPRChartModel(
  [
    row("w1", "weight", 61.2, 9, "2026-09-23T17:00:00Z"),
    row("r1", "in_range_rep", 61.2, 9, "2026-09-23T17:00:00Z"),
  ],
  TZ,
);
check(
  "coincident PRs: one point in each series",
  [coincident.weight.length, coincident.rep.length],
  [1, 1],
);
approx(
  "coincident PRs: the two marks genuinely share x (same instant, honestly)",
  coincident.weight[0].x - coincident.rep[0].x,
  0,
);
approx(
  "coincident PRs: the two marks genuinely share y (each centers in its own axis)",
  coincident.weight[0].y - coincident.rep[0].y,
  0,
);

/** Every <circle> in the markup, in PAINT ORDER, with the attributes that
 * decide whether a human can tell two stacked marks apart. */
function circlesOf(html: string) {
  return [...html.matchAll(/<circle\b[^>]*>/g)].map((match) => {
    const tag = match[0];
    const attr = (name: string) =>
      tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";

    return {
      cx: Number(attr("cx")),
      cy: Number(attr("cy")),
      r: Number(attr("r")),
      cls: attr("class"),
      strokeWidth: Number(attr("stroke-width")),
    };
  });
}

// NB: React.createElement spelled out — the `e` alias is defined further down,
// with the rest of the render smokes.
const coincidentHtml = smoke(
  "PRHistoryChart: coincident weight + rep PR renders",
  React.createElement(PRHistoryChart, { model: coincident }),
  false,
);
const coincidentMarks = circlesOf(coincidentHtml);

check("coincident PRs: exactly one mark per series", coincidentMarks.length, 2);
check(
  "coincident PRs: both marks ARE drawn on the same coordinate (not nudged apart)",
  coincidentMarks.length === 2 &&
    coincidentMarks[0].cx === coincidentMarks[1].cx &&
    coincidentMarks[0].cy === coincidentMarks[1].cy,
  true,
);
// THE REGRESSION GUARD. Same coordinate + same radius = the later mark hides
// the earlier one completely and the chart shows ONE dot for TWO series.
check(
  "coincident PRs: the two marks differ in radius, so neither can hide the other",
  coincidentMarks.length === 2 && coincidentMarks[0].r !== coincidentMarks[1].r,
  true,
);
check(
  "coincident PRs: the LARGER mark is painted first (the smaller ends up inside it)",
  coincidentMarks.length === 2 && coincidentMarks[0].r > coincidentMarks[1].r,
  true,
);
check(
  "coincident PRs: the inner mark's fill still leaves a >=1px ring of the outer one",
  coincidentMarks.length === 2 &&
    coincidentMarks[0].r -
      (coincidentMarks[1].r + coincidentMarks[1].strokeWidth / 2) >=
      1,
  true,
);
check(
  "coincident PRs: every mark carries a background halo (stroke + width)",
  coincidentMarks.every(
    (mark) => mark.cls.includes("stroke-card") && mark.strokeWidth > 0,
  ),
  true,
);
check(
  "coincident PRs: one mark per series color, neither dropped",
  coincidentMarks.map((mark) =>
    mark.cls.includes(PR_TYPE_STYLE.weight.chartDot) ? "weight" : "rep",
  ),
  ["weight", "rep"],
);

const flat = buildPRChartModel(
  [
    row("w1", "weight", 100, 5, "2026-07-01T17:00:00Z"),
    row("w2", "weight", 100, 5, "2026-07-08T17:00:00Z"),
  ],
  TZ,
);
check(
  "flat series: both points center vertically",
  flat.weight.map((p) => p.y),
  [0.5, 0.5],
);

// Defensive: a corrupt weight must not leak NaN into an SVG path (a NaN in a
// path fails SILENTLY in the browser — no draw, no error).
const corrupt = buildPRChartModel(
  [
    row("w1", "weight", Number.NaN, 5, "2026-07-01T17:00:00Z"),
    row("w2", "weight", 100, Number.NaN, "2026-07-08T17:00:00Z"),
  ],
  TZ,
);
check(
  "corrupt rows coerce to 0 rather than NaN",
  corrupt.weight.every(
    (p) => Number.isFinite(p.value) && Number.isFinite(p.y) && Number.isFinite(p.x),
  ),
  true,
);

// --- buildPRSpotlights: ranking for the Progress surfaces ------------------
function spotRow(
  exerciseId: string,
  name: string,
  prId: string,
  prType: PRHistoryRow["pr_type"],
  achievedAt: string,
): PRSpotlightRow {
  return {
    exercise_id: exerciseId,
    exercise_name: name,
    pr_id: prId,
    pr_type: prType,
    weight_kg: 100,
    reps: 5,
    achieved_at: achievedAt,
  };
}

const spotlightRows: PRSpotlightRow[] = [
  spotRow("ex-b", "Bravo", "b1", "weight", "2026-07-01T17:00:00Z"),
  spotRow("ex-b", "Bravo", "b2", "in_range_rep", "2026-07-02T17:00:00Z"),
  spotRow("ex-a", "Alpha", "a1", "weight", "2026-07-01T17:00:00Z"),
  spotRow("ex-a", "Alpha", "a2", "weight", "2026-07-03T17:00:00Z"),
  spotRow("ex-a", "Alpha", "a3", "in_range_rep", "2026-07-04T17:00:00Z"),
  spotRow("ex-c", "Charlie", "c1", "weight", "2026-07-01T17:00:00Z"),
  spotRow("ex-d", "Delta", "d1", "weight", "2026-07-01T17:00:00Z"),
];

check(
  "spotlights: ranked by PR count desc, name asc on ties",
  buildPRSpotlights(spotlightRows, { limit: 4, timeZone: TZ }).map(
    (s) => s.exercise_id,
  ),
  ["ex-a", "ex-b", "ex-c", "ex-d"], // Charlie before Delta at 1 = 1
);
check(
  "spotlights: limit is honored",
  buildPRSpotlights(spotlightRows, { limit: 2, timeZone: TZ }).map(
    (s) => s.exercise_id,
  ),
  ["ex-a", "ex-b"],
);
check(
  "spotlights: each carries its own chart model",
  buildPRSpotlights(spotlightRows, { limit: 1, timeZone: TZ })[0].model.weight
    .length,
  2,
);
check("spotlights: no PRs -> no spotlights", buildPRSpotlights([], { limit: 4, timeZone: TZ }).length, 0);

// --- render smoke: no NaN, no hardcoded hex, both series named in a legend --
function smoke(name: string, element: React.ReactElement, expectEmpty: boolean) {
  let html = "";
  try {
    html = renderToStaticMarkup(element);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}: threw ${String(error)}`);
    return "";
  }

  const bad =
    html.includes("NaN") ||
    html.includes("Infinity") ||
    /#[0-9a-fA-F]{3,8}\b/.test(html) ||
    (expectEmpty ? !html.includes("No PRs logged yet") : !html.includes("<svg"));

  if (bad) {
    failures += 1;
    console.error(`✗ ${name}: markup check failed\n  ${html.slice(0, 300)}`);
  } else {
    console.log(`✓ ${name}`);
  }

  return html;
}

const e = React.createElement;

const mixedHtml = smoke(
  "PRHistoryChart: mixed series renders",
  e(PRHistoryChart, { model: mixedModel }),
  false,
);
smoke("PRHistoryChart: empty", e(PRHistoryChart, { model: empty }), true);
smoke("PRHistoryChart: one point", e(PRHistoryChart, { model: onePoint }), false);
smoke("PRHistoryChart: flat series", e(PRHistoryChart, { model: flat }), false);
smoke("PRHistoryChart: weight only", e(PRHistoryChart, { model: weightOnly }), false);
smoke("PRHistoryChart: rep only", e(PRHistoryChart, { model: repOnly }), false);

// The legend is the contract with pr-colors.ts: both series named, both token
// colors present, neither hardcoded.
check(
  "legend names the weight series",
  mixedHtml.includes(PR_TYPE_STYLE.weight.label),
  true,
);
check(
  "legend names the rep series",
  mixedHtml.includes(PR_TYPE_STYLE.in_range_rep.label),
  true,
);
check(
  "marks read the weight color from pr-colors",
  mixedHtml.includes(PR_TYPE_STYLE.weight.chartStroke),
  true,
);
check(
  "marks read the rep color from pr-colors",
  mixedHtml.includes(PR_TYPE_STYLE.in_range_rep.chartStroke),
  true,
);
check(
  "legend swatches read from pr-colors",
  mixedHtml.includes(PR_TYPE_STYLE.weight.swatch) &&
    mixedHtml.includes(PR_TYPE_STYLE.in_range_rep.swatch),
  true,
);
check(
  "axis units are labelled from pr-colors (LBS left, REPS right)",
  [PR_TYPE_STYLE.weight.axisLabel, PR_TYPE_STYLE.in_range_rep.axisLabel],
  ["LBS", "REPS"],
);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll PR-history chart tests passed.");
