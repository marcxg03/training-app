import type { Enums } from "@/lib/supabase/types";

// Pure PR-type presentation map. No React, no Supabase client — plain data, so
// every surface that renders a PR (logger set row, history badge, progress
// timelines, workout summary, session detail) reads its color and label from
// ONE place and the two PR types can never drift back into looking alike.
//
// Marcus's validation feedback (2026-09-23): weight PR = BLUE, rep PR = VIOLET.
// This map is ALSO the legend and the series palette for the per-exercise PR
// graph (PRHistoryChart, T2-B) — the chart reads chartStroke/chartDot/swatch/
// axisLabel from here rather than hardcoding a color, so the graph can never
// drift from the badges that name the same two events.

export type PRType = Enums<"pr_type_enum">;

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
  /** SVG stroke class for this series' line in PRHistoryChart. */
  chartStroke: string;
  /** SVG fill class for this series' dots in PRHistoryChart. */
  chartDot: string;
  /** Stroke class for the halo ring drawn around every dot — the chart card's
   * own background, so a mark painted on top of another still reads as a
   * separate mark instead of merging into one blob. */
  chartDotHalo: string;
  /** Halo stroke width, in chart viewBox units. */
  chartDotHaloWidth: number;
  /** Marker radius, in chart viewBox units.
   *
   * THE TWO SERIES ARE DELIBERATELY DIFFERENT SIZES. One set can earn a weight
   * PR and a rep PR at the same instant, and when that is an exercise's ONLY
   * PR event both series are single points: x is centered (no time span to
   * spread across) and each y centers inside its own padded one-value axis —
   * so both marks land on the EXACT same coordinate. That coordinate is the
   * truth and must not be nudged. Instead the smaller mark sits inside the
   * larger one, separated by the halo ring, and both stay visible where they
   * actually belong. PRHistoryChart paints the largest series first for the
   * same reason — see the sort in that file.
   */
  chartDotRadius: number;
  /** Radius for the newest point of the series (the emphasized one). */
  chartDotRadiusLatest: number;
  /** Legend swatch background. */
  swatch: string;
  /** Unit this series is measured in — its y-axis label. */
  axisLabel: string;
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
    chartDotHalo: "stroke-card",
    chartDotHaloWidth: 1.3,
    // The OUTER mark of a coincident pair.
    chartDotRadius: 4.5,
    chartDotRadiusLatest: 5.8,
    swatch: "bg-pr-weight",
    axisLabel: "LBS",
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
    chartDotHalo: "stroke-card",
    // Narrower than the weight series': this halo is what separates the inner
    // mark from the outer one, and every unit of it is a unit of the outer
    // mark's fill eaten AND a wider notch cut out of this series' own line
    // between points. Just enough to read as a gap.
    chartDotHaloWidth: 1,
    // The INNER mark of a coincident pair: small enough that the weight dot's
    // fill still shows as a ring around it, halo and all — but not so small
    // that a rep-only exercise's single PR turns into a speck. Sized against
    // the 390px phone, where the chart renders ~0.86 px per viewBox unit.
    chartDotRadius: 2.2,
    chartDotRadiusLatest: 3,
    swatch: "bg-pr-rep",
    axisLabel: "REPS",
  },
};

/** Style bundle for a PR type. */
export function prTypeStyle(prType: PRType): PRTypeStyle {
  return PR_TYPE_STYLE[prType];
}
