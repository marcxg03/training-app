import type { QueryData } from "@supabase/supabase-js";
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
    session_id: string;
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

function mapLoggerRecord(record: QueryData<ReturnType<typeof getLoggerQuery>>) {
  const schedule = toArray(record.daily_schedules)[0];

  if (!schedule) {
    throw new Error("Missing daily schedule for logger session.");
  }

  const session: LoggerSession = {
    session_id: record.session_id,
    session_name: record.session_name,
    session_type: record.session_type,
    dayOfWeek: schedule.day_of_week,
  };

  const blocks = toArray(record.blocks)
    .sort((left, right) => left.display_order - right.display_order)
    .map<LoggerBlock>((block) => ({
      block_id: block.block_id,
      block_name: block.block_name,
      block_type: block.block_type,
      display_order: block.display_order,
      exercises: toArray(block.block_exercises)
        .sort((left, right) => left.display_order - right.display_order)
        .flatMap((row) => toArray(row.exercises))
        .map((exercise) => ({
          exercise_id: exercise.exercise_id,
          name: exercise.name,
          notes: exercise.notes,
          prescribed_min: exercise.prescribed_min,
          prescribed_max: exercise.prescribed_max,
          muscle_groups: exercise.muscle_groups,
          is_bodyweight: exercise.is_bodyweight,
        })),
      setLogs: toArray(block.set_logs)
        .sort((left, right) => left.set_index - right.set_index)
        .map((setLog) => ({
          set_log_id: setLog.set_log_id,
          user_id: setLog.user_id,
          session_id: setLog.session_id,
          block_id: setLog.block_id,
          exercise_id: setLog.exercise_id,
          set_index: setLog.set_index,
          weight_kg: setLog.weight_kg,
          reps: setLog.reps,
          is_to_failure: setLog.is_to_failure,
          prescribed_min: setLog.prescribed_min,
          prescribed_max: setLog.prescribed_max,
          notes: setLog.notes,
          logged_at: setLog.logged_at,
          prTypes: toArray(setLog.pr_history).map((prRow) => prRow.pr_type),
        })),
    }));

  return { blocks, session };
}

function getLoggerQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
) {
  return supabase
    .from("sessions")
    .select(
      `
        session_id,
        session_name,
        session_type,
        daily_schedules!inner (
          day_of_week
        ),
        blocks (
          block_id,
          block_name,
          block_type,
          display_order,
          block_exercises (
            display_order,
            exercises (
              exercise_id,
              name,
              notes,
              prescribed_min,
              prescribed_max,
              muscle_groups,
              is_bodyweight
            )
          ),
          set_logs (
            set_log_id,
            user_id,
            session_id,
            block_id,
            exercise_id,
            set_index,
            weight_kg,
            reps,
            is_to_failure,
            prescribed_min,
            prescribed_max,
            notes,
            logged_at,
            pr_history (
              pr_type
            )
          )
        )
      `,
    )
    .eq("session_id", sessionId)
    .eq("session_type", "lifting")
    .maybeSingle();
}

export default async function LoggerPage({ params }: LoggerPageProps) {
  const { session_id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/today");
  }

  const loggerQuery = getLoggerQuery(supabase, sessionId);
  const { data, error } = await loggerQuery;

  if (error) {
    throw new Error(`Failed to load logger session: ${error.message}`);
  }

  if (!data) {
    redirect("/today");
  }

  const todayDayOfWeek = getTodayDayOfWeek();
  const { blocks, session } = mapLoggerRecord(data);

  if (session.dayOfWeek !== todayDayOfWeek) {
    redirect("/today");
  }

  const todayStartIso = getTodayStartIso();
  const sessionCompletion = await getOrCreateSessionCompletion(
    {
      async create(payload) {
        const { data: insertedCompletion, error: insertError } = await supabase
          .from("session_completions")
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
          .from("session_completions")
          .select("*")
          .eq("session_id", targetSessionId)
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
    sessionId,
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
      .from("session_completions")
      .update({
        completed_at: completedAt,
      })
      .eq("completion_id", sessionCompletion.completion_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    redirect(
      `/log/${sessionId}/summary?completion_id=${sessionCompletion.completion_id}`,
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
