import { redirect } from "next/navigation";

import { WorkoutSummary } from "@/components/log/WorkoutSummary";
import { createClient } from "@/lib/supabase/server";

type SummaryPageProps = {
  params: Promise<{
    workout_id: string;
  }>;
  searchParams: Promise<{
    completion_id?: string;
  }>;
};

function toArray<T>(value: T | T[] | null | undefined) {
  if (!value) {
    return [] as T[];
  }

  return Array.isArray(value) ? value : [value];
}

function getCompletionQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workoutId: string,
  userId: string,
  completionId?: string,
) {
  const query = supabase
    .from("workout_completions")
    .select(
      `
        completion_id,
        workout_id,
        started_at,
        completed_at,
        was_ended_early,
        workouts!inner (
          workout_id,
          workout_name
        )
      `,
    )
    .eq("workout_id", workoutId)
    .eq("user_id", userId);

  if (completionId) {
    return query.eq("completion_id", completionId).maybeSingle();
  }

  return query.order("started_at", { ascending: false }).limit(1).maybeSingle();
}

function getSetLogsQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workoutId: string,
  startedAt: string,
  completedAt: string,
) {
  return supabase
    .from("set_logs")
    .select(
      `
        set_log_id,
        reps,
        weight_kg,
        exercises!inner (
          name,
          is_bodyweight
        )
      `,
    )
    .eq("workout_id", workoutId)
    .gte("logged_at", startedAt)
    .lte("logged_at", completedAt);
}

function getPrHistoryQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  setLogIds: string[],
) {
  return supabase
    .from("pr_history")
    .select(
      `
        pr_id,
        pr_type,
        reps,
        weight_kg,
        exercises!inner (
          name
        )
      `,
    )
    .in("set_log_id", setLogIds);
}

export default async function WorkoutSummaryPage({
  params,
  searchParams,
}: SummaryPageProps) {
  const { workout_id: workoutId } = await params;
  const { completion_id: completionId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/today");
  }

  const completionQuery = getCompletionQuery(
    supabase,
    workoutId,
    user.id,
    completionId,
  );
  const { data: completion, error: completionError } = await completionQuery;

  if (completionError) {
    throw new Error(
      `Failed to load workout completion: ${completionError.message}`,
    );
  }

  if (!completion || !completion.completed_at) {
    redirect("/today");
  }

  const workoutRow = toArray(completion.workouts)[0];

  if (!workoutRow) {
    redirect("/today");
  }

  const setLogsQuery = getSetLogsQuery(
    supabase,
    workoutId,
    completion.started_at,
    completion.completed_at,
  );
  const { data: setLogs, error: setLogsError } = await setLogsQuery;

  if (setLogsError) {
    throw new Error(`Failed to load set logs: ${setLogsError.message}`);
  }

  const mappedSetLogs = setLogs.map((setLog) => {
    const exercise = toArray(setLog.exercises)[0];

    if (!exercise) {
      throw new Error("Missing exercise relation for summary set log.");
    }

    return {
      setLogId: setLog.set_log_id,
      reps: setLog.reps,
      weightKg: setLog.weight_kg,
      exerciseName: exercise.name,
      isBodyweight: exercise.is_bodyweight,
    };
  });

  const prHistory =
    mappedSetLogs.length > 0
      ? await getPrHistoryQuery(
          supabase,
          mappedSetLogs.map((setLog) => setLog.setLogId),
        )
      : { data: [], error: null };

  if (prHistory.error) {
    throw new Error(`Failed to load PR history: ${prHistory.error.message}`);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <WorkoutSummary
        completedAt={completion.completed_at}
        prs={(prHistory.data ?? []).map((pr) => {
          const exercise = toArray(pr.exercises)[0];

          if (!exercise) {
            throw new Error("Missing exercise relation for summary PR.");
          }

          return {
            exerciseName: exercise.name,
            prId: pr.pr_id,
            prType: pr.pr_type,
            reps: pr.reps,
            weightKg: pr.weight_kg,
          };
        })}
        workoutName={workoutRow.workout_name}
        setLogs={mappedSetLogs}
        wasEndedEarly={completion.was_ended_early}
      />
    </div>
  );
}
