// Fixture tests for the per-exercise PR-history charts (T2-B, reshaped T2-D) —
// the honest replacement for the deleted estimated-1RM surfaces. Run with:
//   pnpm exec tsx scripts/verify-pr-history-chart.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// WHAT THIS GUARDS
//   Marcus killed e1RM because it was a derived guess. The replacement charts
//   ONLY real logged PR events, so the shaping layer has to be exact:
//     - the two pr_history types land in the right series and nowhere else
//     - points are chronological regardless of the query's ordering
//     - TWO SEPARATE CHARTS (T2-D, Marcus: "it is confusing looking at it on
//       one graph and the scaling might be off"): each series carries its OWN
//       value axis AND its own time domain, and each fills its own chart
//     - a weight-only exercise, a rep-only exercise, and a brand-new exercise
//       all render — each empty panel carrying its OWN empty state — instead of
//       throwing or emitting NaN
//
//   The old coincident-marker assertions (two marks on one coordinate kept
//   apart by different radii, radius-ordered paint) are GONE with the behavior
//   they guarded: with one series per canvas two marks can no longer collide.
//   What replaces them is the two-chart contract below.
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
  mixedModel.weight.points.map((p) => p.pr_id),
  ["w1", "w2"],
);
check(
  "series split: rep PRs only in the rep series",
  mixedModel.rep.points.map((p) => p.pr_id),
  ["r1", "r2"],
);
check("mixed model is not empty", mixedModel.isEmpty, false);
check(
  "weight series plots LBS (kg converted at the display boundary)",
  mixedModel.weight.points.map((p) => p.value),
  [220, 243],
);
check(
  "rep series plots REPS",
  mixedModel.rep.points.map((p) => p.value),
  [8, 12],
);
check(
  "every point carries both raw facts (weight lbs + reps)",
  mixedModel.rep.points.map((p) => ({ lbs: p.weightLbs, reps: p.reps })),
  [
    { lbs: 198, reps: 8 },
    { lbs: 198, reps: 12 },
  ],
);

// --- chronological order, regardless of query ordering ---------------------
// getExerciseProgression returns PRs achieved_at DESC. The charts must not
// draw the history backwards.
const reversed = [...mixed].reverse();
check(
  "chronological: descending input is sorted ascending",
  buildPRChartModel(reversed, TZ).weight.points.map((p) => p.achieved_at),
  ["2026-07-01T17:00:00Z", "2026-07-10T17:00:00Z"],
);
check(
  "chronological: x increases with time",
  mixedModel.weight.points[0].x < mixedModel.weight.points[1].x,
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
  sameInstant.weight.points.map((p) => p.pr_id),
  ["a", "b"],
);

// --- TWO CHARTS: each series scales INDEPENDENTLY ---------------------------
// The whole point of the split (T2-D). Weight spans 220..243 lbs and reps span
// 8..12; each series must fill its OWN chart (y 0 -> 1) against its OWN axis,
// never a shared domain in which 8 reps would sit invisibly on the floor under
// a 243 lb point.
check(
  "two charts: the weight chart's axis is built from weight PRs only (lbs)",
  mixedModel.weight.axis,
  { min: 220, max: 243 },
);
check(
  "two charts: the rep chart's axis is built from rep PRs only (reps)",
  mixedModel.rep.axis,
  { min: 8, max: 12 },
);
approx("weight chart: its min sits at y=0", mixedModel.weight.points[0].y, 0);
approx("weight chart: its max sits at y=1", mixedModel.weight.points[1].y, 1);
approx("rep chart: its min sits at y=0", mixedModel.rep.points[0].y, 0);
approx("rep chart: its max sits at y=1", mixedModel.rep.points[1].y, 1);

// A shared domain would put 8 reps at (8-8)/(243-8) ≈ 0 AND 12 reps at ≈ 0.017
// — the mutant this kills.
check(
  "two charts: the two axes are genuinely different domains",
  JSON.stringify(mixedModel.weight.axis) !== JSON.stringify(mixedModel.rep.axis),
  true,
);

