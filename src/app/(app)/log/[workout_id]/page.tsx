import { redirect } from "next/navigation";

import { LoggerShell } from "@/components/log/LoggerShell";
import {
  findLastIncompleteBlock,
  getOrCreateWorkoutCompletion,
  type LoggerBlock,
  type LoggerWorkout,
} from "@/lib/methodology/workout-state";
import {
  getAppDayOfWeek,
  getAppTimezone,
  getAppToday,
} from "@/lib/time/server";
import { startOfDayInTzIso } from "@/lib/time/appDay";
import { createClient } from "@/lib/supabase/server";

type LoggerPageProps = {
  params: Promise<{
    workout_id: string;
  }>;
};

function toArray<T>(value: T | T[] | null | undefined) {
  if (!value) {
    return [] as T[];
  }

  return Array.isArray(value) ? value : [value];
}

// App-day boundary (profile timezone) — matches today/page.tsx so the
// completion created here is recognized there as "today".

// The workout template: blocks and their exercise bank. Deliberately free of
// set logs — those belong to a session (workout_completions row), not to the
// template, and the template is resolved before a completion exists.
async function getWorkoutStructure(workoutId: string) {
  const supabase = await createClient();
  const { data: workout, error: workoutError } = await supabase
    .from("workouts")
    .select(
      `
        workout_id,
        workout_name,
        workout_type,
        daily_schedules!inner (
          day_of_week
        )
      `,
    )
    .eq("workout_id", workoutId)
    .eq("workout_type", "lifting")
    .maybeSingle();

  if (workoutError) {
    throw new Error(`Failed to load logger workout: ${workoutError.message}`);
  }

  if (!workout) {
    return null;
  }

  const schedule = toArray(workout.daily_schedules)[0];

  if (!schedule) {
    throw new Error("Missing daily schedule for logger workout.");
  }

  const { data: workoutBlocks, error: workoutBlocksError } = await supabase
    .from("workout_blocks")
    .select(
      `
        display_order,
        blocks!inner (
          block_id,
          block_name,
          block_type
        )
      `,
    )
    .eq("workout_id", workoutId)
    .order("display_order");

  if (workoutBlocksError) {
    throw new Error(
      `Failed to load logger workout blocks: ${workoutBlocksError.message}`,
    );
  }

  const orderedBlocks = workoutBlocks
    .flatMap((row) =>
      toArray(row.blocks).flatMap((block) =>
        block && block.block_type
          ? [
              {
                block_id: block.block_id,
                block_name: block.block_name,
                block_type: block.block_type,
                display_order: row.display_order,
              },
            ]
          : [],
      ),
    )
    .sort((left, right) => left.display_order - right.display_order);
  const blockIds = orderedBlocks.map((block) => block.block_id);

  const { data: liftingItems, error: liftingItemsError } = blockIds.length
    ? await supabase
        .from("block_lifting_items")
        .select(
          `
            block_id,
            display_order,
            exercises!inner (
              exercise_id,
              name,
              notes,
              prescribed_min,
              prescribed_max,
              muscle_groups,
              is_bodyweight
            )
          `,
        )
        .in("block_id", blockIds)
        .order("display_order")
    : { data: [], error: null };

  if (liftingItemsError) {
    throw new Error(
      `Failed to load logger lifting items: ${liftingItemsError.message}`,
    );
  }

  const exercisesByBlockId = new Map<string, LoggerBlock["exercises"]>();

  for (const item of liftingItems ?? []) {
    const list = exercisesByBlockId.get(item.block_id) ?? [];

    for (const exercise of toArray(item.exercises)) {
      if (!exercise) {
        continue;
      }

      list.push({
        exercise_id: exercise.exercise_id,
        name: exercise.name,
        notes: exercise.notes,
        prescribed_min: exercise.prescribed_min,
        prescribed_max: exercise.prescribed_max,
        muscle_groups: exercise.muscle_groups,
        is_bodyweight: exercise.is_bodyweight,
      });
    }

    exercisesByBlockId.set(item.block_id, list);
  }

  const session: LoggerWorkout = {
    workout_id: workout.workout_id,
    workout_name: workout.workout_name,
    workout_type: workout.workout_type,
    dayOfWeek: schedule.day_of_week,
  };

  const blocks = orderedBlocks.map((block) => ({
    ...block,
    exercises: exercisesByBlockId.get(block.block_id) ?? [],
  }));

  return { blockIds, blocks, session };
}

