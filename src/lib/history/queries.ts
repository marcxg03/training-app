import { createClient } from "@/lib/supabase/server";
import { formatSessionDisplayName } from "@/lib/history/displayName";
import type { AllSessionsRow, PRTimelineRow } from "@/lib/history/projections";

type UnknownRecord = Record<string, unknown>;

type PRBaseRow = {
  pr_id: string;
  achieved_at: string;
  exercise_id: string;
  pr_type: "weight" | "in_range_rep";
  weight_kg: number;
  reps: number;
  set_log_id: string;
};

type ExerciseRow = {
  exercise_id: string;
  name: string;
  is_bodyweight: boolean;
};

type SetLogRow = {
  set_log_id: string;
  session_id: string;
};

type SessionCompletionRow = {
  completion_id: string;
  session_id: string;
  started_at: string;
  completed_at: string | null;
  was_ended_early: boolean;
  completed_block_ids: string[];
};

type SessionRow = {
  session_id: string;
  session_name: string;
};

type BlockSessionRow = {
  block_id: string;
  session_id: string;
};

type PRCountRow = {
  set_log_id: string;
  achieved_at: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function assertRecordArray(value: unknown, label: string): UnknownRecord[] {
  if (!Array.isArray(value)) {
    throw new Error(`Malformed ${label} response.`);
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error(`Malformed ${label} row.`);
    }

    return entry;
  });
}

function getString(record: UnknownRecord, key: string): string {
  const value = record[key];

  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a string.`);
  }

  return value;
}

function getNullableString(record: UnknownRecord, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a nullable string.`);
  }

  return value;
}

