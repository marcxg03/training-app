import type { Enums } from "@/lib/supabase/types";

export type EditableWorkoutRow = {
  workout_id: string | null;
  workout_name: string;
  workout_type: Enums<"session_type_enum">;
  timing: Enums<"timing_enum">;
  gym: string | null;
  display_order: number;
  has_history: boolean;
};

export type DayEditData = {
  schedule_id: string;
  is_rest_day: boolean;
  workouts: EditableWorkoutRow[];
  other_days_have_rest: boolean;
};

// --- Plan editor (Slice 17): assign reusable workouts to days ---------------

export type PlanEditWorkout = {
  workout_id: string;
  /** Set when this workout came from the catalog; null for ad-hoc sessions. */
  workout_def_id: string | null;
  name: string;
  has_history: boolean;
};

export type PlanEditDay = {
  schedule_id: string;
  day_of_week: Enums<"day_of_week_enum">;
  is_rest_day: boolean;
  workouts: PlanEditWorkout[];
};

export type WorkoutDefOption = {
  workout_def_id: string;
  name: string;
};

export type PlanEditData = {
  plan_id: string;
  plan_name: string;
  days: PlanEditDay[];
  catalog: WorkoutDefOption[];
};
