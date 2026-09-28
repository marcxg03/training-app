// Shaping for the admin hub's analytics board (T3-E).
//
// PURE. No React, no Supabase, no `new Date()` without an argument — every
// function takes the reference day explicitly so a fixture can pin "today" and
// the output is identical on every machine and at every hour. A dashboard that
// computes a different streak depending on when the test runs is a dashboard
// nobody trusts.
//
// SCOPE (D41): these are the metrics that are TRUE AT n=1. The analytics spec
// (spec/ADMIN_HUB_ANALYTICS.md) also names MRR, free→paid conversion, churn
// and a subscriber×adherence leaderboard — all four read a `subscriptions`
// table that does not exist in this schema, and with one user they would
// render a confident 0 that means nothing. They stay out until there are
// subscribers to count.
//
// What IS here answers the only question worth asking about a training app
// with one user: am I actually training, and is it going anywhere.

export type IsoDate = string; // YYYY-MM-DD

/** A completed session, reduced to what the dashboard needs. */
export type SessionEvent = { date: IsoDate };
/** One logged set. `volumeKg` is weight × reps, already computed. */
export type SetEvent = { date: IsoDate; volumeKg: number; muscleGroups: string[] }; // prettier-ignore
export type PrEvent = { date: IsoDate };
export type MealDay = { date: IsoDate };

// --- date helpers (UTC-free: these are calendar strings, not instants) ---

/** Parse YYYY-MM-DD into a UTC-noon Date — noon so a timezone shift of up to
 * 11 hours in either direction can never move the calendar day. */
function parseDay(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12));
}

function toIso(value: Date): IsoDate {
  return value.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const next = parseDay(date);
  next.setUTCDate(next.getUTCDate() + days);
  return toIso(next);
}

/** Whole days between two calendar dates (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000); // prettier-ignore
}

/**
 * The Monday on or before `date`.
 *
 * Weeks start Monday because a training week does — a Sunday-start week splits
 * every weekend off the block it belongs to, and Marcus's plan puts recovery
 * on Sunday.
 */
export function weekStart(date: IsoDate): IsoDate {
  const d = parseDay(date);
  // getUTCDay: 0 = Sunday. Monday-index it so Monday → 0 and Sunday → 6.
  const mondayIndex = (d.getUTCDay() + 6) % 7;
  return addDays(date, -mondayIndex);
}

/** The last `count` week-start dates, oldest first, ending with `today`'s. */
export function recentWeeks(today: IsoDate, count: number): IsoDate[] {
  const current = weekStart(today);
  return Array.from({ length: count }, (_, i) =>
    addDays(current, -7 * (count - 1 - i)),
  );
}

