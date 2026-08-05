// Pure view-model builders for the Trends analytics page. No React, no
// Supabase — same contract as history/projections.ts so the math is testable
// in isolation (scripts/verify-analytics.ts drives these with fixtures).

import {
  dateStringInTz,
  dayKeyDaysAgo,
  DEFAULT_APP_TIMEZONE,
} from "@/lib/time/appDay";

// Day bucketing is done in the APP timezone, explicitly. logged_at is a UTC
// timestamptz; slicing it (or relying on server-local time — Vercel runs
// UTC) would put any evening set on tomorrow's chart day. The tz is a
// per-profile setting (lib/time/server.getAppTimezone) threaded through the
// builders; the default keeps fixtures deterministic.
export { DEFAULT_APP_TIMEZONE, dayKeyDaysAgo };

// Labels are a property of the CALENDAR DATE itself, so they format in UTC
// on the noon-anchored instant — correct for any app timezone.
const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

// Local-day key (YYYY-MM-DD) for a UTC timestamp — the analytics analog of
// nutrition's getTodayDateString() en-CA convention.
// timeZone is REQUIRED on every day-bucketing entry point: an optional
// Chicago default would silently recreate the wrong-day bug class for any
// forgotten call site (unobservable while the profile tz IS Chicago).
export function dayKeyOf(loggedAtIso: string, timeZone: string): string {
  return dateStringInTz(timeZone, new Date(loggedAtIso));
}

export function dayLabelOf(dayKey: string): string {
  return dayLabelFormatter
    .format(new Date(`${dayKey}T12:00:00Z`))
    .toUpperCase();
}

// A single point on a line/sparkline chart. `dayKey` follows the local-day
// convention above. `value` unit depends on the series (kg for load series,
// reps for bodyweight series) — display conversion happens once, at the
// chart boundary (see toLbsChartPoints in lib/units).
export type TrendPoint = {
  dayKey: string;
  label: string;
  value: number;
};

// A point with an uncertainty band (nutrition ranges: min ≠ max when the
// entry came from the AI estimator).
export type BandPoint = {
  dayKey: string;
  label: string;
  min: number;
  max: number;
};

// One weekly bucket of training volume for a muscle group.
export type WeeklyVolumePoint = {
  weekKey: string; // Monday of the week, YYYY-MM-DD, APP_TIMEZONE
  label: string;
  sets: number;
  tonnageKg: number;
};

// Epley estimated 1RM. Accuracy degrades past ~12 reps, so the rep term is
// capped there — a 20-rep set shouldn't claim a higher e1RM than a hard 12.
export const E1RM_REP_CAP = 12;

export function epleyE1rmKg(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) {
    return 0;
  }

  const effectiveReps = Math.min(reps, E1RM_REP_CAP);

  return weightKg * (1 + effectiveReps / 30);
}

export type E1rmSetInput = {
  logged_at: string;
  weight_kg: number | null;
  reps: number;
};

// Best e1RM per calendar day, chronological. Sets without a real external
// load (bodyweight logs store 0/null) are skipped — Epley needs a weight.
export function buildBestE1rmByDay(
  sets: E1rmSetInput[],
  timeZone: string,
): TrendPoint[] {
  const bestByDay = new Map<string, number>();

  for (const set of sets) {
    if (set.weight_kg === null || set.weight_kg <= 0) {
      continue;
    }

    const e1rm = epleyE1rmKg(set.weight_kg, set.reps);
    const key = dayKeyOf(set.logged_at, timeZone);
    const existing = bestByDay.get(key) ?? 0;

    if (e1rm > existing) {
      bestByDay.set(key, e1rm);
    }
  }

  return [...bestByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, value]) => ({
      dayKey,
      label: dayLabelOf(dayKey),
      value,
    }));
}

// Best reps-per-day for bodyweight exercises (their progression axis is reps,
// not load).
export function buildBestRepsByDay(
  sets: E1rmSetInput[],
  timeZone: string,
): TrendPoint[] {
  const bestByDay = new Map<string, number>();

  for (const set of sets) {
    if (set.reps <= 0) {
      continue;
    }

    const key = dayKeyOf(set.logged_at, timeZone);
    const existing = bestByDay.get(key) ?? 0;

    if (set.reps > existing) {
      bestByDay.set(key, set.reps);
    }
  }

  return [...bestByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, value]) => ({
      dayKey,
      label: dayLabelOf(dayKey),
      value,
    }));
}

// --- e1RM spotlights (Trends page) ------------------------------------------

// Raw row shape shared with queries.ts — exercises embedded via the
// many-to-one FK, so PostgREST returns a single object (or null when RLS
// hides the exercise).
export type AnalyticsSetRow = {
  exercise_id: string;
  weight_kg: number | null;
  reps: number;
  logged_at: string;
  exercises: {
    name: string;
    is_bodyweight: boolean;
    is_compound: boolean;
    muscle_groups: string[];
  } | null;
};

