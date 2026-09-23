import Link from "next/link";

import { MacroRangeBar } from "@/components/shared";
import type { MacroBar } from "@/lib/nutrition/projections";

type TodayFuelCardProps = {
  /** Calories/Protein/Carbs/Fat bars for today. Empty when no targets are set. */
  bars: MacroBar[];
  /** Nutrition day-type label for the eyebrow, e.g. "lifting day". */
  dayLabel: string;
};

const fmt = (value: number) => value.toLocaleString("en-US");

/** Collapse an exact [min, max] range to a single readout ("82" or "70–90"). */
const rangeLabel = (min: number, max: number) =>
  min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;

/**
 * TodayFuelCard — the nutrition glance on Today, composing the shared
 * `MacroRangeBar`. Each bar is fed the real day totals + targets in RANGE-
 * derived mode (currentMin/currentMax + rangeMin/rangeMax) so the fill is an
 * honest SPAN of the logged intake range against the target band; the
 * authoritative `status` from the nutrition projection is passed as `state` so
 * the color never diverges from the Fuel tab (no midpoint lie). Tapping
 * "Log meal +" opens the full Nutrition tab.
 */
export function TodayFuelCard({ bars, dayLabel }: TodayFuelCardProps) {
  const hasTargets = bars.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
          Nutrition · {dayLabel}
        </span>
        <Link href="/nutrition" className="text-[11px] font-medium text-accent">
          {hasTargets ? "Log meal +" : "Set targets +"}
        </Link>
      </div>

      {hasTargets ? (
        bars.map((bar) => {
          const unitSuffix = bar.unit === "g" ? "g" : "";
          const value = `${rangeLabel(bar.totalMin, bar.totalMax)} / ${rangeLabel(
            bar.min,
            bar.max,
          )}${unitSuffix}`;

          return (
            <MacroRangeBar
              key={bar.key}
              label={bar.label}
              value={value}
              currentMin={bar.totalMin}
              currentMax={bar.totalMax}
              rangeMin={bar.min}
              rangeMax={bar.max}
              state={bar.status}
            />
          );
        })
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Set your calorie and macro targets to track them here.
        </p>
      )}
    </div>
  );
}
