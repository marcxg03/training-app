import type { Enums } from "@/lib/supabase/types";

// Pure PR-type presentation map. No React, no Supabase client — plain data, so
// every surface that renders a PR (logger set row, history badge, progress
// timelines, workout summary, session detail) reads its color and label from
// ONE place and the two PR types can never drift back into looking alike.
//
// Marcus's validation feedback (2026-09-23): weight PR = BLUE, rep PR = VIOLET.
// This map is also the legend for the planned per-exercise PR graph — add the
// series color here rather than hardcoding it at the chart.

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
};

export const PR_TYPE_STYLE: Record<PRType, PRTypeStyle> = {
  weight: {
    pill: "bg-pr-weight text-white",
    text: "text-pr-weight",
    surface: "border-pr-weight/40 bg-pr-weight/10",
    shortLabel: "PR ▲",
    label: "Weight PR",
    inlineLabel: "weight PR",
  },
  in_range_rep: {
    pill: "bg-pr-rep text-white",
    text: "text-pr-rep",
    surface: "border-pr-rep/40 bg-pr-rep/10",
    shortLabel: "REP PR ▲",
    label: "Rep PR",
    inlineLabel: "rep PR",
  },
};

/** Style bundle for a PR type. */
export function prTypeStyle(prType: PRType): PRTypeStyle {
  return PR_TYPE_STYLE[prType];
}
