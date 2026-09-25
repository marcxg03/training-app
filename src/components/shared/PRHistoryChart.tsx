import type { JSX } from "react";

import {
  CHART_PADDING_TOP,
  CHART_PADDING_X,
  CHART_USABLE_HEIGHT,
  CHART_USABLE_WIDTH,
  ChartFrame,
} from "@/components/shared/ChartFrame";
import type { PRChartModel, PRChartSeries } from "@/lib/analytics/pr-history";
import {
  PR_CHART_DOT_HALO,
  PR_CHART_DOT_HALO_WIDTH,
  PR_CHART_DOT_RADIUS,
  PR_CHART_DOT_RADIUS_LATEST,
  PR_TYPE_STYLE,
  type PRTypeStyle,
} from "@/lib/methodology/pr-colors";

// The per-exercise PR graphs — the replacement for the deleted estimated-1RM
// charts. REAL logged events over time, in TWO stacked panels (T2-D):
//
//   Weight PRs (blue, --pr-weight)  -> its own chart, its own y-axis, lbs
//   Rep PRs    (violet, --pr-rep)   -> its own chart, its own y-axis, reps
//
// WHY TWO (Marcus, 2026-09-24): one dual-axis canvas made the two series look
// comparable when they share nothing but a date, and the reader had to work out
// which axis a line belonged to before they could read it. Two single-axis
// charts have no axis ambiguity, no scale ambiguity, and no marker-collision
// problem — a weight mark and a rep mark can no longer land on one coordinate
// because they are no longer on one canvas. All shaping is done by
// buildPRChartModel; this component only draws.
//
// BOTH panels always render. An exercise with only weight PRs shows a weight
// chart with data and a rep chart reading "No rep PRs yet" — a panel that
// disappeared would read as a bug, and the empty state is the honest answer to
// "where are my rep PRs?". Every color, swatch, title, unit label and empty
// string comes from pr-colors.ts, the same map the PR badges read.

type PRHistoryChartProps = {
  model: PRChartModel;
  /** Base label; each panel appends its own series name. */
  ariaLabel?: string;
};

function svgX(x: number): number {
  return CHART_PADDING_X + CHART_USABLE_WIDTH * x;
}

function svgY(y: number): number {
  return CHART_PADDING_TOP + CHART_USABLE_HEIGHT * (1 - y);
}

function linePath(series: PRChartSeries): string {
  return series.points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${svgX(point.x).toFixed(2)} ${svgY(point.y).toFixed(2)}`,
    )
    .join(" ");
}

/** Title + range for one panel: the swatch and name on the left, the span this
 * chart's own axis covers on the right. Axis ticks cannot live inside the svg —
 * ChartFrame draws with preserveAspectRatio="none", which would stretch text
 * horizontally — so the extent is stated here instead. */
function PanelHeader({
  style,
  series,
}: {
  style: PRTypeStyle;
  series: PRChartSeries;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${style.swatch}`} />
        <span className="truncate text-[11px] font-medium text-foreground">
          {style.chartTitle}
        </span>
      </span>
      <span className="shrink-0 font-mono text-[9px] uppercase tabular-nums tracking-[0.06em] text-faint">
        {series.axis === null
          ? "—"
          : `${Math.round(series.axis.min)}–${Math.round(series.axis.max)} ${style.axisLabel}`}
      </span>
    </div>
  );
}

/** One series, one chart, one y-axis. */
function SeriesChart({
  style,
  series,
  ariaLabel,
}: {
  style: PRTypeStyle;
  series: PRChartSeries;
  ariaLabel: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <PanelHeader style={style} series={series} />

      <ChartFrame
        isEmpty={series.isEmpty}
        emptyText={style.chartEmptyText}
        ariaLabel={ariaLabel}
        unitLabel={style.axisLabel}
        startLabel={series.startLabel ?? undefined}
        endLabel={series.endLabel ?? undefined}
      >
        {series.points.length > 1 ? (
          <path
            d={linePath(series)}
            fill="none"
            className={style.chartStroke}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {series.points.map((point, index) => (
          <circle
            key={point.pr_id}
            cx={svgX(point.x)}
            cy={svgY(point.y)}
            r={
              index === series.points.length - 1
                ? PR_CHART_DOT_RADIUS_LATEST
                : PR_CHART_DOT_RADIUS
            }
            className={`${style.chartDot} ${PR_CHART_DOT_HALO}`}
            strokeWidth={PR_CHART_DOT_HALO_WIDTH}
          />
        ))}
      </ChartFrame>
    </div>
  );
}

export function PRHistoryChart({
  model,
  ariaLabel = "Personal-record history",
}: PRHistoryChartProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3.5">
      <SeriesChart
        style={PR_TYPE_STYLE.weight}
        series={model.weight}
        ariaLabel={`${ariaLabel} — ${PR_TYPE_STYLE.weight.chartTitle}`}
      />
      <SeriesChart
        style={PR_TYPE_STYLE.in_range_rep}
        series={model.rep}
        ariaLabel={`${ariaLabel} — ${PR_TYPE_STYLE.in_range_rep.chartTitle}`}
      />
    </div>
  );
}
