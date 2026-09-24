// Pure view-model builder for the per-exercise PR graph (T2-B). No React, no
// Supabase — same contract as projections.ts, so scripts/verify-pr-history-
// chart.ts can drive it with fixtures.
//
// WHY THIS EXISTS: estimated 1RM was deleted (Marcus, 2026-09-23) because it
// is a derived guess dressed up as a measurement. This charts only events that
// actually happened — rows of the append-only `pr_history` table — as two
// series over time:
//
//   weight PRs      -> LEFT axis, lbs   (pr_type 'weight')
//   in-range rep PRs -> RIGHT axis, reps (pr_type 'in_range_rep')
//
// The two axes scale INDEPENDENTLY on purpose. Reps live in single digits and
// loads in the hundreds; one shared domain would press every rep PR flat onto
// the floor of the chart and the second series would be decorative.
//
// Display units are resolved HERE, at the boundary between stored data and the
// chart: weight_kg is the storage unit (wiring contract) and lbs is the only
// unit that reaches the screen, so the axis domain and the plotted points are
// rounded together and can never disagree by a rounding step.

import { dayKeyOf, dayLabelOf } from "@/lib/analytics/projections";
import { kgToLbs } from "@/lib/units";

/** The pr_history fields the chart needs. Structurally satisfied by both
 * ExerciseProgressionPR (detail page) and PRTimelineRow (progress page), so
 * neither call site needs a new query. */
export type PRHistoryRow = {
  pr_id: string;
  pr_type: "weight" | "in_range_rep";
  weight_kg: number;
  reps: number;
  achieved_at: string;
};

export type PRChartPoint = {
  pr_id: string;
  achieved_at: string;
  dayKey: string;
  /** Short calendar label, e.g. "JUL 1". */
  label: string;
  /** The load this PR was set at, in display units. */
  weightLbs: number;
  reps: number;
  /** What this series plots: lbs for the weight series, reps for the rep one. */
  value: number;
  /** 0..1 along the SHARED time axis — both series use one x domain so two
   * PRs earned by the same set line up vertically. */
  x: number;
  /** 0..1 within THIS series' OWN axis (0 = axis min, 1 = axis max). */
  y: number;
};

export type PRChartAxis = {
  min: number;
  max: number;
};

export type PRChartModel = {
  weight: PRChartPoint[];
  rep: PRChartPoint[];
  /** lbs. Null when the exercise has no weight PRs — draw no left axis. */
  weightAxis: PRChartAxis | null;
  /** reps. Null when the exercise has no rep PRs — draw no right axis. */
  repAxis: PRChartAxis | null;
  startLabel: string | null;
  endLabel: string | null;
  isEmpty: boolean;
};

/** Coerce a possibly-corrupt numeric to something an SVG path can consume. A
 * NaN in a path attribute fails SILENTLY in the browser — no draw, no error. */
function finiteOrZero(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function toDisplayLbs(weightKg: number): number {
  const kg = finiteOrZero(weightKg);

  return kg === 0 ? 0 : Math.round(kgToLbs(kg));
}

/** Axis domain for one series. A single point (or a flat series) would give a
 * zero-width domain and divide by zero, so it is padded by one unit and the
 * points center at y = 0.5. */
function buildAxis(values: number[]): PRChartAxis | null {
  if (values.length === 0) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }

  return { min, max };
}

function ratioWithin(value: number, axis: PRChartAxis): number {
  const span = axis.max - axis.min;

  if (span <= 0) {
    return 0.5;
  }

  return (value - axis.min) / span;
}

function compareChronological(left: PRHistoryRow, right: PRHistoryRow): number {
  const delta =
    new Date(left.achieved_at).getTime() -
    new Date(right.achieved_at).getTime();

  if (delta !== 0) {
    return delta;
  }

  // One set can earn BOTH a weight and a rep PR at the same instant; pr_id
  // keeps their order (and the seam between them) deterministic.
  return left.pr_id.localeCompare(right.pr_id);
}

const EMPTY_MODEL: PRChartModel = {
  weight: [],
  rep: [],
  weightAxis: null,
  repAxis: null,
  startLabel: null,
  endLabel: null,
  isEmpty: true,
};

