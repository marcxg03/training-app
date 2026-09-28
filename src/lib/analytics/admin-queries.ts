// The reads behind the admin analytics board (T3-E).
//
// Everything here is owner-scoped and covers a bounded window — a dashboard
// that does an unbounded `select *` is fine with one user and a table scan on
// the day there are a hundred.
//
// The SHAPING lives in ./admin-dashboard.ts and is pure; this file only
// fetches and flattens to the event shapes that module expects. Keeping the
// two apart is what lets every metric be fixture-tested without a database.

import { createClient } from "@/lib/supabase/server";
import type {
  MealDay,
  PrEvent,
  SessionEvent,
  SetEvent,
} from "@/lib/analytics/admin-dashboard";
import { addDays } from "@/lib/analytics/admin-dashboard";

export type AdminAnalyticsData = {
  sessions: SessionEvent[];
  sets: SetEvent[];
  prs: PrEvent[];
  meals: MealDay[];
  /** Sessions the active plan prescribes per week — the adherence denominator. */
  prescribedPerWeek: number;
  /** True when the account has no logged history at all. */
  isEmpty: boolean;
};

/** A timestamptz reduced to the calendar day it belongs to. */
function dayOf(timestamp: string): string {
  return timestamp.slice(0, 10);
}

export async function getAdminAnalytics(
  ownerId: string,
  today: string,
  windowWeeks = 12,
): Promise<AdminAnalyticsData> {
  const supabase = await createClient();
  // One extra week of slack so the oldest bucket is complete rather than
  // clipped mid-week.
  const from = addDays(today, -(windowWeeks + 1) * 7);
  const fromTs = `${from}T00:00:00Z`;

  const [sessionsRes, setsRes, prsRes, mealsRes, scheduleRes] =
    await Promise.all([
      // Completions are one of the two inputs to "did I train on this day" —
      // see the union below. `completed_at` is nullable because a session can
      // be started and abandoned.
      supabase
        .from("session_completions")
        .select("completed_at")
        .eq("user_id", ownerId)
        .not("completed_at", "is", null)
        .gte("completed_at", fromTs),

      supabase
        .from("set_logs")
        .select("weight_kg, reps, logged_at, exercises!inner(muscle_groups)")
        .eq("user_id", ownerId)
        .gte("logged_at", fromTs),

      supabase
        .from("pr_history")
        .select("achieved_at")
        .eq("user_id", ownerId)
        .gte("achieved_at", fromTs),

      supabase
        .from("meal_entries")
        .select("date")
        .eq("user_id", ownerId)
        .gte("date", from),

      // The adherence denominator: how many sessions the ACTIVE plan puts on
      // the week. Rest days contribute nothing.
      supabase
        .from("training_plans")
        .select("plan_id, daily_schedules(is_rest_day, workouts(workout_id))")
        .eq("user_id", ownerId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  // A SESSION IS "A DAY YOU TRAINED", not "a row with completed_at".
  //
  // Reading only `session_completions.completed_at` produced a board that
  // contradicted itself the first time it was rendered: 0 sessions per week
  // sitting next to 27 PRs and a full volume chart. The cause is mundane and
  // permanent — you can log every set of a workout and never tap "End", and
  // then the work happened but the completion row did not. Counting only
  // completions makes the consistency and adherence numbers quietly wrong in
  // exactly the situation they exist to measure.
  //
  // So: completed sessions, UNIONED with days that carry logged sets. A day is
  // counted once however it qualifies, which is why this is a Set of dates —
  // a day with both a completion and sets is one training day, not two.
  const trainingDays = new Set<string>();

  for (const row of sessionsRes.data ?? []) {
    if (row.completed_at) {
      trainingDays.add(dayOf(row.completed_at));
    }
  }
  for (const row of setsRes.data ?? []) {
    if (row.logged_at) {
      trainingDays.add(dayOf(row.logged_at as string));
    }
  }

  const sessions: SessionEvent[] = [...trainingDays].map((date) => ({ date }));

  const sets: SetEvent[] = (setsRes.data ?? []).map((row) => {
    // PostgREST types an embedded to-one relation as an array in some shapes.
    const exercise = Array.isArray(row.exercises)
      ? row.exercises[0]
      : row.exercises;

    return {
      date: dayOf(row.logged_at as string),
      // A bodyweight set has a null weight. Its volume is 0 for this chart,
      // which is honest — the chart's unit is kg, and pretending a bodyweight
      // set moved some invented load would make the series a lie. Bodyweight
      // work still shows up in session count, adherence and coverage.
      volumeKg: Number(row.weight_kg ?? 0) * Number(row.reps ?? 0),
      muscleGroups: (exercise?.muscle_groups as string[] | null) ?? [],
    };
  });

  const prs: PrEvent[] = (prsRes.data ?? []).map((row) => ({
    date: dayOf(row.achieved_at as string),
  }));

  const meals: MealDay[] = (mealsRes.data ?? []).map((row) => ({
    date: row.date as string,
  }));

  const schedules = scheduleRes.data?.daily_schedules ?? [];
  const prescribedPerWeek = schedules.reduce(
    (total, schedule) =>
      total + (schedule.is_rest_day ? 0 : (schedule.workouts?.length ?? 0)),
    0,
  );

  return {
    sessions,
    sets,
    prs,
    meals,
    prescribedPerWeek,
    isEmpty:
      sessions.length === 0 &&
      sets.length === 0 &&
      prs.length === 0 &&
      meals.length === 0,
  };
}
