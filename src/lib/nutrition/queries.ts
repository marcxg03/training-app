import { getAppDayOfWeek } from "@/lib/time/server";
import type { GoalMode, NutritionDayType } from "@/lib/methodology/nutrition";
import { createClient } from "@/lib/supabase/server";
import type { MealEntry, NutritionTargets } from "@/lib/nutrition/projections";

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
      "meal_id, meal_type, protein_min_g, protein_max_g, carbs_min_g, carbs_max_g, fat_min_g, fat_max_g, cal_min, cal_max, note, logged_at",
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
  const dayOfWeek = await getAppDayOfWeek();

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

export type MealEntryWithDate = MealEntry & { date: string };

/** All meals in [startDate, endDate] (inclusive, YYYY-MM-DD) for trends. */
export async function getMealsForDateRange(
  startDate: string,
  endDate: string,
): Promise<MealEntryWithDate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_entries")
    .select(
      "meal_id, meal_type, date, protein_min_g, protein_max_g, carbs_min_g, carbs_max_g, fat_min_g, fat_max_g, cal_min, cal_max, note, logged_at",
    )
    .gte("date", startDate)
    .lte("date", endDate)
    // Descending: if the 1000-row cap is ever hit (90-day windows now use
    // this), truncation must eat the OLDEST days, never the newest — callers
    // (buildNutritionBands, buildMealDaySummaries) sort for themselves.
    .order("date", { ascending: false })
    .order("logged_at", { ascending: true })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load meals for range: ${error.message}`);
  }

  return data ?? [];
}
