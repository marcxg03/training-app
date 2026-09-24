// Pure view-model builder for the per-exercise PR graphs (T2-B, reshaped in
// T2-D). No React, no Supabase — same contract as projections.ts, so
// scripts/verify-pr-history-chart.ts can drive it with fixtures.
//
// WHY THIS EXISTS: estimated 1RM was deleted (Marcus, 2026-09-23) because it
// is a derived guess dressed up as a measurement. This charts only events that
// actually happened — rows of the append-only `pr_history` table.
//
// WHY TWO SERIES, TWO CHARTS (T2-D, Marcus 2026-09-24: "maybe we create two
// separate graphs … it is confusing looking at it on one graph and the scaling
// might be off"). The first version drew both series on ONE canvas with two
// independent y-axes — which is a lie of composition: two lines sharing a frame
// read as comparable when reps (single digits) and loads (hundreds) share
// nothing but a date. Now each series gets its OWN chart, its own y-axis, AND
// its own x (time) domain — every panel spans its own first→last PR and labels
// that range in its footer. One chart, one scale, one unit, nothing to
// mis-read. A whole class of machinery went with it: the shared x domain, the
// two-axis legend row, and the coincident-marker sizing (two marks can no
// longer land on one coordinate because they are no longer on one canvas).
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
  /** 0..1 along THIS series' own time domain (oldest = 0, newest = 1). */
  x: number;
  /** 0..1 within THIS series' own value axis (0 = axis min, 1 = axis max). */
  y: number;
};

export type PRChartAxis = {
  min: number;
  max: number;
};

/** One chart's worth of data: its points, its axis, its date range. Everything
 * a single-axis panel needs and nothing it shares with the other panel. */
export type PRChartSeries = {
  points: PRChartPoint[];
  /** Null when this exercise has no PR of this type — the panel draws its own
   * empty state rather than an axis with nothing on it. */
  axis: PRChartAxis | null;
  startLabel: string | null;
  endLabel: string | null;
  isEmpty: boolean;
};

export type PRChartModel = {
  weight: PRChartSeries;
  rep: PRChartSeries;
  /** True only when BOTH series are empty. */
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

const EMPTY_SERIES: PRChartSeries = {
  points: [],
  axis: null,
  startLabel: null,
  endLabel: null,
  isEmpty: true,
};

/**
 * Shape ONE pr_type's rows into a single-axis series: chronological, scaled
 * against its own value axis and its own time span.
 *
 * `rows` must already be filtered to one pr_type and sorted chronologically.
 */
function buildSeries(
  rows: PRHistoryRow[],
  valueOf: (row: PRHistoryRow) => number,
  timeZone: string,
): PRChartSeries {
  if (rows.length === 0) {
    return EMPTY_SERIES;
  }

  const values = rows.map(valueOf);
  const axis = buildAxis(values);

  if (axis === null) {
    return EMPTY_SERIES;
  }

  const times = rows.map((row) => new Date(row.achieved_at).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = maxTime - minTime;

  const points = rows.map((row, index): PRChartPoint => {
    const dayKey = dayKeyOf(row.achieved_at, timeZone);

    return {
      pr_id: row.pr_id,
      achieved_at: row.achieved_at,
      dayKey,
      label: dayLabelOf(dayKey),
      weightLbs: toDisplayLbs(row.weight_kg),
      reps: Math.max(0, Math.round(finiteOrZero(row.reps))),
      value: values[index],
      // A single PR (or several at one instant) has no time span to spread
      // across — center it rather than dividing by zero.
      x: timeSpan > 0 ? (times[index] - minTime) / timeSpan : 0.5,
      y: ratioWithin(values[index], axis),
    };
  });

  return {
    points,
    axis,
    startLabel: points[0].label,
    endLabel: points[points.length - 1].label,
    isEmpty: false,
  };
}

/**
 * Shape one exercise's `pr_history` rows into the two INDEPENDENT series
 * PRHistoryChart draws as two stacked panels. Input order does not matter —
 * the query that feeds the detail page returns PRs newest-first, and drawing
 * that raw would run the history backwards.
 */
export function buildPRChartModel(
  rows: PRHistoryRow[],
  timeZone: string,
): PRChartModel {
  const ordered = [...rows].sort(compareChronological);

  const weight = buildSeries(
    ordered.filter((row) => row.pr_type === "weight"),
    (row) => toDisplayLbs(row.weight_kg),
    timeZone,
  );
  const rep = buildSeries(
    ordered.filter((row) => row.pr_type === "in_range_rep"),
    (row) => Math.max(0, Math.round(finiteOrZero(row.reps))),
    timeZone,
  );

  return {
    weight,
    rep,
    isEmpty: weight.isEmpty && rep.isEmpty,
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