// Each chart also owns its own TIME domain and says so in its own footer
// labels: the weight series runs JUL 1 → JUL 10, the rep series JUL 5 → JUL 20,
// and each spans its own chart edge to edge.
check(
  "two charts: the weight chart labels its OWN date range",
  [mixedModel.weight.startLabel, mixedModel.weight.endLabel],
  ["JUL 1", "JUL 10"],
);
check(
  "two charts: the rep chart labels its OWN date range",
  [mixedModel.rep.startLabel, mixedModel.rep.endLabel],
  ["JUL 5", "JUL 20"],
);
check(
  "two charts: each series spans its own x domain edge to edge",
  [
    mixedModel.weight.points[0].x,
    mixedModel.weight.points[1].x,
    mixedModel.rep.points[0].x,
    mixedModel.rep.points[1].x,
  ],
  [0, 1, 0, 1],
);

// --- a weight-only exercise ------------------------------------------------
const weightOnly = buildPRChartModel(
  [
    row("w1", "weight", 60, 5, "2026-07-01T17:00:00Z"),
    row("w2", "weight", 70, 5, "2026-07-08T17:00:00Z"),
  ],
  TZ,
);
check("weight-only: rep series has no points", weightOnly.rep.points.length, 0);
check("weight-only: the rep chart is empty", weightOnly.rep.isEmpty, true);
check("weight-only: the rep chart has no axis", weightOnly.rep.axis, null);
check("weight-only: the weight chart still scales", weightOnly.weight.axis, {
  min: 132,
  max: 154,
});
check("weight-only: the weight chart is NOT empty", weightOnly.weight.isEmpty, false);
check("weight-only: the model as a whole is not empty", weightOnly.isEmpty, false);

// --- a rep-only exercise ---------------------------------------------------
// Every rep PR row still carries the weight it was hit at, but with no weight
// PRs there is no weight chart data — the weight axis must not be synthesized
// from rep rows.
const repOnly = buildPRChartModel(
  [
    row("r1", "in_range_rep", 40, 10, "2026-07-01T17:00:00Z"),
    row("r2", "in_range_rep", 40, 14, "2026-07-08T17:00:00Z"),
  ],
  TZ,
);
check("rep-only: weight series has no points", repOnly.weight.points.length, 0);
check("rep-only: the weight chart is empty", repOnly.weight.isEmpty, true);
check("rep-only: the weight chart has no axis", repOnly.weight.axis, null);
check("rep-only: the rep chart scales from the rep PRs", repOnly.rep.axis, {
  min: 10,
  max: 14,
});
check("rep-only: the rep chart is NOT empty", repOnly.rep.isEmpty, false);
check("rep-only: the model as a whole is not empty", repOnly.isEmpty, false);

// --- the empty case --------------------------------------------------------
const empty = buildPRChartModel([], TZ);
check(
  "empty: no points, no axes, no labels, both charts empty",
  {
    weight: empty.weight.points.length,
    rep: empty.rep.points.length,
    weightAxis: empty.weight.axis,
    repAxis: empty.rep.axis,
    weightStart: empty.weight.startLabel,
    repEnd: empty.rep.endLabel,
    weightEmpty: empty.weight.isEmpty,
    repEmpty: empty.rep.isEmpty,
    isEmpty: empty.isEmpty,
  },
  {
    weight: 0,
    rep: 0,
    weightAxis: null,
    repAxis: null,
    weightStart: null,
    repEnd: null,
    weightEmpty: true,
    repEmpty: true,
    isEmpty: true,
  },
);

// --- one-point and flat series (the states that produce NaN) ---------------
const onePoint = buildPRChartModel(
  [row("w1", "weight", 100, 5, "2026-07-01T17:00:00Z")],
  TZ,
);
approx("one point: x centers", onePoint.weight.points[0].x, 0.5);
approx("one point: y centers", onePoint.weight.points[0].y, 0.5);
check("one point: axis is padded so the domain is never zero-width", onePoint.weight.axis, {
  min: 219,
  max: 221,
});