export type E1rmSpotlight = {
  exercise_id: string;
  exercise_name: string;
  points: TrendPoint[]; // best e1RM per day, kg, chronological
};

// Top COMPOUND lifts by set count since rankCutoffKey (a local dayKey),
// each with its best-e1RM-per-day series over the full window. Bodyweight
// and isolation (non-compound) exercises are excluded — e1RM is a compound-
// lift stat; the flag is editable per exercise in the Library. Rank ties
// break by
// exercise name for determinism; exercises whose window yields no chartable
// points are dropped BEFORE the limit is applied so they can't burn a slot.
export function buildE1rmSpotlights(
  rows: AnalyticsSetRow[],
  options: {
    rankCutoffKey: string;
    windowStartKey: string;
    limit: number;
    timeZone: string;
  },
): E1rmSpotlight[] {
  const timeZone = options.timeZone;
  const byExercise = new Map<
    string,
    { name: string; recentSetCount: number; sets: AnalyticsSetRow[] }
  >();

  for (const row of rows) {
    if (
      !row.exercises ||
      row.exercises.is_bodyweight ||
      !row.exercises.is_compound
    ) {
      continue;
    }

    if (row.weight_kg === null || row.weight_kg <= 0) {
      continue;
    }

    const dayKey = dayKeyOf(row.logged_at, timeZone);

    if (dayKey < options.windowStartKey) {
      continue;
    }

    let entry = byExercise.get(row.exercise_id);

    if (!entry) {
      entry = { name: row.exercises.name, recentSetCount: 0, sets: [] };
      byExercise.set(row.exercise_id, entry);
    }

    entry.sets.push(row);

    if (dayKey >= options.rankCutoffKey) {
      entry.recentSetCount += 1;
    }
  }

  return [...byExercise.entries()]
    .map(([exerciseId, entry]) => ({
      exercise_id: exerciseId,
      exercise_name: entry.name,
      recentSetCount: entry.recentSetCount,
      points: buildBestE1rmByDay(entry.sets, timeZone),
    }))
    .filter((spotlight) => spotlight.points.length > 0)
    .sort(
      (a, b) =>
        b.recentSetCount - a.recentSetCount ||
        a.exercise_name.localeCompare(b.exercise_name),
    )
    .slice(0, options.limit)
    .map(({ exercise_id, exercise_name, points }) => ({
      exercise_id,
      exercise_name,
      points,
    }));
}

// --- weekly volume by muscle group (Trends page) -----------------------------

// Monday of the week containing dayKey. Pure string/date math on the
// already-local dayKey, so no further timezone handling is needed.
export function weekKeyOf(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00Z`);
  const weekday = date.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (weekday + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export function weekLabelOf(weekKey: string): string {
  return dayLabelOf(weekKey);
}

export type MuscleGroupVolume = {
  muscle_group: string;
  weeks: WeeklyVolumePoint[]; // one entry per week in range, zero-filled
  currentWeekSets: number;
  totalTonnageKg: number; // across the whole range
};

// Sets/week + tonnage per muscle group over the trailing `weeks` full weeks
// (including the current, possibly partial, week). Rules:
// - A set counts toward EVERY muscle group its exercise is tagged with
//   (standard volume-tracking practice; deliberate double-count).
// - Bodyweight sets count toward SETS (they are training volume) but add 0
//   tonnage (no external load).
// - Exercises with no muscle_groups bucket under "other" so their volume
//   isn't silently dropped.
// - Weeks with no training render as explicit zeros, never interpolated.
export function buildWeeklyVolumeByGroup(
  rows: AnalyticsSetRow[],
  options: { weeks: number; timeZone: string; now?: Date },
): MuscleGroupVolume[] {
  const timeZone = options.timeZone;
  const currentWeekKey = weekKeyOf(dayKeyDaysAgo(0, timeZone, options.now));
  const weekKeys: string[] = [];

  for (let i = options.weeks - 1; i >= 0; i--) {
    const date = new Date(`${currentWeekKey}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - i * 7);
    weekKeys.push(date.toISOString().slice(0, 10));
  }

  const windowStartKey = weekKeys[0];
  const byGroup = new Map<
    string,
    Map<string, { sets: number; tonnageKg: number }>
  >();

  for (const row of rows) {
    if (!row.exercises || row.reps <= 0) {
      continue;
    }

    const weekKey = weekKeyOf(dayKeyOf(row.logged_at, timeZone));

    if (weekKey < windowStartKey || weekKey > currentWeekKey) {
      continue;
    }

    // Dedupe + normalize: tags are user/AI-editable text[] with no DB
    // constraint — ["chest","Chest"] must not double-count one set.
    const groups =
      row.exercises.muscle_groups.length > 0
        ? [
            ...new Set(
              row.exercises.muscle_groups.map((g) => g.trim().toLowerCase()),
            ),
          ]
        : ["other"];
    const tonnage =
      row.weight_kg !== null && row.weight_kg > 0
        ? row.weight_kg * row.reps
        : 0;

    for (const group of groups) {
      let weekMap = byGroup.get(group);

      if (!weekMap) {
        weekMap = new Map();
        byGroup.set(group, weekMap);
      }

      const bucket = weekMap.get(weekKey) ?? { sets: 0, tonnageKg: 0 };
      bucket.sets += 1;
      bucket.tonnageKg += tonnage;
      weekMap.set(weekKey, bucket);
    }
  }

  return [...byGroup.entries()]
    .map(([group, weekMap]) => {
      const weeks: WeeklyVolumePoint[] = weekKeys.map((weekKey) => {
        const bucket = weekMap.get(weekKey);
        return {
          weekKey,
          label: weekLabelOf(weekKey),
          sets: bucket?.sets ?? 0,
          tonnageKg: bucket?.tonnageKg ?? 0,
        };
      });

      return {
        muscle_group: group,
        weeks,
        currentWeekSets: weeks[weeks.length - 1]?.sets ?? 0,
        totalTonnageKg: weeks.reduce((sum, week) => sum + week.tonnageKg, 0),
      };
    })
    .sort(
      (a, b) =>
        b.weeks.reduce((s, w) => s + w.sets, 0) -
          a.weeks.reduce((s, w) => s + w.sets, 0) ||
        a.muscle_group.localeCompare(b.muscle_group),
    );
}

