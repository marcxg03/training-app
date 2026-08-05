import type { Enums } from "@/lib/supabase/types";

/** One entry in a session's content list — a row of `workout_blocks`.
 *
 * Lifting sessions carry an ordered list of lifting blocks. Cardio and recovery
 * sessions carry a single category block whose `preset_activity_id` names the
 * actual activity (Long Run, Sauna, …); that is the shape the seed writes and
 * the shape `/plan/[day]` renders, so the editor matches it rather than
 * inventing a second convention. */
export type EditableBlockRow = {
  block_id: string;
  block_name: string;
  /** Only ever set on a cardio/recovery session's block. */
  preset_activity_id: string | null;
};

export type EditableWorkoutRow = {
  workout_id: string | null;
  /** Set when this session was assigned from the workout catalog. Its blocks
   * are owned by that definition and re-materialized by the weekly plan editor,
   * so the per-day editor shows them read-only rather than letting an edit be
   * silently overwritten. */
  workout_def_id: string | null;
  workout_name: string;
  workout_type: Enums<"session_type_enum">;
  timing: Enums<"timing_enum">;
  gym: string | null;
  display_order: number;
  has_history: boolean;
  blocks: EditableBlockRow[];
};

/** A block the user can attach, from their Library. */
export type BlockOption = {
  block_id: string;
  block_name: string;
  block_category: Enums<"block_category_enum">;
};

/** A cardio/recovery preset the user can attach to a session. */
export type ActivityOption = {
  activity_id: string;
  name: string;
};

export type DayEditData = {
  schedule_id: string;
  is_rest_day: boolean;
  workouts: EditableWorkoutRow[];
  other_days_have_rest: boolean;
  /** Library blocks, split by category — the "Add block" picker's source. */
  block_catalog: BlockOption[];
  cardio_activities: ActivityOption[];
  recovery_activities: ActivityOption[];
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
