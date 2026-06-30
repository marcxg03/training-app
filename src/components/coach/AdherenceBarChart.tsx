import { cn } from "@/lib/utils/cn";
import type { ProgressPoint } from "@/lib/coach/types";

type AdherenceBarChartProps = {
  points: ProgressPoint[];
  /** Highest possible value (e.g. assigned sessions per week) for scaling. */
  max: number;
};

/** Dependency-free vertical bar chart for weekly adherence (Frame 44). The
 * tallest/most-recent bar is emphasised in the accent color. */
export function AdherenceBarChart({ points, max }: AdherenceBarChartProps) {
  const safeMax = max > 0 ? max : 1;
  const lastIndex = points.length - 1;

  return (
    <div className="flex h-24 items-end justify-between gap-1.5">
      {points.map((point, index) => {
        const heightPct = Math.max(
          4,
          Math.round((point.value / safeMax) * 100),
        );
        const isPeak = point.value >= safeMax;
        const isLast = index === lastIndex;

        return (
          <div
            key={point.dateLabel}
            className="flex h-full flex-1 flex-col justify-end"
          >
            <div
              className={cn(
                "w-full rounded-t",
                isPeak || isLast ? "bg-accent" : "bg-accent/45",
              )}
              style={{ height: `${heightPct}%` }}
              aria-hidden
            />
          </div>
        );
      })}
    </div>
  );
}