// Set logs for ONE session, keyed on completion_id. Scoping this to the
// workout instead would load every prior week's sets for the same workout —
// the bug this replaced (see migration 023).
async function getSessionSetLogs(completionId: string, blockIds: string[]) {
  const supabase = await createClient();
  const { data: setLogs, error: setLogsError } = blockIds.length
    ? await supabase
        .from("set_logs")
        .select(
          "set_log_id, user_id, workout_id, block_id, exercise_id, set_index, weight_kg, reps, is_to_failure, prescribed_min, prescribed_max, notes, logged_at",
        )
        .eq("completion_id", completionId)
        .in("block_id", blockIds)
    : { data: [], error: null };

  if (setLogsError) {
    throw new Error(`Failed to load logger set logs: ${setLogsError.message}`);
  }

  const setLogIds = (setLogs ?? []).map((setLog) => setLog.set_log_id);
  const { data: prHistory, error: prHistoryError } = setLogIds.length
    ? await supabase
        .from("pr_history")
        .select("set_log_id, pr_type")
        .in("set_log_id", setLogIds)
    : { data: [], error: null };

  if (prHistoryError) {
    throw new Error(
      `Failed to load logger PR history: ${prHistoryError.message}`,
    );
  }

  const prTypesBySetLogId = new Map<
    string,
    LoggerBlock["setLogs"][number]["prTypes"]
  >();

  for (const row of prHistory ?? []) {
    const list = prTypesBySetLogId.get(row.set_log_id) ?? [];
    list.push(row.pr_type);
    prTypesBySetLogId.set(row.set_log_id, list);
  }

  const setLogsByBlockId = new Map<string, LoggerBlock["setLogs"]>();

  for (const setLog of setLogs ?? []) {
    const list = setLogsByBlockId.get(setLog.block_id) ?? [];

    list.push({
      ...setLog,
      workout_id: setLog.workout_id,
      prTypes: prTypesBySetLogId.get(setLog.set_log_id) ?? [],
    });
    setLogsByBlockId.set(setLog.block_id, list);
  }

  return setLogsByBlockId;
}

export default async function LoggerPage({ params }: LoggerPageProps) {
  const { workout_id: workoutId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/today");
  }

  const workoutStructure = await getWorkoutStructure(workoutId);

  if (!workoutStructure) {
    redirect("/today");
  }

  const todayDayOfWeek = await getAppDayOfWeek();
  const { blockIds, blocks: templateBlocks, session } = workoutStructure;

  if (session.dayOfWeek !== todayDayOfWeek) {
    redirect("/today");
  }

  // Nothing to log. Guarded before a completion is created so an empty workout
  // can never be auto-marked complete below (findIndex returns -1 on []).
  if (templateBlocks.length === 0) {
    redirect("/today");
  }

  const todayStartIso = startOfDayInTzIso(
    await getAppTimezone(),
    await getAppToday(),
  );
  const workoutCompletion = await getOrCreateWorkoutCompletion(
    {
      async create(payload) {
        const { data: insertedCompletion, error: insertError } = await supabase
          .from("workout_completions")
          .insert(payload)
          .select("*")
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        return insertedCompletion;
      },
      async findLatestForToday({
        workoutId: targetSessionId,
        startedAfterIso,
        userId,
      }) {
        const { data: completion, error: completionError } = await supabase
          .from("workout_completions")
          .select("*")
          .eq("workout_id", targetSessionId)
          .eq("user_id", userId)
          .gte("started_at", startedAfterIso)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (completionError) {
          throw new Error(completionError.message);
        }

        return completion;
      },
    },
    session.workout_id,
    user.id,
    todayStartIso,
  );

  if (workoutCompletion.completed_at) {
    redirect("/today");
  }

  const setLogsByBlockId = await getSessionSetLogs(
    workoutCompletion.completion_id,
    blockIds,
  );
  const blocks: LoggerBlock[] = templateBlocks.map((block) => ({
    ...block,
    setLogs: (setLogsByBlockId.get(block.block_id) ?? []).sort(
      (left, right) => left.set_index - right.set_index,
    ),
  }));

  const initialBlockIndex = findLastIncompleteBlock(
    blocks,
    workoutCompletion.completed_block_ids,
  );

  if (initialBlockIndex === -1) {
    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("workout_completions")
      .update({
        completed_at: completedAt,
      })
      .eq("completion_id", workoutCompletion.completion_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    redirect(
      `/log/${session.workout_id}/summary?completion_id=${workoutCompletion.completion_id}`,
    );
  }

  return (
    <LoggerShell
      blocks={blocks}
      initialBlockIndex={initialBlockIndex}
      session={session}
      workoutCompletion={workoutCompletion}
      userId={user.id}
    />
  );
}
