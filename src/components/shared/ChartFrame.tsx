import type { JSX, ReactNode } from "react";

// Shared frame for the sparkline-family charts (line, bar, band): the card
// shell, empty state, svg viewBox, dashed grid, and footer label strip.
// Extracted at rule-of-three (D6). Scaling math deliberately stays in each
// chart — line charts min-anchor, bar charts zero-anchor, band charts span
// min/max — only the frame is shared.

export const CHART_VIEWBOX_WIDTH = 320;
export const CHART_VIEWBOX_HEIGHT = 130;
export const CHART_PADDING_X = 8;
export const CHART_PADDING_TOP = 16;
export const CHART_PADDING_BOTTOM = 8;
export const CHART_USABLE_WIDTH = CHART_VIEWBOX_WIDTH - CHART_PADDING_X * 2;
export const CHART_USABLE_HEIGHT =
  CHART_VIEWBOX_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

const GRID_LINES = 4;

type ChartFrameProps = {
  isEmpty: boolean;
  emptyText?: string;
  ariaLabel: string;
  unitLabel: string;
  startLabel?: string;
  endLabel?: string;
  children: ReactNode; // SVG marks, positioned against the exported constants
};

export function ChartFrame({
  isEmpty,
  emptyText = "No data yet",
  ariaLabel,
  unitLabel,
  startLabel,
  endLabel,
  children,
}: ChartFrameProps): JSX.Element {
  if (isEmpty) {
    return (
      <div className="flex h-[130px] items-center justify-center rounded-[var(--radius)] border border-border bg-card">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          {emptyText}
        </p>
      </div>
    );
  }

  const gridLines = Array.from({ length: GRID_LINES + 1 }, (_, index) => {
    const ratio = index / GRID_LINES;
    return CHART_PADDING_TOP + CHART_USABLE_HEIGHT * ratio;
  });

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${CHART_VIEWBOX_WIDTH} ${CHART_VIEWBOX_HEIGHT}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        {gridLines.map((y, index) => (
          <line
            key={`grid-${index}`}
            x1={CHART_PADDING_X}
            x2={CHART_VIEWBOX_WIDTH - CHART_PADDING_X}
            y1={y}
            y2={y}
            stroke="rgb(var(--border))"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}
        {children}
      </svg>

      <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tabular-nums tracking-[0.06em] text-faint">
        <span>{startLabel}</span>
        <span>{unitLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}
