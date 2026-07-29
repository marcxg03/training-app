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
import { ProgressionChart } from "../src/components/shared/ProgressionChart";
import { VolumeBarChart } from "../src/components/shared/VolumeBarChart";

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
    (expectEmpty ? !html.includes("No data yet") : !html.includes("<svg"));

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

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll chart smoke tests passed.");
