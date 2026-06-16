import type { Enums } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";
import type { DayEditData, EditableWorkoutRow } from "@/lib/plan/projections";

type DayOfWeek = Enums<"day_of_week_enum">;

export async function getDayEditData(
  day: DayOfWeek,
): Promise<DayEditData | null> {
  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("plan_id")
    .eq("is_active", true)
    .maybeSingle();

  if (planError) {
    throw new Error(`Failed to load active plan: ${planError.message}`);
  }
  if (!plan) {
    return null;
  }

  const { data: schedule, error: scheduleError } = await supabase
    .from("daily_schedules")
    .select("schedule_id, is_rest_day")
    .eq("plan_id", plan.plan_id)
    .eq("day_of_week", day)
    .maybeSingle();

  if (scheduleError) {
    throw new Error(`Failed to load daily schedule: ${scheduleError.message}`);
  }
  if (!schedule) {
    return null;
  }

  const { data: workouts, error: workoutsError } = await supabase
    .from("workouts")
    .select(
      "workout_id, workout_name, workout_type, timing, gym, display_order",
    )
    .eq("schedule_id", schedule.schedule_id)
    .order("display_order");

  if (workoutsError) {
    throw new Error(`Failed to load workouts: ${workoutsError.message}`);
  }

  const workoutIds = (workouts ?? []).map((w) => w.workout_id);
  const historyIds = await getWorkoutsWithHistory(workoutIds);

  const { data: otherRest, error: otherRestError } = await supabase
    .from("daily_schedules")
    .select("schedule_id")
    .eq("plan_id", plan.plan_id)
    .neq("day_of_week", day)
    .eq("is_rest_day", true)
    .limit(1);

  if (otherRestError) {
    throw new Error(`Failed to load week rest days: ${otherRestError.message}`);
  }

  const editableWorkouts: EditableWorkoutRow[] = (workouts ?? []).map(
    (w, index) => ({
      workout_id: w.workout_id,
      workout_name: w.workout_name,
      workout_type: w.workout_type,
      timing: w.timing,
      gym: w.gym,
      display_order: index,
      has_history: historyIds.has(w.workout_id),
    }),
  );

  return {
    schedule_id: schedule.schedule_id,
    is_rest_day: schedule.is_rest_day,
    workouts: editableWorkouts,
    other_days_have_rest: (otherRest?.length ?? 0) > 0,
  };
}

/** Workout ids that have any logged set or completion (so removal is blocked). */
export async function getWorkoutsWithHistory(
  workoutIds: string[],
): Promise<Set<string>> {
  if (workoutIds.length === 0) {
    return new Set();
  }
  const supabase = await createClient();
  const ids = new Set<string>();

  const [
    { data: sets, error: setsError },
    { data: completions, error: compError },
    { data: activities, error: activityError },
  ] = await Promise.all([
    supabase.from("set_logs").select("workout_id").in("workout_id", workoutIds),
    supabase
      .from("workout_completions")
      .select("workout_id")
      .in("workout_id", workoutIds),
    supabase
      .from("activity_completions")
      .select("workout_id")
      .in("workout_id", workoutIds),
  ]);

  if (setsError) {
    throw new Error(`Failed to load set history: ${setsError.message}`);
  }
  if (compError) {
    throw new Error(`Failed to load completion history: ${compError.message}`);
  }
  if (activityError) {
    throw new Error(
      `Failed to load activity history: ${activityError.message}`,
    );
  }

  for (const row of activities ?? []) {
    ids.add(row.workout_id);
  }
  for (const row of sets ?? []) {
    ids.add(row.workout_id);
  }
  for (const row of completions ?? []) {
    ids.add(row.workout_id);
  }
  return ids;
}
