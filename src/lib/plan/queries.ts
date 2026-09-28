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

/**
 * One day of a plan, ready to edit.
 *
 * `planId` is OPTIONAL and defaults to the user's active plan, which is how
 * this behaved before T3-C. Passing it explicitly is what lets the admin hub
 * edit a NON-active program: folding Schedule into Programs (D48) means the
 * day editor has to work for whichever program was opened, not for whatever
 * happens to be active. Marcus caught the underlying confusion — "shouldn't
 * editing only happen in the program editing page?" — and the honest answer
 * was that the editor was hardcoded to one plan, which is the only reason
 * Schedule existed as a separate surface at all.
 */
export async function getDayEditData(
  day: DayOfWeek,
  planId?: string,
): Promise<DayEditData | null> {
  const supabase = await createClient();

  let resolvedPlanId = planId;

  if (!resolvedPlanId) {
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

    resolvedPlanId = plan.plan_id;
  }

  const plan = { plan_id: resolvedPlanId };

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

/** One row of the admin hub's Programs list (T3-C). */
export type ProgramListItem = {
  plan_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  /** Days that carry at least one session (rest days excluded). */
  training_days: number;
  /** Total sessions across the week. */
  sessions: number;
};

/**
 * Every program the owner has, newest first, with enough shape to choose
 * between them (T3-C).
 *
 * WHY `training_plans` AND NOT `plan_templates`: the Programs page used to
 * list `plan_templates`, which is written ONLY by the seed script — an
 * immutable snapshot archive, not an editable entity. The real programs, the
 * ones the app trains against and the mutations in plan-mutations.ts already
 * operate on, live in `training_plans`. The page was pointed at the wrong
 * table (D48).
 *
 * Counts are derived in ONE round-trip via a nested select rather than N+1
 * count queries — a handful of programs today, but this is the list that grows
 * fastest once programs get prescribed to other people.
 */
export async function getProgramList(
  userId: string,
): Promise<ProgramListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("training_plans")
    .select(
      "plan_id, name, is_active, created_at, daily_schedules(is_rest_day, workouts(workout_id))",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load programs: ${error.message}`);
  }

  return (data ?? []).map((plan) => {
    const schedules = plan.daily_schedules ?? [];
    const sessions = schedules.reduce(
      (total, schedule) => total + (schedule.workouts?.length ?? 0),
      0,
    );
    // A "training day" is a day with work on it. Counting non-rest days would
    // over-report: a day can be flagged non-rest and still have no sessions.
    const trainingDays = schedules.filter(
      (schedule) =>
        !schedule.is_rest_day && (schedule.workouts?.length ?? 0) > 0,
    ).length;

    return {
      plan_id: plan.plan_id,
      name: plan.name,
      is_active: plan.is_active,
      created_at: plan.created_at,
      training_days: trainingDays,
      sessions,
    };
  });
}