/** "Sep 8" — the x-axis label for a week bucket. */
export function weekLabel(weekStartDate: IsoDate): string {
  const d = parseDay(weekStartDate);
  return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}`; // prettier-ignore
}

// --- the metrics ---------------------------------------------------------

export type WeekPoint = { label: string; value: number; weekStart: IsoDate };

/** Sessions completed per week, over the last `weeks` weeks. */
export function sessionsPerWeek(
  sessions: SessionEvent[],
  today: IsoDate,
  weeks = 12,
): WeekPoint[] {
  const buckets = new Map<IsoDate, number>();

  for (const session of sessions) {
    const bucket = weekStart(session.date);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  return recentWeeks(today, weeks).map((week) => ({
    weekStart: week,
    label: weekLabel(week),
    value: buckets.get(week) ?? 0,
  }));
}

/** Total volume (kg) per week. */
export function volumePerWeek(
  sets: SetEvent[],
  today: IsoDate,
  weeks = 12,
): WeekPoint[] {
  const buckets = new Map<IsoDate, number>();

  for (const set of sets) {
    const bucket = weekStart(set.date);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + set.volumeKg);
  }

  return recentWeeks(today, weeks).map((week) => ({
    weekStart: week,
    label: weekLabel(week),
    // Rounded at the boundary, not in the renderer — a chart should never be
    // the thing that decides precision.
    value: Math.round(buckets.get(week) ?? 0),
  }));
}

/** PRs achieved per week. */
export function prsPerWeek(
  prs: PrEvent[],
  today: IsoDate,
  weeks = 12,
): WeekPoint[] {
  const buckets = new Map<IsoDate, number>();

  for (const pr of prs) {
    const bucket = weekStart(pr.date);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  return recentWeeks(today, weeks).map((week) => ({
    weekStart: week,
    label: weekLabel(week),
    value: buckets.get(week) ?? 0,
  }));
}

/**
 * Adherence: completed sessions ÷ prescribed sessions, per week, as a
 * percentage.
 *
 * Capped at 100. Training MORE than prescribed is a real thing and it is good,
 * but letting the series run to 140% makes every ordinary week look like a
 * failure by comparison and breaks the 0–100 reading the axis promises. The
 * overflow is surfaced as `extra` instead of distorting the bar.
 */
export type AdherencePoint = WeekPoint & { completed: number; prescribed: number; extra: number }; // prettier-ignore

export function adherencePerWeek(
  sessions: SessionEvent[],
  prescribedPerWeek: number,
  today: IsoDate,
  weeks = 12,
): AdherencePoint[] {
  return sessionsPerWeek(sessions, today, weeks).map((point) => {
    const completed = point.value;
    const pct =
      prescribedPerWeek > 0
        ? Math.round((completed / prescribedPerWeek) * 100)
        : 0;

    return {
      ...point,
      value: Math.min(pct, 100),
      completed,
      prescribed: prescribedPerWeek,
      extra: Math.max(completed - prescribedPerWeek, 0),
    };
  });
}

/**
 * Consecutive weeks, counting back from this week, with at least one session.
 *
 * THE CURRENT WEEK IS EXEMPT WHEN IT IS EMPTY. It is still in progress, so a
 * zero there means "not yet", not "missed" — counting it would reset the
 * streak to 0 every Monday morning, which is both wrong and demoralising. A
 * week that HAS a session counts immediately.
 */
export function weekStreak(sessions: SessionEvent[], today: IsoDate): number {
  const weeks = new Set(sessions.map((s) => weekStart(s.date)));
  let cursor = weekStart(today);
  let streak = 0;

  if (!weeks.has(cursor)) {
    cursor = addDays(cursor, -7); // this week is still open — look back
  }

  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }

  return streak;
}

/** Whole days since the most recent session, or null if there has never been
 * one. The dormancy signal — the single most useful early warning. */
export function daysSinceLastSession(
  sessions: SessionEvent[],
  today: IsoDate,
): number | null {
  if (sessions.length === 0) {
    return null;
  }

  const latest = sessions.reduce(
    (max, s) => (s.date > max ? s.date : max),
    sessions[0].date,
  );

  return Math.max(daysBetween(latest, today), 0);
}

/** Days in the last `window` with at least one meal logged, as a percentage. */
export function nutritionLoggingRate(
  meals: MealDay[],
  today: IsoDate,
  window = 30,
): { days: number; window: number; pct: number } {
  const from = addDays(today, -(window - 1));
  const days = new Set(
    meals.filter((m) => m.date >= from && m.date <= today).map((m) => m.date),
  ).size;

  return { days, window, pct: Math.round((days / window) * 100) };
}

/**
 * Sets per muscle group over a trailing window, ranked.
 *
 * A set trains every group its exercise names, so a set counts once per group
 * — this is "sets that touched this muscle", NOT a partition of total sets,
 * and the column is labelled that way. Summing these will exceed the set
 * count, and that is correct.
 */
export type MuscleGroupPoint = { label: string; value: number };

export function muscleGroupCoverage(
  sets: SetEvent[],
  today: IsoDate,
  window = 28,
): MuscleGroupPoint[] {
  const from = addDays(today, -(window - 1));
  const counts = new Map<string, number>();

  for (const set of sets) {
    if (set.date < from || set.date > today) {
      continue;
    }
    for (const group of set.muscleGroups) {
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Sum of a week series — the "last N weeks" totals under each chart. */
export function sumWeeks(points: WeekPoint[]): number {
  return points.reduce((total, point) => total + point.value, 0);
}