/**
 * Shape one exercise's `pr_history` rows into the two-series, dual-axis model
 * PRHistoryChart draws. Input order does not matter — the query that feeds the
 * detail page returns PRs newest-first, and drawing that raw would run the
 * history backwards.
 */
export function buildPRChartModel(
  rows: PRHistoryRow[],
  timeZone: string,
): PRChartModel {
  if (rows.length === 0) {
    return EMPTY_MODEL;
  }

  const ordered = [...rows].sort(compareChronological);
  const times = ordered.map((row) => new Date(row.achieved_at).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = maxTime - minTime;

  const weightLbsValues: number[] = [];
  const repValues: number[] = [];

  const shaped = ordered.map((row, index) => {
    const weightLbs = toDisplayLbs(row.weight_kg);
    const reps = Math.max(0, Math.round(finiteOrZero(row.reps)));
    const dayKey = dayKeyOf(row.achieved_at, timeZone);

    if (row.pr_type === "weight") {
      weightLbsValues.push(weightLbs);
    } else {
      repValues.push(reps);
    }

    return {
      row,
      weightLbs,
      reps,
      dayKey,
      label: dayLabelOf(dayKey),
      // A single PR (or several at one instant) has no time span to spread
      // across — center it rather than dividing by zero.
      x: timeSpan > 0 ? (times[index] - minTime) / timeSpan : 0.5,
    };
  });

  const weightAxis = buildAxis(weightLbsValues);
  const repAxis = buildAxis(repValues);

  const weight: PRChartPoint[] = [];
  const rep: PRChartPoint[] = [];

  for (const point of shaped) {
    const isWeight = point.row.pr_type === "weight";
    const axis = isWeight ? weightAxis : repAxis;

    if (axis === null) {
      continue;
    }

    const value = isWeight ? point.weightLbs : point.reps;
    const chartPoint: PRChartPoint = {
      pr_id: point.row.pr_id,
      achieved_at: point.row.achieved_at,
      dayKey: point.dayKey,
      label: point.label,
      weightLbs: point.weightLbs,
      reps: point.reps,
      value,
      x: point.x,
      y: ratioWithin(value, axis),
    };

    (isWeight ? weight : rep).push(chartPoint);
  }

  return {
    weight,
    rep,
    weightAxis,
    repAxis,
    startLabel: shaped[0]?.label ?? null,
    endLabel: shaped[shaped.length - 1]?.label ?? null,
    isEmpty: weight.length === 0 && rep.length === 0,
  };
}

/** A PR row that still knows which exercise it belongs to — the shape the
 * Progress page's already-fetched PR timeline hands over. */
export type PRSpotlightRow = PRHistoryRow & {
  exercise_id: string;
  exercise_name: string;
};

export type PRSpotlight = {
  exercise_id: string;
  exercise_name: string;
  pr_count: number;
  model: PRChartModel;
};

/**
 * The exercises worth featuring on Progress, ranked by how many PRs they have
 * in the fetched window (most-moving lifts first), name-ascending on ties for
 * determinism. Exercises whose rows yield no chartable point are dropped
 * BEFORE the limit so they cannot burn a slot.
 *
 * No new query: this consumes the PR timeline the page already loads.
 */
export function buildPRSpotlights(
  rows: PRSpotlightRow[],
  options: { limit: number; timeZone: string },
): PRSpotlight[] {
  const byExercise = new Map<
    string,
    { name: string; rows: PRSpotlightRow[] }
  >();

  for (const row of rows) {
    const entry = byExercise.get(row.exercise_id);

    if (entry) {
      entry.rows.push(row);
    } else {
      byExercise.set(row.exercise_id, {
        name: row.exercise_name,
        rows: [row],
      });
    }
  }

  return [...byExercise.entries()]
    .map(([exerciseId, entry]) => ({
      exercise_id: exerciseId,
      exercise_name: entry.name,
      pr_count: entry.rows.length,
      model: buildPRChartModel(entry.rows, options.timeZone),
    }))
    .filter((spotlight) => !spotlight.model.isEmpty)
    .sort(
      (a, b) =>
        b.pr_count - a.pr_count ||
        a.exercise_name.localeCompare(b.exercise_name),
    )
    .slice(0, options.limit);
}
