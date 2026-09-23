import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type MacroRangeState = "under" | "in" | "over";

export interface MacroRangeBarProps {
  /** Row label, e.g. "Protein". */
  label: ReactNode;
  /** Right-aligned readout, e.g. "82 / 180g". Caller-formatted (owns units). */
  value: ReactNode;

  /* ---- Derived mode (PREFERRED): pass the real numbers; the bar computes ---- */
  /** Amount consumed so far (same unit as the range). Point-derived mode. */
  current?: number;
  /**
   * Intake RANGE lower bound. Accepted for backward compatibility but IGNORED
   * for the fill: the intake bar is a left-anchored progress fill `0 →
   * currentMax` (a zero-width span was invisible for exact meals, min===max).
   */
  currentMin?: number;
  /**
   * Intake RANGE upper bound (range-derived mode). With `rangeMin`/`rangeMax`
   * set, the fill runs left-anchored `0 → currentMax`.
   */
  currentMax?: number;
  /** Target range lower bound. */
  rangeMin?: number;
  /** Target range upper bound. */
  rangeMax?: number;
  /**
   * The value that maps to 100% of the track. Defaults to `max(rangeMax*1.25,
   * current, currentMax, 1)` so the target band and the fill both fit with
   * headroom.
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
 * Three modes:
 * - RANGE-DERIVED (Today's fuel glance): pass `currentMax` (+ optionally
 *   `currentMin`, ignored) + `rangeMin` + `rangeMax`. The fill is a LEFT-ANCHORED
 *   progress fill `0 → currentMax` (always visible, including exact meals where
 *   min===max), matching /demo's MacroBar. The color comes from an
 *   explicitly-passed `state` (authoritative) or, absent that, from where
 *   `currentMax` falls relative to the target band. Color and geometry never
 *   contradict: the passed `state` stays authoritative for color.
 * - POINT-DERIVED: pass `current` + `rangeMin` + `rangeMax` and the bar computes
 *   the fill %, the band geometry, AND the state coherently from one source.
 * - EXPLICIT (escape hatch): pass `pct`/`state`/`bandStart`/`bandEnd` directly
 *   for callers that already have geometry. There are NO cosmetic band defaults
 *   (an omitted band renders none).
 *
 * An explicit `state` always wins over any derived state.
 */
export function MacroRangeBar({
  label,
  value,
  current,
  currentMin,
  currentMax,
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
    rangeMin != null &&
    rangeMax != null &&
    (current != null || currentMax != null)
      ? (() => {
          // Left-anchored progress fill 0 → consumed (prefer the upper bound of
          // a logged range). Exact meals (min===max) still render a visible bar.
          const consumed = currentMax ?? current!;
          const max = axisMax ?? Math.max(rangeMax * 1.25, consumed, 1);
          const derivedState: MacroRangeState =
            consumed < rangeMin ? "under" : consumed > rangeMax ? "over" : "in";
          return {
            fillPct: clampPct((consumed / max) * 100),
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
