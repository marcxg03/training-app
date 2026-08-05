import type { Enums } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityOption,
  BlockOption,
  DayEditData,
  EditableBlockRow,
  EditableWorkoutRow,
  PlanEditData,
  PlanEditDay,
  PlanEditWorkout,
} from "@/lib/plan/projections";

type DayOfWeek = Enums<"day_of_week_enum">;

const DAY_ORDER: DayOfWeek[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

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
      "workout_id, workout_def_id, workout_name, workout_type, timing, gym, display_order",
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

  const blocksByWorkoutId = await getSessionBlocks(workoutIds);
  const [blockCatalog, cardioActivities, recoveryActivities] =
    await Promise.all([
      getBlockCatalog(),
      getActivityCatalog("cardio"),
      getActivityCatalog("recovery"),
    ]);

  const editableWorkouts: EditableWorkoutRow[] = (workouts ?? []).map(
    (w, index) => ({
      workout_id: w.workout_id,
      workout_def_id: w.workout_def_id,
      workout_name: w.workout_name,
      workout_type: w.workout_type,
      timing: w.timing,
      gym: w.gym,
      display_order: index,
      has_history: historyIds.has(w.workout_id),
      blocks: blocksByWorkoutId.get(w.workout_id) ?? [],
    }),
  );

  return {
    schedule_id: schedule.schedule_id,
    is_rest_day: schedule.is_rest_day,
    workouts: editableWorkouts,
    other_days_have_rest: (otherRest?.length ?? 0) > 0,
    block_catalog: blockCatalog,
    cardio_activities: cardioActivities,
    recovery_activities: recoveryActivities,
  };
}

/** Ordered `workout_blocks` membership for each of `workoutIds`, joined to the
 * block name. RLS scopes both tables to the owner. */
async function getSessionBlocks(
  workoutIds: string[],
): Promise<Map<string, EditableBlockRow[]>> {
  const byWorkoutId = new Map<string, EditableBlockRow[]>();

  if (workoutIds.length === 0) {
    return byWorkoutId;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_blocks")
    .select(
      "workout_id, block_id, display_order, preset_activity_id, blocks!inner (block_name)",
    )
    .in("workout_id", workoutIds)
    .order("display_order");

  if (error) {
    throw new Error(`Failed to load session blocks: ${error.message}`);
  }

  for (const row of data ?? []) {
    // PostgREST types an embedded to-one relation as an array in some shapes.
    const block = Array.isArray(row.blocks) ? row.blocks[0] : row.blocks;

    if (!block) {
      continue;
    }

    const list = byWorkoutId.get(row.workout_id) ?? [];
    list.push({
      block_id: row.block_id,
      block_name: block.block_name,
      preset_activity_id: row.preset_activity_id,
    });
    byWorkoutId.set(row.workout_id, list);
  }

  return byWorkoutId;
}

/** Every block in the user's Library, for the "Add block" picker. */
async function getBlockCatalog(): Promise<BlockOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocks")
    .select("block_id, block_name, block_category")
    .order("block_category")
    .order("block_name");

  if (error) {
    throw new Error(`Failed to load block catalog: ${error.message}`);
  }

  return data ?? [];
}

async function getActivityCatalog(
  kind: "cardio" | "recovery",
): Promise<ActivityOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(kind === "cardio" ? "cardio_activities" : "recovery_activities")
    .select("activity_id, name")
    .order("name");

  if (error) {
    throw new Error(`Failed to load ${kind} activities: ${error.message}`);
  }

  return data ?? [];
}

/** Loads a whole plan (all 7 days + their workouts + the workout catalog) for
 * the weekly plan editor. */
export async function getPlanEditData(
  planId: string,
): Promise<PlanEditData | null> {
  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("plan_id, name")
    .eq("plan_id", planId)
    .maybeSingle();

  if (planError) {
    throw new Error(`Failed to load plan: ${planError.message}`);
  }
  if (!plan) {
    return null;
  }

  const { data: schedules, error: schedError } = await supabase
    .from("daily_schedules")
    .select("schedule_id, day_of_week, is_rest_day")
    .eq("plan_id", planId);

  if (schedError) {
    throw new Error(`Failed to load schedules: ${schedError.message}`);
  }

  const scheduleIds = (schedules ?? []).map((s) => s.schedule_id);

  const { data: workouts, error: workoutsError } =
    scheduleIds.length > 0
      ? await supabase
          .from("workouts")
          .select(
            "workout_id, schedule_id, workout_def_id, workout_name, display_order",
          )
          .in("schedule_id", scheduleIds)
          .order("display_order")
      : { data: [], error: null };

  if (workoutsError) {
    throw new Error(`Failed to load workouts: ${workoutsError.message}`);
  }

  const historyIds = await getWorkoutsWithHistory(
    (workouts ?? []).map((w) => w.workout_id),
  );

  const bySchedule = new Map<string, PlanEditWorkout[]>();
  for (const w of workouts ?? []) {
    const list = bySchedule.get(w.schedule_id) ?? [];
    list.push({
      workout_id: w.workout_id,
      workout_def_id: w.workout_def_id,
      name: w.workout_name,
      has_history: historyIds.has(w.workout_id),
    });
    bySchedule.set(w.schedule_id, list);
  }

  const { data: defs, error: defsError } = await supabase
    .from("workout_defs")
    .select("workout_def_id, name")
    .order("name");

  if (defsError) {
    throw new Error(`Failed to load workout catalog: ${defsError.message}`);
  }

  const days: PlanEditDay[] = (schedules ?? [])
    .slice()
    .sort(
      (a, b) =>
        DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week),
    )
    .map((s) => ({
      schedule_id: s.schedule_id,
      day_of_week: s.day_of_week,
      is_rest_day: s.is_rest_day,
      workouts: bySchedule.get(s.schedule_id) ?? [],
    }));

  return {
    plan_id: plan.plan_id,
    plan_name: plan.name,
    days,
    catalog: defs ?? [],
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
