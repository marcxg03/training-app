import type { QueryData } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { SessionSummary } from "@/components/log/SessionSummary";
import { createClient } from "@/lib/supabase/server";

type SummaryPageProps = {
  params: Promise<{
    session_id: string;
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
  sessionId: string,
  userId: string,
  completionId?: string,
) {
  const query = supabase
    .from("session_completions")
    .select(
      `
        completion_id,
        session_id,
        started_at,
        completed_at,
        was_ended_early,
        sessions!inner (
          session_id,
          session_name
        )
      `,
    )
    .eq("session_id", sessionId)
    .eq("user_id", userId);

  if (completionId) {
    return query.eq("completion_id", completionId).maybeSingle();
  }

  return query.order("started_at", { ascending: false }).limit(1).maybeSingle();
}

function getSetLogsQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
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
    .eq("session_id", sessionId)
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

export default async function SessionSummaryPage({
  params,
  searchParams,
}: SummaryPageProps) {
  const { session_id: sessionId } = await params;
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
    sessionId,
    user.id,
    completionId,
  );
  type CompletionRecord = QueryData<typeof completionQuery>;

  const { data: completion, error: completionError } = await completionQuery;

  if (completionError) {
    throw new Error(
      `Failed to load session completion: ${completionError.message}`,
    );
  }

  if (!completion || !completion.completed_at) {
    redirect("/today");
  }

  const sessionRecord: CompletionRecord = completion;
  const sessionRow = toArray(sessionRecord.sessions)[0];

  if (!sessionRow) {
    redirect("/today");
  }

  const setLogsQuery = getSetLogsQuery(
    supabase,
    sessionId,
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
      <SessionSummary
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
        sessionName={sessionRow.session_name}
        setLogs={mappedSetLogs}
        wasEndedEarly={completion.was_ended_early}
      />
    </div>
  );
}
