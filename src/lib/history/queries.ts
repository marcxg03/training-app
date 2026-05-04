import { formatWorkoutDisplayName } from "@/lib/history/displayName";
import type { AllWorkoutsRow, PRTimelineRow } from "@/lib/history/projections";
import { createClient } from "@/lib/supabase/server";

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
  workout_id: string;
};

type WorkoutCompletionRow = {
  completion_id: string;
  workout_id: string;
  started_at: string;
  completed_at: string | null;
  was_ended_early: boolean;
  completed_block_ids: string[];
};

type WorkoutRow = {
  workout_id: string;
  workout_name: string;
};

type WorkoutBlockRow = {
  block_id: string;
  workout_id: string;
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
    workout_id: getString(record, "workout_id"),
  }));
}

function mapWorkoutCompletionRows(data: unknown): WorkoutCompletionRow[] {
  return assertRecordArray(data, "workout completion").map((record) => ({
    completion_id: getString(record, "completion_id"),
    workout_id: getString(record, "workout_id"),
    started_at: getString(record, "started_at"),
    completed_at: getNullableString(record, "completed_at"),
    was_ended_early: getBoolean(record, "was_ended_early"),
    completed_block_ids: getStringArray(record, "completed_block_ids"),
  }));
}

function mapWorkoutRows(data: unknown): WorkoutRow[] {
  return assertRecordArray(data, "workout").map((record) => ({
    workout_id: getString(record, "workout_id"),
    workout_name: getString(record, "workout_name"),
  }));
}

function mapWorkoutBlockRows(data: unknown): WorkoutBlockRow[] {
  return assertRecordArray(data, "workout block").map((record) => ({
    block_id: getString(record, "block_id"),
    workout_id: getString(record, "workout_id"),
  }));
}

function mapPRCountRows(data: unknown): PRCountRow[] {
  return assertRecordArray(data, "workout PR count").map((record) => ({
    set_log_id: getString(record, "set_log_id"),
    achieved_at: getString(record, "achieved_at"),
  }));
}

function buildExerciseMap(exercises: ExerciseRow[]): Map<string, ExerciseRow> {
  return new Map(
    exercises.map((exercise) => [exercise.exercise_id, exercise] as const),
  );
}

function buildWorkoutMap(workouts: WorkoutRow[]): Map<string, WorkoutRow> {
  return new Map(
    workouts.map((workout) => [workout.workout_id, workout] as const),
  );
}

function buildSetLogMap(setLogs: SetLogRow[]): Map<string, SetLogRow> {
  return new Map(setLogs.map((setLog) => [setLog.set_log_id, setLog] as const));
}

function buildCompletionsByWorkout(
  completions: WorkoutCompletionRow[],
): Map<string, WorkoutCompletionRow[]> {
  const completionsByWorkout = new Map<string, WorkoutCompletionRow[]>();

  for (const completion of completions) {
    const existing = completionsByWorkout.get(completion.workout_id) ?? [];
    existing.push(completion);
    completionsByWorkout.set(completion.workout_id, existing);
  }

  for (const entries of completionsByWorkout.values()) {
    entries.sort(
      (left, right) =>
        new Date(right.started_at).getTime() -
        new Date(left.started_at).getTime(),
    );
  }

  return completionsByWorkout;
}

