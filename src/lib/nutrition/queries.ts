import { getTodayDayOfWeek } from "@/lib/methodology/today";
import type { GoalMode, NutritionDayType } from "@/lib/methodology/nutrition";
import { createClient } from "@/lib/supabase/server";
import type { MealEntry, NutritionTargets } from "@/lib/nutrition/projections";

/** Today's local date as YYYY-MM-DD (en-CA formats to ISO date, server tz). */
export function getTodayDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA");
}

export async function getNutritionTargets(): Promise<NutritionTargets | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nutrition_targets")
    .select(
      "cal_min, cal_max, protein_min_g, protein_max_g, carbs_min_g, carbs_max_g, fat_min_g, fat_max_g",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load nutrition targets: ${error.message}`);
  }

  return data;
}

export async function getGoalMode(): Promise<GoalMode> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("goal_mode")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load goal mode: ${error.message}`);
  }

  return data?.goal_mode ?? "maintain";
}

export async function getMealsForDate(date: string): Promise<MealEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_entries")
    .select(
      "meal_id, meal_type, protein_g, carbs_g, fat_g, calories, note, logged_at",
    )
    .eq("date", date)
    .order("logged_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load meals: ${error.message}`);
  }

  return data ?? [];
}

/** Derives today's nutrition day type from the active plan's schedule. */
export async function getTodayDayType(): Promise<NutritionDayType> {
  const supabase = await createClient();
  const dayOfWeek = getTodayDayOfWeek();

  const { data: schedule, error: scheduleError } = await supabase
    .from("daily_schedules")
    .select("schedule_id, is_rest_day, training_plans!inner(is_active)")
    .eq("day_of_week", dayOfWeek)
    .eq("training_plans.is_active", true)
    .maybeSingle();

  if (scheduleError) {
    throw new Error(
      `Failed to load today's schedule: ${scheduleError.message}`,
    );
  }

  if (!schedule || schedule.is_rest_day) {
    return "rest";
  }

  const { data: workouts, error: workoutsError } = await supabase
    .from("workouts")
    .select("workout_type")
    .eq("schedule_id", schedule.schedule_id);

  if (workoutsError) {
    throw new Error(
      `Failed to load today's workouts: ${workoutsError.message}`,
    );
  }

  if (!workouts || workouts.length === 0) {
    return "rest";
  }

  if (workouts.some((workout) => workout.workout_type === "lifting")) {
    return "lifting";
  }

  if (workouts.some((workout) => workout.workout_type === "cardio")) {
    return "cardio";
  }

  // Recovery-only days (mobility / stretch) are nutritionally closer to a rest
  // day than a cardio day, so they fall through to "rest".
  return "rest";
}
