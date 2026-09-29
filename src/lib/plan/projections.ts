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

/**
 * ONE option in the week editor's session picker (T3-G).
 *
 * The picker used to offer `workout_defs` only, which meant cardio and
 * recovery could not be assigned from the week editor at all — they have no
 * definition, they are sessions carrying a preset activity. Marcus asked for
 * all three to be pickable the same way: "just add workout, recovery, or
 * cardio as a session that is predefined as a block."
 *
 * So the picker takes ONE list of options discriminated by `kind`, and the
 * row it creates carries whichever id that kind needs. A lifting option
 * materializes its definition's blocks; a cardio/recovery option attaches the
 * single category block carrying the chosen activity.
 */
export type SessionOption =
  | { kind: "workout"; id: string; name: string }
  | {
      kind: "cardio";
      id: string;
      name: string;
      /** NOT NULL on a cardio workout (DB CHECK) — carried from the activity. */
      cardio_format: Enums<"cardio_format_enum">;
    }
  | { kind: "recovery"; id: string; name: string };

export type PlanEditData = {
  plan_id: string;
  plan_name: string;
  days: PlanEditDay[];
  catalog: WorkoutDefOption[];
  /** Everything assignable to a day, in one list (T3-G). */
  sessionOptions: SessionOption[];
  /** The category block a cardio/recovery session hangs its activity on. */
  cardioBlockId: string | null;
  recoveryBlockId: string | null;
};
