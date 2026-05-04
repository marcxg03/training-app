import { redirect } from "next/navigation";

import { LoggerShell } from "@/components/log/LoggerShell";
import {
  findLastIncompleteBlock,
  getOrCreateSessionCompletion,
  type LoggerBlock,
  type LoggerSession,
} from "@/lib/methodology/session-state";
import { getTodayDayOfWeek } from "@/lib/methodology/today";
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

function getTodayStartIso() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

async function getLoggerData(workoutId: string) {
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

  const [
    { data: liftingItems, error: liftingItemsError },
    { data: setLogs, error: setLogsError },
  ] = await Promise.all([
    blockIds.length
      ? supabase
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
      : Promise.resolve({ data: [], error: null }),
    blockIds.length
      ? supabase
          .from("set_logs")
          .select(
            "set_log_id, user_id, workout_id, block_id, exercise_id, set_index, weight_kg, reps, is_to_failure, prescribed_min, prescribed_max, notes, logged_at",
          )
          .eq("workout_id", workoutId)
          .in("block_id", blockIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (liftingItemsError) {
    throw new Error(
      `Failed to load logger lifting items: ${liftingItemsError.message}`,
    );
  }

  if (setLogsError) {
    throw new Error(`Failed to load logger set logs: ${setLogsError.message}`);
  }

  const setLogIds = setLogs.map((setLog) => setLog.set_log_id);
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

  const setLogsByBlockId = new Map<string, LoggerBlock["setLogs"]>();

  for (const setLog of setLogs) {
    const list = setLogsByBlockId.get(setLog.block_id) ?? [];

    list.push({
      ...setLog,
      session_id: setLog.workout_id,
      prTypes: prTypesBySetLogId.get(setLog.set_log_id) ?? [],
    });
    setLogsByBlockId.set(setLog.block_id, list);
  }

  const session: LoggerSession = {
    session_id: workout.workout_id,
    session_name: workout.workout_name,
    session_type: workout.workout_type,
    dayOfWeek: schedule.day_of_week,
  };

  const blocks: LoggerBlock[] = orderedBlocks.map((block) => ({
    ...block,
    exercises: exercisesByBlockId.get(block.block_id) ?? [],
    setLogs: (setLogsByBlockId.get(block.block_id) ?? []).sort(
      (left, right) => left.set_index - right.set_index,
    ),
  }));

  return { blocks, session };
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

  const loggerData = await getLoggerData(workoutId);

  if (!loggerData) {
    redirect("/today");
  }

  const todayDayOfWeek = getTodayDayOfWeek();
  const { blocks, session } = loggerData;

  if (session.dayOfWeek !== todayDayOfWeek) {
    redirect("/today");
  }

  const todayStartIso = getTodayStartIso();
  const sessionCompletion = await getOrCreateSessionCompletion(
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
        sessionId: targetSessionId,
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
    session.session_id,
    user.id,
    todayStartIso,
  );

  if (sessionCompletion.completed_at) {
    redirect("/today");
  }

  const initialBlockIndex = findLastIncompleteBlock(
    blocks,
    sessionCompletion.completed_block_ids,
  );

  if (initialBlockIndex === -1) {
    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("workout_completions")
      .update({
        completed_at: completedAt,
      })
      .eq("completion_id", sessionCompletion.completion_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    redirect(
      `/log/${session.session_id}/summary?completion_id=${sessionCompletion.completion_id}`,
    );
  }

  return (
    <LoggerShell
      blocks={blocks}
      initialBlockIndex={initialBlockIndex}
      session={session}
      sessionCompletion={sessionCompletion}
      userId={user.id}
    />
  );
}
