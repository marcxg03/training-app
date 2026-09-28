import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database, Enums } from "@/lib/supabase/types";

type BrowserClient = SupabaseClient<Database>;

type MutationResult<T> = { ok: true; data: T } | { ok: false; error: string };

const DAYS_OF_WEEK: Enums<"day_of_week_enum">[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

function translateMutationError(error: PostgrestError | null): string {
  if (error?.code === "42501") {
    return "You don't have permission to make this change.";
  }
  if (error?.code === "23505") {
    return "A plan with that name already exists.";
  }
  return error?.message ?? "Save failed — please retry.";
}

/**
 * Creates a new plan as a 7-day rest-day skeleton. The plan is inactive unless
 * the user has no active plan (so the app always has exactly one active plan).
 */
export async function createPlan(
  supabase: BrowserClient,
  userId: string,
  name: string,
): Promise<MutationResult<{ plan_id: string }>> {
  // Only self-activate when we can confirm there is no active plan. On a count
  // error, default to NOT activating so a transient read can't steal active
  // status from the existing plan.
  const { count: activeCount, error: countError } = await supabase
    .from("training_plans")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const shouldActivate = !countError && (activeCount ?? 1) === 0;

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .insert({ user_id: userId, name: name.trim(), is_active: shouldActivate })
    .select("plan_id")
    .single();

  if (planError || !plan) {
    return { ok: false, error: translateMutationError(planError) };
  }

  const { error: scheduleError } = await supabase
    .from("daily_schedules")
    .insert(
      DAYS_OF_WEEK.map((day) => ({
        plan_id: plan.plan_id,
        day_of_week: day,
        is_rest_day: true,
      })),
    );

  if (scheduleError) {
    // Compensating delete: a plan with no schedules is unusable and a duplicate
    // name would block retry, so remove the just-created (history-free) plan.
    await supabase.from("training_plans").delete().eq("plan_id", plan.plan_id);
    return { ok: false, error: translateMutationError(scheduleError) };
  }

  return { ok: true, data: { plan_id: plan.plan_id } };
}

/** Activates one plan and deactivates the rest (exactly one active plan). */
export async function activatePlan(
  supabase: BrowserClient,
  userId: string,
  planId: string,
): Promise<MutationResult<void>> {
  const { error: deactivateError } = await supabase
    .from("training_plans")
    .update({ is_active: false })
    .eq("user_id", userId)
    .neq("plan_id", planId);

  if (deactivateError) {
    return { ok: false, error: translateMutationError(deactivateError) };
  }

  const { error: activateError } = await supabase
    .from("training_plans")
    .update({ is_active: true })
    .eq("plan_id", planId);

  if (activateError) {
    return { ok: false, error: translateMutationError(activateError) };
  }

  return { ok: true, data: undefined };
}

/**
 * Deletes a plan (cascades its schedules, workouts, and any logged history).
 * Refuses to delete the only remaining plan — the app always needs one active
 * plan. If the deleted plan was active, the most-recent remaining plan is
 * activated so exactly one plan stays active.
 */
export async function deletePlan(
  supabase: BrowserClient,
  userId: string,
  planId: string,
): Promise<MutationResult<void>> {
  const { data: plans, error: listError } = await supabase
    .from("training_plans")
    .select("plan_id, is_active")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (listError || !plans) {
    return { ok: false, error: translateMutationError(listError) };
  }

  if (plans.length <= 1) {
    return {
      ok: false,
      error: "This is your only plan. Create another before deleting it.",
    };
  }

  const wasActive =
    plans.find((plan) => plan.plan_id === planId)?.is_active ?? false;

  const { error: deleteError } = await supabase
    .from("training_plans")
    .delete()
    .eq("plan_id", planId);

  if (deleteError) {
    return { ok: false, error: translateMutationError(deleteError) };
  }

  if (wasActive) {
    // plans is newest-first, so the first survivor is the most recent.
    const next = plans.find((plan) => plan.plan_id !== planId);
    if (next) {
      const { error: activateError } = await supabase
        .from("training_plans")
        .update({ is_active: true })
        .eq("plan_id", next.plan_id);

      if (activateError) {
        return { ok: false, error: translateMutationError(activateError) };
      }
    }
  }

  return { ok: true, data: undefined };
}

export async function renamePlan(
  supabase: BrowserClient,
  planId: string,
  name: string,
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from("training_plans")
    .update({ name: name.trim() })
    .eq("plan_id", planId);

  if (error) {
    return { ok: false, error: translateMutationError(error) };
  }

  return { ok: true, data: undefined };
}

/**
 * Copies a program — its week, its sessions, and each session's block
 * membership — into a new inactive plan (T3-C).
 *
 * WHAT IS DELIBERATELY NOT COPIED: logged history. `set_logs`,
 * `session_completions`, `activity_completions` and `pr_history` stay with the
 * ORIGINAL plan. A duplicate is a fresh program that happens to start with the
 * same structure; giving it someone's past sets would corrupt every PR and
 * adherence number computed from it. This is the same append-only-history
 * contract the logger depends on.
 *
 * The copy is always INACTIVE, whatever the source was. Duplicating a program
 * should never silently change what you train today — that is a separate,
 * explicit act (`activatePlan`).
 *
 * NOT ATOMIC, and the failure mode is chosen deliberately. There is no
 * transaction across these inserts from a browser client, so a mid-way failure
 * leaves a partial copy. On any step after the plan row exists we DELETE the
 * new plan (cascading its children) and report the error, so the outcome is
 * "nothing happened" rather than a half-built program sitting in the list
 * looking real. The same compensating-delete pattern `createPlan` uses.
 */
export async function duplicatePlan(
  supabase: BrowserClient,
  userId: string,
  planId: string,
  name: string,
): Promise<MutationResult<{ plan_id: string }>> {
  const { data: source, error: sourceError } = await supabase
    .from("training_plans")
    .select("plan_id, daily_schedules(schedule_id, day_of_week, is_rest_day)")
    .eq("plan_id", planId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sourceError || !source) {
    return {
      ok: false,
      error: sourceError
        ? translateMutationError(sourceError)
        : "That program no longer exists.",
    };
  }

  const { data: copy, error: copyError } = await supabase
    .from("training_plans")
    .insert({ user_id: userId, name: name.trim(), is_active: false })
    .select("plan_id")
    .single();

  if (copyError || !copy) {
    return { ok: false, error: translateMutationError(copyError) };
  }

  /** Undo the whole copy — a partial program is worse than none. */
  const rollback = async (error: PostgrestError | null) => {
    await supabase.from("training_plans").delete().eq("plan_id", copy.plan_id);
    return { ok: false as const, error: translateMutationError(error) };
  };

  const sourceSchedules = source.daily_schedules ?? [];

  const { data: newSchedules, error: scheduleError } = await supabase
    .from("daily_schedules")
    .insert(
      sourceSchedules.map((schedule) => ({
        plan_id: copy.plan_id,
        day_of_week: schedule.day_of_week,
        is_rest_day: schedule.is_rest_day,
      })),
    )
    .select("schedule_id, day_of_week");

  if (scheduleError || !newSchedules) {
    return rollback(scheduleError);
  }

  // Map source schedule -> copied schedule BY DAY. The insert above does not
  // guarantee return order, so pairing by array index would silently shuffle
  // the week — Monday's sessions landing on Thursday.
  const newScheduleIdByDay = new Map(
    newSchedules.map((schedule) => [
      schedule.day_of_week,
      schedule.schedule_id,
    ]),
  );

  const sourceScheduleIds = sourceSchedules.map((s) => s.schedule_id);

  if (sourceScheduleIds.length === 0) {
    return { ok: true, data: { plan_id: copy.plan_id } };
  }

  const { data: sourceWorkouts, error: workoutsError } = await supabase
    .from("workouts")
    .select(
      "workout_id, schedule_id, workout_def_id, workout_name, workout_type, cardio_format, timing, gym, display_order",
    )
    .in("schedule_id", sourceScheduleIds)
    .order("display_order");

  if (workoutsError) {
    return rollback(workoutsError);
  }

  const dayByScheduleId = new Map(
    sourceSchedules.map((s) => [s.schedule_id, s.day_of_week]),
  );

  const workoutRows = (sourceWorkouts ?? []).flatMap((workout) => {
    const day = dayByScheduleId.get(workout.schedule_id);
    const targetScheduleId = day ? newScheduleIdByDay.get(day) : undefined;

    if (!targetScheduleId) {
      return [];
    }

    return [
      {
        schedule_id: targetScheduleId,
        workout_def_id: workout.workout_def_id,
        workout_name: workout.workout_name,
        workout_type: workout.workout_type,
        cardio_format: workout.cardio_format,
        timing: workout.timing,
        gym: workout.gym,
        display_order: workout.display_order,
        // Carried so each copied workout can be paired back to its source
        // when the block membership is copied below.
        __source_id: workout.workout_id,
      },
    ];
  });

  if (workoutRows.length === 0) {
    return { ok: true, data: { plan_id: copy.plan_id } };
  }

  const { data: newWorkouts, error: insertWorkoutsError } = await supabase
    .from("workouts")
    .insert(workoutRows.map(({ __source_id, ...row }) => row))
    .select("workout_id, schedule_id, display_order");

  if (insertWorkoutsError || !newWorkouts) {
    return rollback(insertWorkoutsError);
  }

  // Pair source workout -> copied workout by (schedule, display_order), the
  // only pair that is unique within a plan. Again: never by array index.
  const newWorkoutIdByKey = new Map(
    newWorkouts.map((w) => [
      `${w.schedule_id}:${w.display_order}`,
      w.workout_id,
    ]),
  );

  const { data: sourceBlocks, error: blocksError } = await supabase
    .from("workout_blocks")
    .select("workout_id, block_id, display_order, preset_activity_id")
    .in(
      "workout_id",
      (sourceWorkouts ?? []).map((w) => w.workout_id),
    );

  if (blocksError) {
    return rollback(blocksError);
  }

  const blockRows = (sourceBlocks ?? []).flatMap((block) => {
    const sourceRow = workoutRows.find(
      (row) => row.__source_id === block.workout_id,
    );

    if (!sourceRow) {
      return [];
    }

    const targetWorkoutId = newWorkoutIdByKey.get(
      `${sourceRow.schedule_id}:${sourceRow.display_order}`,
    );

    if (!targetWorkoutId) {
      return [];
    }

    return [
      {
        workout_id: targetWorkoutId,
        block_id: block.block_id,
        display_order: block.display_order,
        preset_activity_id: block.preset_activity_id,
      },
    ];
  });

  if (blockRows.length > 0) {
    const { error: insertBlocksError } = await supabase
      .from("workout_blocks")
      .insert(blockRows);

    if (insertBlocksError) {
      return rollback(insertBlocksError);
    }
  }

  return { ok: true, data: { plan_id: copy.plan_id } };
}
