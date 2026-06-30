import { formatWorkoutDisplayName } from "@/lib/history/displayName";
import type {
  AllWorkoutsRow,
  CompletedSession,
  CompletedSessionGroup,
  CompletedSessionSet,
  ExerciseProgression,
  ExerciseProgressionPoint,
  ExerciseProgressionPR,
  PRTimelineRow,
} from "@/lib/history/projections";
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

function getNullableNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Expected ${key} to be a nullable number.`);
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

type ExerciseSetLogRow = {
  set_log_id: string;
  block_id: string;
  exercise_id: string;
  weight_kg: number | null;
  reps: number;
  is_to_failure: boolean;
  logged_at: string;
  set_index: number;
};

type ExercisePrRow = {
  pr_id: string;
  pr_type: "weight" | "in_range_rep";
  weight_kg: number;
  reps: number;
  achieved_at: string;
  set_log_id: string | null;
};

type BlockNameRow = {
  block_id: string;
  block_name: string;
};

function mapExerciseSetLogRows(data: unknown): ExerciseSetLogRow[] {
  return assertRecordArray(data, "exercise set log").map((record) => ({
    set_log_id: getString(record, "set_log_id"),
    block_id: getString(record, "block_id"),
    exercise_id: getString(record, "exercise_id"),
    weight_kg: getNullableNumber(record, "weight_kg"),
    reps: getNumber(record, "reps"),
    is_to_failure: getBoolean(record, "is_to_failure"),
    logged_at: getString(record, "logged_at"),
    set_index: getNumber(record, "set_index"),
  }));
}

function mapExercisePrRows(data: unknown): ExercisePrRow[] {
  return assertRecordArray(data, "exercise PR").map((record) => ({
    pr_id: getString(record, "pr_id"),
    pr_type: getPrType(record, "pr_type"),
    weight_kg: getNumber(record, "weight_kg"),
    reps: getNumber(record, "reps"),
    achieved_at: getString(record, "achieved_at"),
    set_log_id: getNullableString(record, "set_log_id"),
  }));
}

function mapBlockNameRows(data: unknown): BlockNameRow[] {
  return assertRecordArray(data, "block").map((record) => ({
    block_id: getString(record, "block_id"),
    block_name: getString(record, "block_name"),
  }));
}

function compareLoggedAtAscending(
  left: { logged_at: string; set_index: number },
  right: { logged_at: string; set_index: number },
): number {
  const delta =
    new Date(left.logged_at).getTime() - new Date(right.logged_at).getTime();

  if (delta !== 0) {
    return delta;
  }

  return left.set_index - right.set_index;
}

function pickBestWeightPr(
  prs: ExerciseProgressionPR[],
): ExerciseProgressionPR | null {
  return prs
    .filter((pr) => pr.pr_type === "weight")
    .reduce<ExerciseProgressionPR | null>((best, pr) => {
      if (!best || pr.weight_kg > best.weight_kg) {
        return pr;
      }

      return best;
    }, null);
}

function pickBestInRangePr(
  prs: ExerciseProgressionPR[],
): ExerciseProgressionPR | null {
  return prs
    .filter((pr) => pr.pr_type === "in_range_rep")
    .reduce<ExerciseProgressionPR | null>((best, pr) => {
      if (
        !best ||
        pr.reps > best.reps ||
        (pr.reps === best.reps && pr.weight_kg > best.weight_kg)
      ) {
        return pr;
      }

      return best;
    }, null);
}

export async function getExerciseProgression(
  exerciseId: string,
): Promise<ExerciseProgression | null> {
  const supabase = await createClient();

  const [
    { data: exerciseData, error: exerciseError },
    { data: setLogData, error: setLogError },
    { data: prData, error: prError },
  ] = await Promise.all([
    supabase
      .from("exercises")
      .select("exercise_id, name, is_bodyweight")
      .eq("exercise_id", exerciseId)
      .maybeSingle(),
    supabase
      .from("set_logs")
      .select(
        "set_log_id, block_id, exercise_id, weight_kg, reps, is_to_failure, logged_at, set_index",
      )
      .eq("exercise_id", exerciseId)
      .order("logged_at", { ascending: true })
      .order("set_index", { ascending: true }),
    supabase
      .from("pr_history")
      .select("pr_id, pr_type, weight_kg, reps, achieved_at, set_log_id")
      .eq("exercise_id", exerciseId)
      .order("achieved_at", { ascending: false }),
  ]);

  if (exerciseError) {
    throw new Error(
      `Failed to load exercise for progression: ${exerciseError.message}`,
    );
  }

  if (exerciseData === null || !isRecord(exerciseData)) {
    return null;
  }

  if (setLogError) {
    throw new Error(
      `Failed to load set logs for progression: ${setLogError.message}`,
    );
  }

  if (prError) {
    throw new Error(`Failed to load PRs for progression: ${prError.message}`);
  }

  const exercise = mapExerciseRows([exerciseData])[0];

  if (!exercise) {
    return null;
  }

  const setLogs = mapExerciseSetLogRows(setLogData ?? []);
  const prRows = mapExercisePrRows(prData ?? []);
  const prSetLogIds = new Set(
    prRows.map((pr) => pr.set_log_id).filter((id): id is string => id !== null),
  );

  const prs: ExerciseProgressionPR[] = prRows.map((pr) => ({
    pr_id: pr.pr_id,
    pr_type: pr.pr_type,
    weight_kg: pr.weight_kg,
    reps: pr.reps,
    achieved_at: pr.achieved_at,
  }));

  const ascendingSets = [...setLogs].sort(compareLoggedAtAscending);

  // Top set per workout-day (calendar date), heaviest weight wins, for the chart.
  const topSetByDay = new Map<string, ExerciseSetLogRow>();

  for (const setLog of ascendingSets) {
    const dayKey = setLog.logged_at.slice(0, 10);
    const existing = topSetByDay.get(dayKey);
    const existingWeight = existing?.weight_kg ?? -Infinity;
    const candidateWeight = setLog.weight_kg ?? -Infinity;

    if (!existing || candidateWeight > existingWeight) {
      topSetByDay.set(dayKey, setLog);
    }
  }

  const topSets: ExerciseProgressionPoint[] = Array.from(topSetByDay.values())
    .sort(compareLoggedAtAscending)
    .map((setLog) => ({
      set_log_id: setLog.set_log_id,
      logged_at: setLog.logged_at,
      weight_kg: setLog.weight_kg,
      reps: setLog.reps,
      is_to_failure: setLog.is_to_failure,
      is_pr: prSetLogIds.has(setLog.set_log_id),
    }));

  const recentSets: ExerciseProgressionPoint[] = [...setLogs]
    .sort((left, right) => compareLoggedAtAscending(right, left))
    .map((setLog) => ({
      set_log_id: setLog.set_log_id,
      logged_at: setLog.logged_at,
      weight_kg: setLog.weight_kg,
      reps: setLog.reps,
      is_to_failure: setLog.is_to_failure,
      is_pr: prSetLogIds.has(setLog.set_log_id),
    }));

  return {
    exercise_id: exercise.exercise_id,
    exercise_name: exercise.name,
    is_bodyweight: exercise.is_bodyweight,
    best_weight_pr: pickBestWeightPr(prs),
    best_in_range_pr: pickBestInRangePr(prs),
    prs,
    top_sets: topSets,
    recent_sets: recentSets,
  };
}

export async function getCompletedSession(
  completionId: string,
): Promise<CompletedSession | null> {
  const supabase = await createClient();

  const { data: completionData, error: completionError } = await supabase
    .from("workout_completions")
    .select(
      "completion_id, workout_id, started_at, completed_at, was_ended_early, completed_block_ids",
    )
    .eq("completion_id", completionId)
    .maybeSingle();

  if (completionError) {
    throw new Error(
      `Failed to load completed session: ${completionError.message}`,
    );
  }

  if (completionData === null || !isRecord(completionData)) {
    return null;
  }

  const completion = mapWorkoutCompletionRows([completionData])[0];

  if (!completion) {
    return null;
  }

  const [
    { data: workoutData, error: workoutError },
    { data: blockData, error: blockError },
    { data: setLogData, error: setLogError },
  ] = await Promise.all([
    supabase
      .from("workouts")
      .select("workout_id, workout_name")
      .eq("workout_id", completion.workout_id)
      .maybeSingle(),
    supabase
      .from("workout_blocks")
      .select("block_id, workout_id")
      .eq("workout_id", completion.workout_id),
    supabase
      .from("set_logs")
      .select(
        "set_log_id, block_id, exercise_id, weight_kg, reps, is_to_failure, logged_at, set_index",
      )
      .eq("workout_id", completion.workout_id)
      .order("logged_at", { ascending: true })
      .order("set_index", { ascending: true }),
  ]);

  if (workoutError) {
    throw new Error(
      `Failed to load workout for completed session: ${workoutError.message}`,
    );
  }

  if (workoutData === null || !isRecord(workoutData)) {
    return null;
  }

  if (blockError) {
    throw new Error(
      `Failed to load blocks for completed session: ${blockError.message}`,
    );
  }

  if (setLogError) {
    throw new Error(
      `Failed to load set logs for completed session: ${setLogError.message}`,
    );
  }

  const workout = mapWorkoutRows([workoutData])[0];

  if (!workout) {
    return null;
  }

  const workoutBlocks = mapWorkoutBlockRows(blockData ?? []);
  const setLogs = mapExerciseSetLogRows(setLogData ?? []);

  const exerciseIds = uniqueStrings(setLogs.map((row) => row.exercise_id));
  const blockIds = uniqueStrings(setLogs.map((row) => row.block_id));
  const setLogIds = uniqueStrings(setLogs.map((row) => row.set_log_id));

  const [
    { data: exerciseData, error: exerciseError },
    { data: blockNameData, error: blockNameError },
    prResult,
  ] = await Promise.all([
    exerciseIds.length > 0
      ? supabase
          .from("exercises")
          .select("exercise_id, name, is_bodyweight")
          .in("exercise_id", exerciseIds)
      : Promise.resolve({ data: [], error: null }),
    blockIds.length > 0
      ? supabase
          .from("blocks")
          .select("block_id, block_name")
          .in("block_id", blockIds)
      : Promise.resolve({ data: [], error: null }),
    setLogIds.length > 0
      ? supabase
          .from("pr_history")
          .select("pr_id, pr_type, weight_kg, reps, achieved_at, set_log_id")
          .in("set_log_id", setLogIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (exerciseError) {
    throw new Error(
      `Failed to load exercises for completed session: ${exerciseError.message}`,
    );
  }

  if (blockNameError) {
    throw new Error(
      `Failed to load block names for completed session: ${blockNameError.message}`,
    );
  }

  if (prResult.error) {
    throw new Error(
      `Failed to load PRs for completed session: ${prResult.error.message}`,
    );
  }

  const exercises = mapExerciseRows(exerciseData ?? []);
  const blockNames = mapBlockNameRows(blockNameData ?? []);
  const prRows = mapExercisePrRows(prResult.data ?? []);

  const exerciseMap = buildExerciseMap(exercises);
  const blockNameMap = new Map(
    blockNames.map((block) => [block.block_id, block.block_name] as const),
  );
  const prBySetLogId = new Map(
    prRows
      .filter((pr) => pr.set_log_id !== null)
      .map((pr) => [pr.set_log_id as string, pr] as const),
  );
  const blockOrder = new Map(
    workoutBlocks.map((block, index) => [block.block_id, index] as const),
  );

  const groupMap = new Map<string, CompletedSessionGroup>();
  let totalVolume = 0;

  for (const setLog of setLogs) {
    const groupKey = `${setLog.block_id}:${setLog.exercise_id}`;
    const exercise = exerciseMap.get(setLog.exercise_id);
    const pr = prBySetLogId.get(setLog.set_log_id) ?? null;

    if (setLog.weight_kg !== null) {
      totalVolume += setLog.weight_kg * setLog.reps;
    }

    const setEntry: CompletedSessionSet = {
      set_log_id: setLog.set_log_id,
      set_index: setLog.set_index,
      weight_kg: setLog.weight_kg,
      reps: setLog.reps,
      is_to_failure: setLog.is_to_failure,
      is_pr: pr !== null,
      pr_type: pr?.pr_type ?? null,
    };

    const existing = groupMap.get(groupKey);

    if (existing) {
      existing.sets.push(setEntry);
    } else {
      groupMap.set(groupKey, {
        block_id: setLog.block_id,
        block_name: blockNameMap.get(setLog.block_id) ?? "Block",
        exercise_id: setLog.exercise_id,
        exercise_name: exercise?.name ?? "Exercise",
        sets: [setEntry],
      });
    }
  }

  const groups = Array.from(groupMap.values()).sort((left, right) => {
    const leftOrder = blockOrder.get(left.block_id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder =
      blockOrder.get(right.block_id) ?? Number.MAX_SAFE_INTEGER;

    return leftOrder - rightOrder;
  });

  for (const group of groups) {
    group.sets.sort((left, right) => left.set_index - right.set_index);
  }

  // Count every PR row (a single set can earn both a weight and an in-range
  // rep PR). This matches getAllWorkouts' pr_history-row counting so the
  // all-workouts list and this session-detail header agree.
  const prCount = prRows.length;

  const durationSeconds =
    completion.completed_at === null
      ? null
      : Math.max(
          0,
          Math.round(
            (new Date(completion.completed_at).getTime() -
              new Date(completion.started_at).getTime()) /
              1000,
          ),
        );

  return {
    completion_id: completion.completion_id,
    workout_display_name: formatWorkoutDisplayName(
      workout.workout_name,
      completion.started_at,
    ),
    workout_name: workout.workout_name,
    started_at: completion.started_at,
    completed_at: completion.completed_at,
    state: deriveWorkoutState(completion),
    duration_seconds: durationSeconds,
    total_volume_kg: totalVolume,
    pr_count: prCount,
    set_count: setLogs.length,
    blocks_completed_count: completion.completed_block_ids.length,
    blocks_total_count: workoutBlocks.length,
    groups,
  };
}
