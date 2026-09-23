import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type MacroRangeState = "under" | "in" | "over";

export interface MacroRangeBarProps {
  /** Row label, e.g. "Protein". */
  label: ReactNode;
  /** Right-aligned readout, e.g. "82 / 180g". Caller-formatted (owns units). */
  value: ReactNode;

  /* ---- Derived mode (PREFERRED): pass the real numbers; the bar computes ---- */
  /** Amount consumed so far (same unit as the range). */
  current?: number;
  /** Target range lower bound. */
  rangeMin?: number;
  /** Target range upper bound. */
  rangeMax?: number;
  /**
   * The value that maps to 100% of the track. Defaults to `max(rangeMax*1.25,
   * current)` so the target band and the fill both fit with headroom.
   */
  axisMax?: number;

  /* ---- Explicit mode (escape hatch): override the geometry directly ---- */
  /** Fill width 0–100. Only used when `current`/`rangeMin`/`rangeMax` are absent. */
  pct?: number;
  /** Semantic state override; otherwise derived from the numbers. */
  state?: MacroRangeState;
  /** Target band left edge as % of track. No band renders unless both edges set. */
  bandStart?: number;
  /** Target band right edge as % of track. */
  bandEnd?: number;

  className?: string;
}

const FILL_BY_STATE: Record<MacroRangeState, string> = {
  in: "bg-success",
  under: "bg-warning",
  over: "bg-danger",
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * MacroRangeBar — a macro/calorie progress bar with a target-band overlay and a
 * semantic fill color. Extracted from /demo's MacroBar. Used on Today (fuel
 * glance) and Nutrition (range-vs-range).
 *
 * PREFER the derived mode: pass `current` + `rangeMin` + `rangeMax` and the bar
 * computes the fill %, the band geometry, AND the state coherently from one
 * source of truth — so the color can never disagree with the band. The explicit
 * `pct`/`state`/`bandStart`/`bandEnd` mode is only for callers that already have
 * geometry; there are NO cosmetic band defaults (an omitted band renders none).
 */
export function MacroRangeBar({
  label,
  value,
  current,
  rangeMin,
  rangeMax,
  axisMax,
  pct,
  state,
  bandStart,
  bandEnd,
  className,
}: MacroRangeBarProps) {
  const derived =
    current != null && rangeMin != null && rangeMax != null
      ? (() => {
          const max = axisMax ?? Math.max(rangeMax * 1.25, current || 0, 1);
          const derivedState: MacroRangeState =
            current < rangeMin ? "under" : current > rangeMax ? "over" : "in";
          return {
            fillPct: clampPct((current / max) * 100),
            band: {
              start: clampPct((rangeMin / max) * 100),
              end: clampPct((rangeMax / max) * 100),
            },
            state: derivedState,
          };
        })()
      : null;

  const resolvedState: MacroRangeState = state ?? derived?.state ?? "in";
  const fillPct = derived ? derived.fillPct : clampPct(pct ?? 0);
  const band = derived
    ? derived.band
    : bandStart != null && bandEnd != null
      ? { start: bandStart, end: bandEnd }
      : null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="uppercase tracking-wider text-faint">{label}</span>
        <span className="tabular-nums text-subtle">{value}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-input">
        {band && (
          <div
            className="absolute inset-y-0 bg-border"
            style={{ left: `${band.start}%`, right: `${100 - band.end}%` }}
          />
        )}
        <div
          className={cn(
            "absolute inset-y-0 left-0",
            FILL_BY_STATE[resolvedState],
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
}
