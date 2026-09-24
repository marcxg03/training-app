import type { JSX } from "react";

import {
  CHART_PADDING_TOP,
  CHART_PADDING_X,
  CHART_USABLE_HEIGHT,
  CHART_USABLE_WIDTH,
  ChartFrame,
} from "@/components/shared/ChartFrame";
import type {
  PRChartAxis,
  PRChartModel,
  PRChartPoint,
} from "@/lib/analytics/pr-history";
import { PR_TYPE_STYLE, type PRTypeStyle } from "@/lib/methodology/pr-colors";

// The per-exercise PR graph (T2-B) — the replacement for the deleted estimated
// -1RM charts. Two series of REAL logged events over time:
//
//   weight PRs (blue, --pr-weight)   -> LEFT  axis, lbs
//   in-range rep PRs (violet, --pr-rep) -> RIGHT axis, reps
//
// Grammar note (D6): the frame is shared with the sparkline family, the
// scaling is not. This chart's x domain is TIME (real gaps between PRs show as
// real gaps) and its two y domains are INDEPENDENT — reps in single digits and
// loads in the hundreds cannot share one axis without flattening the reps.
// All shaping is done by buildPRChartModel; this component only draws.
//
// Every color, swatch, unit label, marker radius, and halo comes from
// pr-colors.ts, the same map the PR badges read, so the legend can never say
// one thing and the badge another — and so the two series' MARKER SIZES (which
// are what keep a coincident pair readable, see seriesInPaintOrder below) live
// next to the colors they belong to rather than as loose numbers in here.

type PRHistoryChartProps = {
  model: PRChartModel;
  ariaLabel?: string;
  unitLabel?: string;
  emptyText?: string;
};

/**
 * The two series in paint order: LARGEST MARKER FIRST.
 *
 * Two PRs earned by the same set share an x, and when each series holds only
 * that one PR they share a y as well (each centers in its own padded
 * single-value axis) — the first state every newly-PR'd exercise is in. Both
 * marks then sit on the identical, correct coordinate, so the one painted
 * second is the only one a human can see. Rather than lie about the data by
 * offsetting a mark in time or value, the series carry different radii
 * (pr-colors.ts) and the bigger one goes down first: the smaller mark lands
 * inside it, ringed by its own background-colored halo, and BOTH read.
 *
 * Derived from the radii rather than hardcoded, so changing a radius in
 * pr-colors.ts can never silently re-hide a series here.
 */
function seriesInPaintOrder(
  model: PRChartModel,
): { key: string; points: PRChartPoint[]; style: PRTypeStyle }[] {
  return [
    { key: "weight", points: model.weight, style: PR_TYPE_STYLE.weight },
    { key: "rep", points: model.rep, style: PR_TYPE_STYLE.in_range_rep },
  ].sort((a, b) => b.style.chartDotRadiusLatest - a.style.chartDotRadiusLatest);
}

function svgX(x: number): number {
  return CHART_PADDING_X + CHART_USABLE_WIDTH * x;
}

function svgY(y: number): number {
  return CHART_PADDING_TOP + CHART_USABLE_HEIGHT * (1 - y);
}

function linePath(points: PRChartPoint[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${svgX(point.x).toFixed(2)} ${svgY(point.y).toFixed(2)}`,
    )
    .join(" ");
}

function Series({
  points,
  style,
}: {
  points: PRChartPoint[];
  style: PRTypeStyle;
}): JSX.Element | null {
  if (points.length === 0) {
    return null;
  }

  return (
    <>
      {points.length > 1 ? (
        <path
          d={linePath(points)}
          fill="none"
          className={style.chartStroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}

      {points.map((point, index) => (
        <circle
          key={point.pr_id}
          cx={svgX(point.x)}
          cy={svgY(point.y)}
          r={
            index === points.length - 1
              ? style.chartDotRadiusLatest
              : style.chartDotRadius
          }
          className={`${style.chartDot} ${style.chartDotHalo}`}
          strokeWidth={style.chartDotHaloWidth}
        />
      ))}
    </>
  );
}

// Legend + axis extents in ONE row: the left item is the left axis, the right
// item is the right axis, and each names its series, its unit, and the range it
// spans. Axis ticks cannot live inside the svg — ChartFrame draws with
// preserveAspectRatio="none", which would stretch text horizontally.
function LegendItem({
  style,
  axis,
  align,
}: {
  style: PRTypeStyle;
  axis: PRChartAxis | null;
  align: "left" | "right";
}): JSX.Element {
  const range =
    axis === null
      ? "—"
      : `${Math.round(axis.min)}–${Math.round(axis.max)} ${style.axisLabel}`;

  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 ${align === "right" ? "items-end text-right" : "items-start text-left"} ${axis === null ? "opacity-45" : ""}`}
    >
      <span className="flex items-center gap-1.5">
        {align === "right" ? null : (
          <span className={`h-2 w-2 shrink-0 rounded-full ${style.swatch}`} />
        )}
        <span className="truncate text-[11px] font-medium text-foreground">
          {style.label}
        </span>
        {align === "right" ? (
          <span className={`h-2 w-2 shrink-0 rounded-full ${style.swatch}`} />
        ) : null}
      </span>
      <span className="font-mono text-[9px] uppercase tabular-nums tracking-[0.06em] text-faint">
        {align === "right" ? "right · " : "left · "}
        {range}
      </span>
    </div>
  );
}

export function PRHistoryChart({
  model,
  ariaLabel = "Personal-record history",
  unitLabel = "PR HISTORY",
  emptyText = "No PRs logged yet",
}: PRHistoryChartProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <LegendItem
          style={PR_TYPE_STYLE.weight}
          axis={model.weightAxis}
          align="left"
        />
        <LegendItem
          style={PR_TYPE_STYLE.in_range_rep}
          axis={model.repAxis}
          align="right"
        />
      </div>

      <ChartFrame
        isEmpty={model.isEmpty}
        emptyText={emptyText}
        ariaLabel={ariaLabel}
        unitLabel={unitLabel}
        startLabel={model.startLabel ?? undefined}
        endLabel={model.endLabel ?? undefined}
      >
        {seriesInPaintOrder(model).map((series) => (
          <Series
            key={series.key}
            points={series.points}
            style={series.style}
          />
        ))}
      </ChartFrame>
    </div>
  );
}
