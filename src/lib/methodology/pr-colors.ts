import type { Enums } from "@/lib/supabase/types";

// Pure PR-type presentation map. No React, no Supabase client — plain data, so
// every surface that renders a PR (logger set row, history badge, progress
// timelines, workout summary, session detail) reads its color and label from
// ONE place and the two PR types can never drift back into looking alike.
//
// Marcus's validation feedback (2026-09-23): weight PR = BLUE, rep PR = VIOLET.
// This map is ALSO the title, legend and series palette for the per-exercise PR
// graphs (PRHistoryChart) — each chart reads chartTitle/chartStroke/chartDot/
// swatch/axisLabel/chartEmptyText from here rather than hardcoding a color or a
// string, so a graph can never drift from the badges that name the same event.
//
// T2-D (2026-09-24): the one dual-axis chart became TWO stacked single-axis
// charts (Marcus: "the scaling might be off"), so the per-type MARKER GEOMETRY
// that existed only to keep two coincident marks apart on a shared canvas is
// gone. The two series never share a canvas now, so they share one geometry —
// the constants below — and differ only in color, title, and unit.

export type PRType = Enums<"pr_type_enum">;

// --- shared chart geometry (viewBox units) ---------------------------------
// One series per chart, so a mark can only ever overlap ANOTHER MARK OF ITS
// OWN SERIES (two PRs close in both time and value). The halo is what keeps
// that pair reading as two points instead of one blob; it is the card's own
// background, drawn on the mark's edge.

/** Marker radius for every point but the newest. */
export const PR_CHART_DOT_RADIUS = 3.2;
/** Marker radius for the newest point of a series (the emphasized one). */
export const PR_CHART_DOT_RADIUS_LATEST = 4.6;
/** Halo ring class — the chart card's background. */
export const PR_CHART_DOT_HALO = "stroke-card";
/** Halo stroke width, in chart viewBox units. */
export const PR_CHART_DOT_HALO_WIDTH = 1.2;

export type PRTypeStyle = {
  /** Solid pill — token background with a white foreground. */
  pill: string;
  /** Token text color, for inline labels and icons drawn in currentColor. */
  text: string;
  /** Tinted card treatment (border + wash) for the workout-summary rows. */
  surface: string;
  /** Compact pill text for the logger's inline set-row badge. */
  shortLabel: string;
  /** Standalone label for badges and summaries. */
  label: string;
  /** Lowercase form for use mid-sentence (e.g. a timeline subtitle). */
  inlineLabel: string;
  /** SVG stroke class for this series' line in its PRHistoryChart panel. */
  chartStroke: string;
  /** SVG fill class for this series' dots. */
  chartDot: string;
  /** Legend swatch background. */
  swatch: string;
  /** Unit this series is measured in — its y-axis label. */
  axisLabel: string;
  /** Heading above this series' OWN chart panel (T2-D: one chart per type). */
  chartTitle: string;
  /** What that panel says when this exercise has no PR of this type. Each
   * panel carries its own empty state so a weight-only lift reads as
   * "no rep PRs yet" rather than as a chart that silently vanished. */
  chartEmptyText: string;
};

export const PR_TYPE_STYLE: Record<PRType, PRTypeStyle> = {
  weight: {
    pill: "bg-pr-weight text-white",
    text: "text-pr-weight",
    surface: "border-pr-weight/40 bg-pr-weight/10",
    shortLabel: "PR ▲",
    label: "Weight PR",
    inlineLabel: "weight PR",
    chartStroke: "stroke-pr-weight",
    chartDot: "fill-pr-weight",
    swatch: "bg-pr-weight",
    axisLabel: "LBS",
    chartTitle: "Weight PRs",
    chartEmptyText: "No weight PRs yet",
  },
  in_range_rep: {
    pill: "bg-pr-rep text-white",
    text: "text-pr-rep",
    surface: "border-pr-rep/40 bg-pr-rep/10",
    shortLabel: "REP PR ▲",
    label: "Rep PR",
    inlineLabel: "rep PR",
    chartStroke: "stroke-pr-rep",
    chartDot: "fill-pr-rep",
    swatch: "bg-pr-rep",
    axisLabel: "REPS",
    chartTitle: "Rep PRs",
    chartEmptyText: "No rep PRs yet",
  },
};

/** Style bundle for a PR type. */
export function prTypeStyle(prType: PRType): PRTypeStyle {
  return PR_TYPE_STYLE[prType];
}
