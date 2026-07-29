// Server-side reads for the Trends page: thin fetch wrappers only. All
// shaping/ranking lives in projections.ts where fixtures can reach it.

import { createClient } from "@/lib/supabase/server";

import type { AnalyticsSetRow } from "@/lib/analytics/projections";

// PostgREST caps responses (max_rows = 1000); an unpaginated fetch would
// silently drop the NEWEST rows under ascending order. Page through the
// window explicitly.
const FETCH_PAGE_SIZE = 1000;
// Runaway guard: 20 pages = 20k rows, far beyond any realistic 92-day window
// for one user. If .range() is ever not honored, fail fast and loud instead
// of hammering the DB until the function times out.
const MAX_FETCH_PAGES = 20;

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// One shared window fetch for every set_logs-based analytics view (e1RM now,
// weekly volume next slice) — superset of columns, fetched once per render.
// Fetches one extra day so local-timezone day bucketing never loses the
// window's first day; the pure layer trims by dayKey.
export async function getSetLogWindow(
  sinceDays: number,
): Promise<AnalyticsSetRow[]> {
  const supabase = await createClient();
  // +2 days of pad: +1 for the local-vs-UTC day offset, +1 more so the
  // 25-hour DST fall-back day can't leave the window's first local hour
  // outside the fetch (confirmed edge: now-90d landing late on Nov 1).
  const since = isoDaysAgo(sinceDays + 2);
  const rows: AnalyticsSetRow[] = [];

  for (let page = 0; ; page++) {
    if (page >= MAX_FETCH_PAGES) {
      throw new Error(
        "set_logs pagination exceeded MAX_FETCH_PAGES — aborting instead of looping",
      );
    }

    const { data, error } = await supabase
      .from("set_logs")
      .select(
        "exercise_id, weight_kg, reps, logged_at, exercises(name, is_bodyweight, muscle_groups)",
      )
      .gte("logged_at", since)
      // set_log_id tiebreaker: equal logged_at values have no stable order
      // across the separate per-page queries, so pages could dup/drop rows
      // at the seam without it.
      .order("logged_at", { ascending: true })
      .order("set_log_id", { ascending: true })
      .range(page * FETCH_PAGE_SIZE, (page + 1) * FETCH_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Failed to load set logs for analytics: ${error.message}`,
      );
    }

    const batch = (data ?? []) as unknown as AnalyticsSetRow[];
    rows.push(...batch);

    if (batch.length < FETCH_PAGE_SIZE) {
      return rows;
    }
  }
}