function getNumber(record: UnknownRecord, key: string): number {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Expected ${key} to be numeric.`);
}

function getBoolean(record: UnknownRecord, key: string): boolean {
  const value = record[key];

  if (typeof value !== "boolean") {
    throw new Error(`Expected ${key} to be a boolean.`);
  }

  return value;
}

function getStringArray(record: UnknownRecord, key: string): string[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`Expected ${key} to be a string array.`);
  }

  return value.map((entry) => {
    if (typeof entry !== "string") {
      throw new Error(`Expected ${key} to contain only strings.`);
    }

    return entry;
  });
}

function getPrType(
  record: UnknownRecord,
  key: string,
): "weight" | "in_range_rep" {
  const value = record[key];

  if (value === "weight" || value === "in_range_rep") {
    return value;
  }

  throw new Error(`Expected ${key} to be a valid PR type.`);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function ninetyDaysAgoIso(): string {
  const ninetyDaysInMilliseconds = 90 * 24 * 60 * 60 * 1000;

  return new Date(Date.now() - ninetyDaysInMilliseconds).toISOString();
}

function mapPrBaseRows(data: unknown): PRBaseRow[] {
  return assertRecordArray(data, "PR timeline").map((record) => ({
    pr_id: getString(record, "pr_id"),
    achieved_at: getString(record, "achieved_at"),
    exercise_id: getString(record, "exercise_id"),
    pr_type: getPrType(record, "pr_type"),
    weight_kg: getNumber(record, "weight_kg"),
    reps: getNumber(record, "reps"),
    set_log_id: getString(record, "set_log_id"),
  }));
}

function mapExerciseRows(data: unknown): ExerciseRow[] {
  return assertRecordArray(data, "exercise").map((record) => ({
    exercise_id: getString(record, "exercise_id"),
    name: getString(record, "name"),
    is_bodyweight: getBoolean(record, "is_bodyweight"),
  }));
}

function mapSetLogRows(data: unknown): SetLogRow[] {
  return assertRecordArray(data, "set log").map((record) => ({
    set_log_id: getString(record, "set_log_id"),
    session_id: getString(record, "session_id"),
  }));
}

function mapSessionCompletionRows(data: unknown): SessionCompletionRow[] {
  return assertRecordArray(data, "session completion").map((record) => ({
    completion_id: getString(record, "completion_id"),
    session_id: getString(record, "session_id"),
    started_at: getString(record, "started_at"),
    completed_at: getNullableString(record, "completed_at"),
    was_ended_early: getBoolean(record, "was_ended_early"),
    completed_block_ids: getStringArray(record, "completed_block_ids"),
  }));
}

function mapSessionRows(data: unknown): SessionRow[] {
  return assertRecordArray(data, "session").map((record) => ({
    session_id: getString(record, "session_id"),
    session_name: getString(record, "session_name"),
  }));
}

function mapBlockSessionRows(data: unknown): BlockSessionRow[] {
  return assertRecordArray(data, "block").map((record) => ({
    block_id: getString(record, "block_id"),
    session_id: getString(record, "session_id"),
  }));
}

function mapPRCountRows(data: unknown): PRCountRow[] {
  return assertRecordArray(data, "session PR count").map((record) => ({
    set_log_id: getString(record, "set_log_id"),
    achieved_at: getString(record, "achieved_at"),
  }));
}

function buildExerciseMap(exercises: ExerciseRow[]): Map<string, ExerciseRow> {
  return new Map(
    exercises.map((exercise) => [exercise.exercise_id, exercise] as const),
  );
}

function buildSessionMap(sessions: SessionRow[]): Map<string, SessionRow> {
  return new Map(
    sessions.map((session) => [session.session_id, session] as const),
  );
}

function buildSetLogMap(setLogs: SetLogRow[]): Map<string, SetLogRow> {
  return new Map(setLogs.map((setLog) => [setLog.set_log_id, setLog] as const));
}

function buildSessionCompletionsBySession(
  completions: SessionCompletionRow[],
): Map<string, SessionCompletionRow[]> {
  const completionsBySession = new Map<string, SessionCompletionRow[]>();

  for (const completion of completions) {
    const existing = completionsBySession.get(completion.session_id) ?? [];
    existing.push(completion);
    completionsBySession.set(completion.session_id, existing);
  }

  for (const entries of completionsBySession.values()) {
    entries.sort(
      (left, right) =>
        new Date(right.started_at).getTime() -
        new Date(left.started_at).getTime(),
    );
  }

  return completionsBySession;
}

function findMatchingCompletion(
  completions: SessionCompletionRow[],
  achievedAt: string,
): SessionCompletionRow | null {
  const achievedAtMs = new Date(achievedAt).getTime();

  for (const completion of completions) {
    const startedAtMs = new Date(completion.started_at).getTime();
    const completedAtMs =
      completion.completed_at === null
        ? Number.POSITIVE_INFINITY
        : new Date(completion.completed_at).getTime();

    if (startedAtMs <= achievedAtMs && achievedAtMs <= completedAtMs) {
      return completion;
    }
  }

  return null;
}

function deriveSessionState(
  completion: Pick<SessionCompletionRow, "completed_at" | "was_ended_early">,
): AllSessionsRow["state"] {
  if (
    completion.completed_at !== null &&
    completion.was_ended_early === false
  ) {
    return "complete";
  }

  if (completion.was_ended_early) {
    return "ended_early";
  }

  return "in_progress";
}

function countBlocksBySession(blocks: BlockSessionRow[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const block of blocks) {
    totals.set(block.session_id, (totals.get(block.session_id) ?? 0) + 1);
  }

  return totals;
}

function countPrsByCompletion(
  completions: SessionCompletionRow[],
  sessionIdBySetLogId: Map<string, string>,
  prs: PRCountRow[],
): Map<string, number> {
  const prsBySessionId = new Map<string, string[]>();

  for (const pr of prs) {
    const sessionId = sessionIdBySetLogId.get(pr.set_log_id);

    if (!sessionId) {
      continue;
    }

    const existing = prsBySessionId.get(sessionId) ?? [];
    existing.push(pr.achieved_at);
    prsBySessionId.set(sessionId, existing);
  }

  const counts = new Map<string, number>();

  for (const completion of completions) {
    const achievedAtValues = prsBySessionId.get(completion.session_id) ?? [];
    const startedAtMs = new Date(completion.started_at).getTime();
    const completedAtMs =
      completion.completed_at === null
        ? Date.now()
        : new Date(completion.completed_at).getTime();

    const count = achievedAtValues.reduce((total, achievedAt) => {
      const achievedAtMs = new Date(achievedAt).getTime();

      if (achievedAtMs >= startedAtMs && achievedAtMs <= completedAtMs) {
        return total + 1;
      }

      return total;
    }, 0);

    counts.set(completion.completion_id, count);
  }

  return counts;
}

export async function getPRTimeline(opts: {
  showAll: boolean;
}): Promise<PRTimelineRow[]> {
  const supabase = await createClient();
  let prQuery = supabase
    .from("pr_history")
    .select(
      "pr_id, achieved_at, exercise_id, pr_type, weight_kg, reps, set_log_id",
    )
    .not("set_log_id", "is", null)
    .order("achieved_at", { ascending: false })
    .order("pr_id", { ascending: false });

  if (!opts.showAll) {
    prQuery = prQuery.gte("achieved_at", ninetyDaysAgoIso());
  }

  const { data: prData, error: prError } = await prQuery;

  if (prError) {
    throw new Error(`Failed to load PR timeline: ${prError.message}`);
  }

  const prRows = mapPrBaseRows(prData ?? []);

  if (prRows.length === 0) {
    return [];
  }

  const exerciseIds = uniqueStrings(prRows.map((row) => row.exercise_id));
  const setLogIds = uniqueStrings(prRows.map((row) => row.set_log_id));

  const [
    { data: exerciseData, error: exerciseError },
    { data: setLogData, error: setLogError },
  ] = await Promise.all([
    supabase
      .from("exercises")
      .select("exercise_id, name, is_bodyweight")
      .in("exercise_id", exerciseIds),
    supabase
      .from("set_logs")
      .select("set_log_id, session_id")
      .in("set_log_id", setLogIds),
  ]);

  if (exerciseError) {
    throw new Error(
      `Failed to load exercises for PR timeline: ${exerciseError.message}`,
    );
  }

  if (setLogError) {
    throw new Error(
      `Failed to load set logs for PR timeline: ${setLogError.message}`,
    );
  }

  const exercises = mapExerciseRows(exerciseData ?? []);
  const setLogs = mapSetLogRows(setLogData ?? []);
  const exerciseMap = buildExerciseMap(exercises);
  const setLogMap = buildSetLogMap(setLogs);
  const sessionIds = uniqueStrings(setLogs.map((row) => row.session_id));

  if (sessionIds.length === 0) {
    return [];
  }

  const [
    { data: completionData, error: completionError },
    { data: sessionData, error: sessionError },
  ] = await Promise.all([
    supabase
      .from("session_completions")
      .select(
        "completion_id, session_id, started_at, completed_at, was_ended_early, completed_block_ids",
      )
      .in("session_id", sessionIds)
      .order("started_at", { ascending: false }),
    supabase
      .from("sessions")
      .select("session_id, session_name")
      .in("session_id", sessionIds),
  ]);

  if (completionError) {
    throw new Error(
      `Failed to load session completions for PR timeline: ${completionError.message}`,
    );
  }

  if (sessionError) {
    throw new Error(
      `Failed to load sessions for PR timeline: ${sessionError.message}`,
    );
  }

  const completions = mapSessionCompletionRows(completionData ?? []);
  const sessions = mapSessionRows(sessionData ?? []);
  const completionsBySession = buildSessionCompletionsBySession(completions);
  const sessionMap = buildSessionMap(sessions);

  return prRows.flatMap<PRTimelineRow>((prRow) => {
    const exercise = exerciseMap.get(prRow.exercise_id);
    const setLog = setLogMap.get(prRow.set_log_id);

    if (!exercise || !setLog) {
      return [];
    }

    const matchingCompletion = findMatchingCompletion(
      completionsBySession.get(setLog.session_id) ?? [],
      prRow.achieved_at,
    );
    const session = matchingCompletion
      ? sessionMap.get(matchingCompletion.session_id)
      : null;

    if (!matchingCompletion || !session) {
      return [];
    }

    return [
      {
        pr_id: prRow.pr_id,
        achieved_at: prRow.achieved_at,
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.name,
        pr_type: prRow.pr_type,
        weight_kg: prRow.weight_kg,
        reps: prRow.reps,
        is_bodyweight: exercise.is_bodyweight,
        set_log_id: prRow.set_log_id,
        completion_id: matchingCompletion.completion_id,
        session_display_name: formatSessionDisplayName(
          session.session_name,
          matchingCompletion.started_at,
        ),
      },
    ];
  });
}

export async function getAllSessions(): Promise<AllSessionsRow[]> {
  const supabase = await createClient();
  const { data: completionData, error: completionError } = await supabase
    .from("session_completions")
    .select(
      "completion_id, session_id, started_at, completed_at, was_ended_early, completed_block_ids",
    )
    .order("started_at", { ascending: false });

  if (completionError) {
    throw new Error(`Failed to load all sessions: ${completionError.message}`);
  }

  const completions = mapSessionCompletionRows(completionData ?? []);

  if (completions.length === 0) {
    return [];
  }

  const sessionIds = uniqueStrings(
    completions.map((completion) => completion.session_id),
  );

  const [
    { data: sessionData, error: sessionError },
    { data: blockData, error: blockError },
    { data: setLogData, error: setLogError },
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select("session_id, session_name")
      .in("session_id", sessionIds),
    supabase
      .from("blocks")
      .select("block_id, session_id")
      .in("session_id", sessionIds),
    supabase
      .from("set_logs")
      .select("set_log_id, session_id")
      .in("session_id", sessionIds),
  ]);

  if (sessionError) {
    throw new Error(`Failed to load sessions list: ${sessionError.message}`);
  }

  if (blockError) {
    throw new Error(`Failed to load block counts: ${blockError.message}`);
  }

  if (setLogError) {
    throw new Error(
      `Failed to load set logs for sessions list: ${setLogError.message}`,
    );
  }

  const sessions = mapSessionRows(sessionData ?? []);
  const blocks = mapBlockSessionRows(blockData ?? []);
  const setLogs = mapSetLogRows(setLogData ?? []);
  const sessionMap = buildSessionMap(sessions);
  const blockCounts = countBlocksBySession(blocks);
  const sessionIdBySetLogId = new Map(
    setLogs.map((setLog) => [setLog.set_log_id, setLog.session_id] as const),
  );

  let prCountsByCompletion = new Map<string, number>();

  if (setLogs.length > 0) {
    const setLogIds = uniqueStrings(setLogs.map((setLog) => setLog.set_log_id));
    const { data: prData, error: prError } = await supabase
      .from("pr_history")
      .select("set_log_id, achieved_at")
      .not("set_log_id", "is", null)
      .in("set_log_id", setLogIds);

    if (prError) {
      throw new Error(`Failed to load session PR counts: ${prError.message}`);
    }

    prCountsByCompletion = countPrsByCompletion(
      completions,
      sessionIdBySetLogId,
      mapPRCountRows(prData ?? []),
    );
  }

  return completions.map<AllSessionsRow>((completion) => {
    const session = sessionMap.get(completion.session_id);

    if (!session) {
      throw new Error("Missing session row for session completion.");
    }

    return {
      completion_id: completion.completion_id,
      session_display_name: formatSessionDisplayName(
        session.session_name,
        completion.started_at,
      ),
      started_at: completion.started_at,
      state: deriveSessionState(completion),
      blocks_completed_count: completion.completed_block_ids.length,
      blocks_total_count: blockCounts.get(completion.session_id) ?? 0,
      pr_count: prCountsByCompletion.get(completion.completion_id) ?? 0,
    };
  });
}
