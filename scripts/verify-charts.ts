// Degenerate-input render smoke test for the shared chart components — the
// states seeded screenshots never hit: empty series, single point, flat
// values, all-zero bars. A NaN in an SVG path fails SILENTLY in the browser
// (no draw, no error), so we assert on the markup itself.
// Run: pnpm exec tsx scripts/verify-charts.ts
//
// Gotcha (load-bearing): Next's tsconfig uses jsx:preserve, so tsx compiles
// components to classic React.createElement — React must be on globalThis
// and this script builds elements without JSX.
import * as React from "react";
(globalThis as Record<string, unknown>).React = React;

import { renderToStaticMarkup } from "react-dom/server";

import { BandChart } from "../src/components/shared/BandChart";
import { PRHistoryChart } from "../src/components/shared/PRHistoryChart";
import { ProgressionChart } from "../src/components/shared/ProgressionChart";
import { VolumeBarChart } from "../src/components/shared/VolumeBarChart";
import { buildPRChartModel } from "../src/lib/analytics/pr-history";
import { DEFAULT_APP_TIMEZONE } from "../src/lib/time/appDay";

let failures = 0;

function smoke(
  name: string,
  element: React.ReactElement,
  expectEmpty: boolean,
) {
  let html = "";
  try {
    html = renderToStaticMarkup(element);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}: threw ${String(error)}`);
    return;
  }

  const bad =
    html.includes("NaN") ||
    html.includes("Infinity") ||
    (expectEmpty
      ? !(html.includes("No data yet") || html.includes("No PRs logged yet"))
      : !html.includes("<svg"));

  if (bad) {
    failures += 1;
    console.error(`✗ ${name}: markup check failed\n  ${html.slice(0, 200)}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

const e = React.createElement;

smoke("ProgressionChart: empty", e(ProgressionChart, { points: [], unitLabel: "LBS" }), true);
smoke("ProgressionChart: single point", e(ProgressionChart, { points: [{ label: "JUL 1", value: 100 }], unitLabel: "LBS" }), false);
smoke("ProgressionChart: flat series", e(ProgressionChart, { points: [{ label: "A", value: 5 }, { label: "B", value: 5 }], unitLabel: "LBS" }), false);
smoke("VolumeBarChart: empty", e(VolumeBarChart, { points: [], unitLabel: "SETS" }), true);
smoke("VolumeBarChart: all zeros", e(VolumeBarChart, { points: [{ label: "A", value: 0 }, { label: "B", value: 0 }], unitLabel: "SETS" }), false);
smoke("BandChart: empty (no zone)", e(BandChart, { points: [], unitLabel: "KCAL" }), true);
smoke("BandChart: empty with zone", e(BandChart, { points: [], targetZone: { min: 2000, max: 2400 }, unitLabel: "KCAL" }), true);
smoke("BandChart: single flat point + zero-height zone", e(BandChart, { points: [{ label: "A", min: 100, max: 100 }], targetZone: { min: 100, max: 100 }, unitLabel: "G" }), false);
smoke("BandChart: normal band", e(BandChart, { points: [{ label: "A", min: 1800, max: 2200 }, { label: "B", min: 1900, max: 2400 }], targetZone: { min: 2000, max: 2400 }, unitLabel: "KCAL" }), false);

// PRHistoryChart (T2-B) — dual-axis, two-series. Degenerate shapes only; the
// data contract is asserted in scripts/verify-pr-history-chart.ts.
const prModel = (rows: Parameters<typeof buildPRChartModel>[0]) =>
  buildPRChartModel(rows, DEFAULT_APP_TIMEZONE);
smoke("PRHistoryChart: empty", e(PRHistoryChart, { model: prModel([]) }), true);
smoke("PRHistoryChart: single weight PR", e(PRHistoryChart, { model: prModel([{ pr_id: "a", pr_type: "weight", weight_kg: 100, reps: 5, achieved_at: "2026-07-01T17:00:00Z" }]) }), false);
smoke("PRHistoryChart: single rep PR (no left axis)", e(PRHistoryChart, { model: prModel([{ pr_id: "a", pr_type: "in_range_rep", weight_kg: 40, reps: 10, achieved_at: "2026-07-01T17:00:00Z" }]) }), false);
smoke("PRHistoryChart: flat series, identical timestamps", e(PRHistoryChart, { model: prModel([{ pr_id: "a", pr_type: "weight", weight_kg: 100, reps: 5, achieved_at: "2026-07-01T17:00:00Z" }, { pr_id: "b", pr_type: "weight", weight_kg: 100, reps: 5, achieved_at: "2026-07-01T17:00:00Z" }]) }), false);
smoke("PRHistoryChart: both series", e(PRHistoryChart, { model: prModel([{ pr_id: "a", pr_type: "weight", weight_kg: 100, reps: 5, achieved_at: "2026-07-01T17:00:00Z" }, { pr_id: "b", pr_type: "in_range_rep", weight_kg: 90, reps: 12, achieved_at: "2026-07-09T17:00:00Z" }, { pr_id: "c", pr_type: "weight", weight_kg: 110, reps: 3, achieved_at: "2026-07-20T17:00:00Z" }]) }), false);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll chart smoke tests passed.");
