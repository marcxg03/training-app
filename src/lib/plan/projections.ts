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