// --- the FIRST state of every newly-PR'd exercise --------------------------
// One set that earns BOTH a weight PR and an in-range rep PR, and nothing else.
// On the OLD single-canvas chart this was the hard case: both marks landed on
// the identical coordinate and one hid the other, which is why the two series
// carried different radii. With one series per chart the case is trivial — each
// panel holds exactly one mark, on its own canvas, and neither can occlude
// anything. What still has to hold is that BOTH panels got their point.
const coincident = buildPRChartModel(
  [
    row("w1", "weight", 61.2, 9, "2026-09-23T17:00:00Z"),
    row("r1", "in_range_rep", 61.2, 9, "2026-09-23T17:00:00Z"),
  ],
  TZ,
);
check(
  "one set earning both PR types: one point in each series",
  [coincident.weight.points.length, coincident.rep.points.length],
  [1, 1],
);
check(
  "one set earning both PR types: each chart is populated, neither empty",
  [coincident.weight.isEmpty, coincident.rep.isEmpty, coincident.isEmpty],
  [false, false, false],
);
check(
  "one set earning both PR types: each chart scales to its OWN single value",
  [coincident.weight.axis, coincident.rep.axis],
  [
    { min: 134, max: 136 }, // 61.2 kg -> 135 lbs, padded
    { min: 8, max: 10 }, // 9 reps, padded
  ],
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
  flat.weight.points.map((p) => p.y),
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
  corrupt.weight.points.every(
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
    .points.length,
  2,
);
check("spotlights: no PRs -> no spotlights", buildPRSpotlights([], { limit: 4, timeZone: TZ }).length, 0);
// T2-E: the Trends surface renders ONE exercise at a time behind a selector, so
// the limit is now a MENU length (12) rather than a page length (4). A limit
// wider than the data must return everything that has PR history and invent
// nothing — an empty option would be a chart-less choice.
check(
  "spotlights: a limit wider than the data returns every exercise with PR history",
  buildPRSpotlights(spotlightRows, { limit: 12, timeZone: TZ }).map(
    (s) => s.exercise_id,
  ),
  ["ex-a", "ex-b", "ex-c", "ex-d"],
);
check(
  "spotlights: every offered option carries a non-empty chart model",
  buildPRSpotlights(spotlightRows, { limit: 12, timeZone: TZ }).every(
    (s) => !s.model.isEmpty,
  ),
  true,
);

// --- render smoke: no NaN, no hardcoded hex, two titled charts --------------
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
    // Both panels always render, so an all-empty model must show BOTH empty
    // states and a populated one must draw at least one <svg>.
    (expectEmpty
      ? !(
          html.includes(PR_TYPE_STYLE.weight.chartEmptyText) &&
          html.includes(PR_TYPE_STYLE.in_range_rep.chartEmptyText)
        )
      : !html.includes("<svg"));

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
const weightOnlyHtml = smoke(
  "PRHistoryChart: weight only",
  e(PRHistoryChart, { model: weightOnly }),
  false,
);
const repOnlyHtml = smoke(
  "PRHistoryChart: rep only",
  e(PRHistoryChart, { model: repOnly }),
  false,
);
const coincidentHtml = smoke(
  "PRHistoryChart: one set earning both PR types renders",
  e(PRHistoryChart, { model: coincident }),
  false,
);

/** Every <circle> in the markup, with the attributes that decide whether a
 * human can see the marks at all. */
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

/** How many <svg> the markup holds — one per POPULATED panel (an empty panel
 * renders a text placeholder, no svg). */
function svgCount(html: string) {
  return [...html.matchAll(/<svg\b/g)].length;
}

// --- THE TWO-CHART CONTRACT, on the render ---------------------------------
check(
  "two charts: a mixed exercise renders TWO separate <svg> canvases",
  svgCount(mixedHtml),
  2,
);
check(
  "two charts: each panel is titled from pr-colors",
  [
    mixedHtml.includes(PR_TYPE_STYLE.weight.chartTitle),
    mixedHtml.includes(PR_TYPE_STYLE.in_range_rep.chartTitle),
  ],
  [true, true],
);
check(
  "two charts: each panel names its own unit (LBS / REPS)",
  [
    mixedHtml.includes(PR_TYPE_STYLE.weight.axisLabel),
    mixedHtml.includes(PR_TYPE_STYLE.in_range_rep.axisLabel),
  ],
  [true, true],
);
check(
  "two charts: the per-chart aria-labels are distinct",
  [
    mixedHtml.includes(
      `aria-label="Personal-record history — ${PR_TYPE_STYLE.weight.chartTitle}"`,
    ),
    mixedHtml.includes(
      `aria-label="Personal-record history — ${PR_TYPE_STYLE.in_range_rep.chartTitle}"`,
    ),
  ],
  [true, true],
);
// The dual-axis legend is gone: nothing tells the reader to look left or right
// any more, because there is no left-or-right to look at.
check(
  "two charts: no left/right axis legend survives",
  /left\s*·|right\s*·/i.test(mixedHtml),
  false,
);

// WEIGHT-ONLY: the weight chart carries data, the rep chart reads empty. The
// panel is NOT hidden — a chart that vanished would read as a bug.
check(
  "weight-only: exactly ONE canvas is drawn (the weight one)",
  svgCount(weightOnlyHtml),
  1,
);
check(
  "weight-only: the rep panel still renders, carrying its own empty state",
  [
    weightOnlyHtml.includes(PR_TYPE_STYLE.in_range_rep.chartTitle),
    weightOnlyHtml.includes(PR_TYPE_STYLE.in_range_rep.chartEmptyText),
  ],
  [true, true],
);
check(
  "weight-only: no rep-colored mark is drawn anywhere",
  weightOnlyHtml.includes(PR_TYPE_STYLE.in_range_rep.chartDot),
  false,
);
check(
  "weight-only: every mark drawn is a weight mark",
  circlesOf(weightOnlyHtml).every((mark) =>
    mark.cls.includes(PR_TYPE_STYLE.weight.chartDot),
  ),
  true,
);

// REP-ONLY: the mirror image.
check(
  "rep-only: exactly ONE canvas is drawn (the rep one)",
  svgCount(repOnlyHtml),
  1,
);
check(
  "rep-only: the weight panel still renders, carrying its own empty state",
  [
    repOnlyHtml.includes(PR_TYPE_STYLE.weight.chartTitle),
    repOnlyHtml.includes(PR_TYPE_STYLE.weight.chartEmptyText),
  ],
  [true, true],
);
check(
  "rep-only: no weight-colored mark is drawn anywhere",
  repOnlyHtml.includes(PR_TYPE_STYLE.weight.chartDot),
  false,
);

// ONE SET, BOTH PR TYPES — the case the deleted radius machinery existed for.
const coincidentMarks = circlesOf(coincidentHtml);
check(
  "both-PR-types: two canvases, one mark on each",
  [svgCount(coincidentHtml), coincidentMarks.length],
  [2, 2],
);
check(
  "both-PR-types: one mark per series color, neither dropped",
  coincidentMarks.map((mark) =>
    mark.cls.includes(PR_TYPE_STYLE.weight.chartDot) ? "weight" : "rep",
  ),
  ["weight", "rep"],
);
// The marks may now share a coordinate freely — they are on DIFFERENT canvases,
// so nothing occludes anything and nothing has to be sized around it. This is
// the assertion that replaces "the two marks differ in radius".
check(
  "both-PR-types: the two marks are the same size (no occlusion to design around)",
  coincidentMarks.length === 2 && coincidentMarks[0].r === coincidentMarks[1].r,
  true,
);
check(
  "both-PR-types: every mark still carries a background halo",
  coincidentMarks.every(
    (mark) => mark.cls.includes("stroke-card") && mark.strokeWidth > 0,
  ),
  true,
);

// The chart copy is the contract with pr-colors.ts: both series named, both
// token colors present, neither hardcoded.
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
  "panel swatches read from pr-colors",
  mixedHtml.includes(PR_TYPE_STYLE.weight.swatch) &&
    mixedHtml.includes(PR_TYPE_STYLE.in_range_rep.swatch),
  true,
);
check(
  "axis units are labelled from pr-colors (LBS on one chart, REPS on the other)",
  [PR_TYPE_STYLE.weight.axisLabel, PR_TYPE_STYLE.in_range_rep.axisLabel],
  ["LBS", "REPS"],
);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll PR-history chart tests passed.");