function findMatchingCompletion(
  completions: WorkoutCompletionRow[],
  achievedAt: string,
): WorkoutCompletionRow | null {
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

function deriveWorkoutState(
  completion: Pick<WorkoutCompletionRow, "completed_at" | "was_ended_early">,
): AllWorkoutsRow["state"] {
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

function countBlocksByWorkout(blocks: WorkoutBlockRow[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const block of blocks) {
    totals.set(block.workout_id, (totals.get(block.workout_id) ?? 0) + 1);
  }

  return totals;
}

function countPrsByCompletion(
  completions: WorkoutCompletionRow[],
  workoutIdBySetLogId: Map<string, string>,
  prs: PRCountRow[],
): Map<string, number> {
  const prsByWorkoutId = new Map<string, string[]>();

  for (const pr of prs) {
    const workoutId = workoutIdBySetLogId.get(pr.set_log_id);

    if (!workoutId) {
      continue;
    }

    const existing = prsByWorkoutId.get(workoutId) ?? [];
    existing.push(pr.achieved_at);
    prsByWorkoutId.set(workoutId, existing);
  }

  const counts = new Map<string, number>();

  for (const completion of completions) {
    const achievedAtValues = prsByWorkoutId.get(completion.workout_id) ?? [];
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
      .select("set_log_id, workout_id")
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
  const workoutIds = uniqueStrings(setLogs.map((row) => row.workout_id));

  if (workoutIds.length === 0) {
    return [];
  }

  const [
    { data: completionData, error: completionError },
    { data: workoutData, error: workoutError },
  ] = await Promise.all([
    supabase
      .from("workout_completions")
      .select(
        "completion_id, workout_id, started_at, completed_at, was_ended_early, completed_block_ids",
      )
      .in("workout_id", workoutIds)
      .order("started_at", { ascending: false }),
    supabase
      .from("workouts")
      .select("workout_id, workout_name")
      .in("workout_id", workoutIds),
  ]);

  if (completionError) {
    throw new Error(
      `Failed to load workout completions for PR timeline: ${completionError.message}`,
    );
  }

  if (workoutError) {
    throw new Error(
      `Failed to load workouts for PR timeline: ${workoutError.message}`,
    );
  }

  const completions = mapWorkoutCompletionRows(completionData ?? []);
  const workouts = mapWorkoutRows(workoutData ?? []);
  const completionsByWorkout = buildCompletionsByWorkout(completions);
  const workoutMap = buildWorkoutMap(workouts);

  return prRows.flatMap<PRTimelineRow>((prRow) => {
    const exercise = exerciseMap.get(prRow.exercise_id);
    const setLog = setLogMap.get(prRow.set_log_id);

    if (!exercise || !setLog) {
      return [];
    }

    const matchingCompletion = findMatchingCompletion(
      completionsByWorkout.get(setLog.workout_id) ?? [],
      prRow.achieved_at,
    );
    const workout = matchingCompletion
      ? workoutMap.get(matchingCompletion.workout_id)
      : null;

    if (!matchingCompletion || !workout) {
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
        workout_display_name: formatWorkoutDisplayName(
          workout.workout_name,
          matchingCompletion.started_at,
        ),
      },
    ];
  });
}

export async function getAllWorkouts(): Promise<AllWorkoutsRow[]> {
  const supabase = await createClient();
  const { data: completionData, error: completionError } = await supabase
    .from("workout_completions")
    .select(
      "completion_id, workout_id, started_at, completed_at, was_ended_early, completed_block_ids",
    )
    .order("started_at", { ascending: false });

  if (completionError) {
    throw new Error(`Failed to load all workouts: ${completionError.message}`);
  }

  const completions = mapWorkoutCompletionRows(completionData ?? []);

  if (completions.length === 0) {
    return [];
  }

  const workoutIds = uniqueStrings(
    completions.map((completion) => completion.workout_id),
  );

  const [
    { data: workoutData, error: workoutError },
    { data: blockData, error: blockError },
    { data: setLogData, error: setLogError },
  ] = await Promise.all([
    supabase
      .from("workouts")
      .select("workout_id, workout_name")
      .in("workout_id", workoutIds),
    supabase
      .from("workout_blocks")
      .select("block_id, workout_id")
      .in("workout_id", workoutIds),
    supabase
      .from("set_logs")
      .select("set_log_id, workout_id")
      .in("workout_id", workoutIds),
  ]);

  if (workoutError) {
    throw new Error(`Failed to load workouts list: ${workoutError.message}`);
  }

  if (blockError) {
    throw new Error(
      `Failed to load workout block counts: ${blockError.message}`,
    );
  }

  if (setLogError) {
    throw new Error(
      `Failed to load set logs for workouts list: ${setLogError.message}`,
    );
  }

  const workouts = mapWorkoutRows(workoutData ?? []);
  const workoutBlocks = mapWorkoutBlockRows(blockData ?? []);
  const setLogs = mapSetLogRows(setLogData ?? []);
  const workoutMap = buildWorkoutMap(workouts);
  const blockCounts = countBlocksByWorkout(workoutBlocks);
  const workoutIdBySetLogId = new Map(
    setLogs.map((setLog) => [setLog.set_log_id, setLog.workout_id] as const),
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
      throw new Error(`Failed to load workout PR counts: ${prError.message}`);
    }

    prCountsByCompletion = countPrsByCompletion(
      completions,
      workoutIdBySetLogId,
      mapPRCountRows(prData ?? []),
    );
  }

  return completions.map<AllWorkoutsRow>((completion) => {
    const workout = workoutMap.get(completion.workout_id);

    if (!workout) {
      throw new Error("Missing workout row for workout completion.");
    }

    return {
      completion_id: completion.completion_id,
      workout_display_name: formatWorkoutDisplayName(
        workout.workout_name,
        completion.started_at,
      ),
      started_at: completion.started_at,
      state: deriveWorkoutState(completion),
      blocks_completed_count: completion.completed_block_ids.length,
      blocks_total_count: blockCounts.get(completion.workout_id) ?? 0,
      pr_count: prCountsByCompletion.get(completion.completion_id) ?? 0,
    };
  });
}
