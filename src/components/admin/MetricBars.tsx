import type { JSX } from "react";

// The one chart shape the analytics board uses (T3-E).
//
// FORM: magnitude over time, categorical x, ZERO baseline. Bars, not a line —
// a line implies a continuous quantity between the points, and there is no
// such thing as "Thursday-and-a-half of a week". The zero baseline is not
// negotiable: a min-anchored domain would make a 3-session week look a third
// of a 4-session week.
//
// COLOR: every series here is SINGLE. There is no categorical palette on this
// board at all, which is deliberate — it means there is no colorblind-safety
// question to answer, because identity is never carried by hue. Magnitude is
// carried by bar length, the only thing bars are good at. The one hue is the
// app's own ink (`--accent`); the most recent bar is full strength and the
// rest sit back at 45%, so "now" reads first without a second colour.
//
// ACCESSIBILITY: each chart ships a visually-hidden data table, so the numbers
// are available to a screen reader and to anyone who wants the values rather
// than the shape. Every bar carries a native <title> for hover.

export type MetricBarPoint = {
  label: string;
  value: number;
  /** Optional richer hover text; falls back to `label: value unit`. */
  hint?: string;
};

type MetricBarsProps = {
  points: MetricBarPoint[];
  unit: string;
  ariaLabel: string;
  /** Fixes the y-domain (adherence is 0–100); otherwise scales to the data. */
  maxValue?: number;
  /** Formats the value in labels and the table. */
  format?: (value: number) => string;
  emptyText?: string;
};

const WIDTH = 720;
const HEIGHT = 180;
const PAD_X = 4;
const PAD_TOP = 18;
const AXIS_H = 18;
const PLOT_H = HEIGHT - PAD_TOP - AXIS_H;
// A 2px surface gap between adjacent fills, expressed as a share of the slot.
const GAP_RATIO = 0.3;

export function MetricBars({
  points,
  unit,
  ariaLabel,
  maxValue,
  format = (v) => String(v),
  emptyText = "No data yet",
}: MetricBarsProps): JSX.Element {
  if (points.length === 0) {
    return (
      <p className="flex h-[180px] items-center justify-center rounded-lg bg-card-alt text-sm text-faint">
        {emptyText}
      </p>
    );
  }

  const peak = maxValue ?? Math.max(...points.map((p) => p.value), 1);
  // A domain of 0 would divide by zero AND draw full-height bars for an
  // all-zero series, which reads as "a great week" when it means "nothing".
  const domain = peak > 0 ? peak : 1;

  const slot = (WIDTH - PAD_X * 2) / points.length;
  const barWidth = Math.max(slot * (1 - GAP_RATIO), 2);
  const lastIndex = points.length - 1;
  // Label only the peak and the most recent bar — a number on every bar is a
  // table wearing a chart's clothes.
  const peakIndex = points.reduce(
    (best, p, i) => (p.value > points[best].value ? i : best),
    0,
  );

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        {/* Baseline — recessive, but present: bars need something to sit on. */}
        <line
          x1={PAD_X}
          y1={PAD_TOP + PLOT_H}
          x2={WIDTH - PAD_X}
          y2={PAD_TOP + PLOT_H}
          stroke="rgb(var(--border))"
          strokeWidth={1}
        />

        {points.map((point, index) => {
          const height = domain > 0 ? (point.value / domain) * PLOT_H : 0;
          const x = PAD_X + index * slot + (slot - barWidth) / 2;
          const y = PAD_TOP + PLOT_H - height;
          const isLatest = index === lastIndex;
          const showLabel =
            point.value > 0 && (isLatest || index === peakIndex);

          return (
            <g key={`${point.label}-${index}`}>
              {point.value > 0 ? (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(height, 2)}
                  rx={3}
                  fill="rgb(var(--accent))"
                  opacity={isLatest ? 1 : 0.45}
                >
                  <title>
                    {point.hint ??
                      `${point.label}: ${format(point.value)} ${unit}`}{" "}
                    {/* prettier-ignore */}
                  </title>
                </rect>
              ) : (
                // An explicit zero tick. Without it an empty week is
                // indistinguishable from a week that is not in the data.
                <rect
                  x={x}
                  y={PAD_TOP + PLOT_H - 2}
                  width={barWidth}
                  height={2}
                  rx={1}
                  fill="rgb(var(--border))"
                >
                  <title>{`${point.label}: 0 ${unit}`}</title>
                </rect>
              )}

              {showLabel ? (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-subtle"
                  fontSize={11}
                  fontWeight={600}
                >
                  {format(point.value)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* First and last x labels only — twelve rotated dates is noise. */}
      <div className="mt-1 flex justify-between px-1 font-mono text-[10px] uppercase tracking-wider text-faint">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>

      <figcaption className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={`${point.label}-row-${index}`}>
                <th scope="row">{point.label}</th>
                <td>{format(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** Ranked horizontal bars — for "how much did each muscle group get". */
export function RankedBars({
  points,
  unit,
  ariaLabel,
  emptyText = "No data yet",
}: {
  points: MetricBarPoint[];
  unit: string;
  ariaLabel: string;
  emptyText?: string;
}): JSX.Element {
  if (points.length === 0) {
    return (
      <p className="rounded-lg bg-card-alt p-4 text-sm text-faint">
        {emptyText}
      </p>
    );
  }

  const peak = Math.max(...points.map((p) => p.value), 1);

  return (
    <figure className="m-0">
      {/* A list, not an SVG: horizontal bars are a bar per row, and HTML does
       * rows, wrapping and text better than SVG does. */}
      <ul className="flex flex-col gap-1.5" aria-label={ariaLabel}>
        {points.map((point) => (
          <li key={point.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs capitalize text-subtle">
              {point.label.replace(/_/g, " ")}
            </span>
            <span className="relative h-5 flex-1 overflow-hidden rounded bg-card-alt">
              <span
                className="absolute inset-y-0 left-0 rounded bg-accent/70"
                style={{ width: `${Math.max((point.value / peak) * 100, 2)}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
              {point.value}
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">
        {points.map((p) => `${p.label}: ${p.value} ${unit}`).join("; ")}
      </figcaption>
    </figure>
  );
}