// --- nutrition daily bands (Trends page) -------------------------------------

// Minimal meal shape the band builder needs — matches nutrition MealEntry
// rows plus their date key. Days are the STORED meal date (authored by the
// nutrition domain), never re-bucketed from logged_at.
export type NutritionMealInput = {
  date: string;
  cal_min: number;
  cal_max: number;
  protein_min_g: number;
  protein_max_g: number;
};

export type NutritionBandSeries = {
  calories: BandPoint[];
  protein: BandPoint[];
  // Midpoint averages across logged days, for the header stat.
  avgCaloriesMid: number | null;
  avgProteinMid: number | null;
};

// Per-day [min,max] sums for calories + protein, chronological. Days with no
// logged meals are omitted (not zero-filled): a missing day means "not
// logged", and charting it as zero intake would read as fasting. By the same
// logic, a partial day (today, mid-afternoon) must not drag the header
// AVERAGES down — pass `partialDayKey` to keep its band point (watching today
// build up is fine) while excluding it from the averages.
export function buildNutritionBands(
  meals: NutritionMealInput[],
  options: { partialDayKey?: string } = {},
): NutritionBandSeries {
  const byDay = new Map<
    string,
    { calMin: number; calMax: number; proMin: number; proMax: number }
  >();

  for (const meal of meals) {
    const bucket = byDay.get(meal.date) ?? {
      calMin: 0,
      calMax: 0,
      proMin: 0,
      proMax: 0,
    };
    bucket.calMin += meal.cal_min;
    bucket.calMax += meal.cal_max;
    bucket.proMin += meal.protein_min_g;
    bucket.proMax += meal.protein_max_g;
    byDay.set(meal.date, bucket);
  }

  const dayKeys = [...byDay.keys()].sort();
  const calories: BandPoint[] = [];
  const protein: BandPoint[] = [];
  let calMidSum = 0;
  let proMidSum = 0;
  let avgDays = 0;

  for (const dayKey of dayKeys) {
    const bucket = byDay.get(dayKey)!;
    const label = dayLabelOf(dayKey);
    calories.push({ dayKey, label, min: bucket.calMin, max: bucket.calMax });
    protein.push({ dayKey, label, min: bucket.proMin, max: bucket.proMax });

    if (dayKey !== options.partialDayKey) {
      calMidSum += (bucket.calMin + bucket.calMax) / 2;
      proMidSum += (bucket.proMin + bucket.proMax) / 2;
      avgDays += 1;
    }
  }

  return {
    calories,
    protein,
    avgCaloriesMid: avgDays > 0 ? Math.round(calMidSum / avgDays) : null,
    avgProteinMid: avgDays > 0 ? Math.round(proMidSum / avgDays) : null,
  };
}

// --- bodyweight trend (Trends page) ------------------------------------------

export type BodyweightLogInput = {
  log_date: string; // already a local day key, authored at log time
  weight_kg: number;
};

// One point per logged day, chronological. log_date is stored as the
// device-local day the user tapped Log — no re-bucketing.
export function buildBodyweightTrend(rows: BodyweightLogInput[]): TrendPoint[] {
  return rows
    .filter((row) => Number.isFinite(row.weight_kg) && row.weight_kg > 0)
    .slice()
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .map((row) => ({
      dayKey: row.log_date,
      label: dayLabelOf(row.log_date),
      value: row.weight_kg,
    }));
}
