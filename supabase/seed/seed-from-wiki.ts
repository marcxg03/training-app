import * as fs from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Json,
  Tables,
  TablesInsert,
} from "../../src/lib/supabase/types";
import { mergeExerciseNotes } from "../../src/lib/methodology/exercise-notes";
import { wikiPaths } from "../../src/lib/utils/wiki-paths";
import { parsePlanFromWiki } from "./lib/methodology-rules";
import { bodyweightExerciseNames } from "./lib/bodyweight-exercises";
import { createSupabaseAdminClient } from "./lib/supabase-admin";
import type {
  DayOfWeek,
  ParsedBlock,
  ParsedDaySpec,
  ParsedExerciseSpec,
  ParsedWorkoutSpec,
  TrainingPlanSpec,
  WikiFiles,
} from "./lib/types";

type AdminClient = SupabaseClient<Database>;
type TrainingPlanRow = Tables<"training_plans">;
type ScheduleRow = Tables<"daily_schedules">;
type WorkoutRow = Tables<"workouts">;
type BlockRow = Tables<"blocks">;
type ExerciseRow = Tables<"exercises">;
type BlockLiftingItemRow = Tables<"block_lifting_items">;
type CardioActivityRow = Tables<"cardio_activities">;
type RecoveryActivityRow = Tables<"recovery_activities">;
type NutritionTargetsRow = Tables<"nutrition_targets">;

type SeedSummary = {
  inserted: number;
  updated: number;
  deleted: number;
  unchanged: number;
  exercisesDeduped: number;
  warnings: string[];
};

const summary: SeedSummary = {
  inserted: 0,
  updated: 0,
  deleted: 0,
  unchanged: 0,
  exercisesDeduped: 0,
  warnings: [],
};

const dayOrder: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(
        ([key, nestedValue]) =>
          `${JSON.stringify(key)}:${stableStringify(nestedValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function equalRows(left: unknown, right: unknown) {
  return stableStringify(left) === stableStringify(right);
}

function countChange(
  kind: keyof Pick<
    SeedSummary,
    "inserted" | "updated" | "deleted" | "unchanged"
  >,
) {
  summary[kind] += 1;
}

async function readWikiFiles() {
  const entries = Object.entries(wikiPaths) as Array<
    [keyof typeof wikiPaths, string]
  >;
  const contents = await Promise.all(
    entries.map(async ([key, relativePath]) => {
      const absolutePath = path.join(process.cwd(), relativePath);

      try {
        const content = await fs.readFile(absolutePath, "utf8");
        return [key, content] as const;
      } catch {
        throw new Error(`Missing file: ${relativePath}`);
      }
    }),
  );

  return Object.fromEntries(contents) as WikiFiles;
}

async function resolveTargetUserId(supabase: AdminClient) {
  const explicitUserId = process.env.SEED_TARGET_USER_ID;

  if (explicitUserId) {
    return explicitUserId;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .limit(2);

  if (error) {
    throw new Error(
      `Could not resolve seed target user from profiles: ${error.message}`,
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Could not resolve seed target user. Set SEED_TARGET_USER_ID or create a profile row first.",
    );
  }

  if (data.length > 1) {
    throw new Error(
      "Multiple profiles exist. Set SEED_TARGET_USER_ID to choose the account to seed.",
    );
  }

  return data[0].user_id;
}

async function upsertActivePlan(
  supabase: AdminClient,
  userId: string,
  planName: string,
) {
  const { data, error } = await supabase
    .from("training_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to load training plans: ${error.message}`);
  }

  if (data.length > 1) {
    throw new Error(
      "Expected at most one active training plan for the target user.",
    );
  }

  const existingPlan = data[0];

  if (!existingPlan) {
    const insertPayload: TablesInsert<"training_plans"> = {
      user_id: userId,
      name: planName,
      is_active: true,
    };
    const { data: insertedPlan, error: insertError } = await supabase
      .from("training_plans")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      throw new Error(`Failed to insert training plan: ${insertError.message}`);
    }

    countChange("inserted");
    return insertedPlan;
  }

  const desired = {
    name: planName,
    is_active: true,
  };

  if (
    equalRows(
      { name: existingPlan.name, is_active: existingPlan.is_active },
      desired,
    )
  ) {
    countChange("unchanged");
    return existingPlan;
  }

  const { data: updatedPlan, error: updateError } = await supabase
    .from("training_plans")
    .update(desired)
    .eq("plan_id", existingPlan.plan_id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(`Failed to update training plan: ${updateError.message}`);
  }

  countChange("updated");
  return updatedPlan;
}

async function syncSchedules(
  supabase: AdminClient,
  planId: string,
  days: ParsedDaySpec[],
) {
  const { data, error } = await supabase
    .from("daily_schedules")
    .select("*")
    .eq("plan_id", planId);

  if (error) {
    throw new Error(`Failed to load schedules: ${error.message}`);
  }

  const existingByDay = new Map(data.map((row) => [row.day_of_week, row]));
  const scheduleByDay = new Map<DayOfWeek, ScheduleRow>();

  for (const day of days) {
    const existing = existingByDay.get(day.dayOfWeek);
    const desired = {
      plan_id: planId,
      day_of_week: day.dayOfWeek,
      is_rest_day: day.isRestDay,
    } as const;

    if (!existing) {
      const { data: insertedSchedule, error: insertError } = await supabase
        .from("daily_schedules")
        .insert(desired)
        .select("*")
        .single();

      if (insertError) {
        throw new Error(
          `Failed to insert schedule for ${day.dayLabel}: ${insertError.message}`,
        );
      }

      countChange("inserted");
      scheduleByDay.set(day.dayOfWeek, insertedSchedule);
      continue;
    }

    if (
      equalRows(
        {
          day_of_week: existing.day_of_week,
          is_rest_day: existing.is_rest_day,
          plan_id: existing.plan_id,
        },
        desired,
      )
    ) {
      countChange("unchanged");
      scheduleByDay.set(day.dayOfWeek, existing);
      continue;
    }

    const { data: updatedSchedule, error: updateError } = await supabase
      .from("daily_schedules")
      .update({ is_rest_day: desired.is_rest_day })
      .eq("schedule_id", existing.schedule_id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(
        `Failed to update schedule for ${day.dayLabel}: ${updateError.message}`,
      );
    }

    countChange("updated");
    scheduleByDay.set(day.dayOfWeek, updatedSchedule);
  }

  return scheduleByDay;
}

async function syncWorkouts(
  supabase: AdminClient,
  days: ParsedDaySpec[],
  schedules: Map<DayOfWeek, ScheduleRow>,
) {
  const scheduleIds = [...schedules.values()].map((row) => row.schedule_id);
  const { data, error } = scheduleIds.length
    ? await supabase
        .from("workouts")
        .select("*")
        .in("schedule_id", scheduleIds)
        .order("display_order")
    : { data: [], error: null };

  if (error) {
    throw new Error(`Failed to load workouts: ${error.message}`);
  }

  const existingBySchedule = new Map<string, WorkoutRow[]>();

  for (const row of data ?? []) {
    const list = existingBySchedule.get(row.schedule_id) ?? [];
    list.push(row);
    existingBySchedule.set(row.schedule_id, list);
  }

  const workoutByKey = new Map<string, WorkoutRow>();

  for (const day of days) {
    const schedule = schedules.get(day.dayOfWeek);

    if (!schedule) {
      throw new Error(`Missing schedule row for ${day.dayLabel}.`);
    }

    const existingRows = existingBySchedule.get(schedule.schedule_id) ?? [];

    for (const workout of day.workouts) {
      const existing = existingRows.find(
        (row) => row.display_order === workout.displayOrder,
      );
      const desired = {
        schedule_id: schedule.schedule_id,
        workout_type: workout.workoutType,
        workout_name: workout.workoutName,
        timing: workout.timing,
        gym: workout.gym,
        description: workout.description,
        display_order: workout.displayOrder,
        cardio_format: workout.cardioFormat,
        cardio_distance: workout.cardioDistance,
        cardio_target_zone: workout.cardioTargetZone,
      } as const;

      if (!existing) {
        const { data: insertedWorkout, error: insertError } = await supabase
          .from("workouts")
          .insert(desired)
          .select("*")
          .single();

        if (insertError) {
          throw new Error(
            `Failed to insert workout "${workout.workoutName}": ${insertError.message}`,
          );
        }

        countChange("inserted");
        workoutByKey.set(
          `${day.dayOfWeek}:${workout.displayOrder}`,
          insertedWorkout,
        );
        continue;
      }

      const comparableExisting = {
        schedule_id: existing.schedule_id,
        workout_type: existing.workout_type,
        workout_name: existing.workout_name,
        timing: existing.timing,
        gym: existing.gym,
        description: existing.description,
        display_order: existing.display_order,
        cardio_format: existing.cardio_format,
        cardio_distance: existing.cardio_distance,
        cardio_target_zone: existing.cardio_target_zone,
      };

      if (equalRows(comparableExisting, desired)) {
        countChange("unchanged");
        workoutByKey.set(`${day.dayOfWeek}:${workout.displayOrder}`, existing);
        continue;
      }

      const { data: updatedWorkout, error: updateError } = await supabase
        .from("workouts")
        .update(desired)
        .eq("workout_id", existing.workout_id)
        .select("*")
        .single();

      if (updateError) {
        throw new Error(
          `Failed to update workout "${workout.workoutName}": ${updateError.message}`,
        );
      }

      countChange("updated");
      workoutByKey.set(
        `${day.dayOfWeek}:${workout.displayOrder}`,
        updatedWorkout,
      );
    }

    const desiredOrders = new Set(
      day.workouts.map((workout) => workout.displayOrder),
    );
    const staleRows = existingRows.filter(
      (row) => !desiredOrders.has(row.display_order),
    );

    for (const staleRow of staleRows) {
      const { error: deleteError } = await supabase
        .from("workouts")
        .delete()
        .eq("workout_id", staleRow.workout_id);

      if (deleteError) {
        throw new Error(
          `Failed to delete stale workout "${staleRow.workout_name}": ${deleteError.message}`,
        );
      }

      countChange("deleted");
    }
  }

  return workoutByKey;
}

function collectExercises(liftingBlocks: ParsedBlock[]) {
  const exercisesByName = new Map<string, ParsedExerciseSpec>();

  for (const block of liftingBlocks) {
    for (const exercise of block.exercises) {
      const existing = exercisesByName.get(exercise.name);

      if (!existing) {
        exercisesByName.set(exercise.name, {
          ...exercise,
          muscleGroups: [...exercise.muscleGroups],
        });
        continue;
      }

      summary.exercisesDeduped += 1;
      // The second merge point (the first is the per-block one in
      // methodology-rules.ts). Its old `!==` guard only compared the two values
      // WHOLE, so merging an already-stuttered "Compound\nCompound" with a fresh
      // "Compound" still appended a third copy — the last step that built the
      // junk Marcus saw in the picker (T2-E). Line-level de-duplication closes
      // it for good.
      const mergedNotes = mergeExerciseNotes(existing.notes, exercise.notes);

      exercisesByName.set(exercise.name, {
        ...existing,
        notes: mergedNotes,
        prescribedMin: Math.min(existing.prescribedMin, exercise.prescribedMin),
        prescribedMax: Math.max(existing.prescribedMax, exercise.prescribedMax),
        muscleGroups: [
          ...new Set([...existing.muscleGroups, ...exercise.muscleGroups]),
        ],
        isCompound: existing.isCompound || exercise.isCompound,
      });
    }
  }

  return [...exercisesByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function syncExercises(
  supabase: AdminClient,
  userId: string,
  plan: TrainingPlanSpec,
) {
  const desiredExercises = collectExercises(plan.liftingBlocks);
  const { data: existingRows, error: loadError } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId);

  if (loadError) {
    throw new Error(`Failed to load exercises: ${loadError.message}`);
  }

  const existingByName = new Map(existingRows.map((row) => [row.name, row]));
  const upsertPayload: TablesInsert<"exercises">[] = [];

  for (const exercise of desiredExercises) {
    const desired = {
      user_id: userId,
      name: exercise.name,
      notes: exercise.notes,
      prescribed_min: exercise.prescribedMin,
      prescribed_max: exercise.prescribedMax,
      muscle_groups: exercise.muscleGroups,
      is_compound: exercise.isCompound,
    } as const;
    const existing = existingByName.get(exercise.name);

    if (!existing) {
      countChange("inserted");
      upsertPayload.push(desired);
      continue;
    }

    const comparableExisting = {
      user_id: existing.user_id,
      name: existing.name,
      notes: existing.notes,
      prescribed_min: existing.prescribed_min,
      prescribed_max: existing.prescribed_max,
      muscle_groups: existing.muscle_groups,
      is_compound: existing.is_compound,
    };

    if (equalRows(comparableExisting, desired)) {
      countChange("unchanged");
      continue;
    }

    countChange("updated");
    upsertPayload.push(desired);
  }

  if (upsertPayload.length > 0) {
    const { error: upsertError } = await supabase
      .from("exercises")
      .upsert(upsertPayload, {
        onConflict: "user_id,name",
      });

    if (upsertError) {
      throw new Error(`Failed to upsert exercises: ${upsertError.message}`);
    }
  }

  if (desiredExercises.length === 0) {
    return new Map<string, ExerciseRow>();
  }

  const { data: refreshedRows, error: refreshError } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId)
    .in(
      "name",
      desiredExercises.map((exercise) => exercise.name),
    );

  if (refreshError) {
    throw new Error(`Failed to refresh exercises: ${refreshError.message}`);
  }

  return new Map(refreshedRows.map((row) => [row.name, row] as const));
}

async function syncBodyweightExerciseFlags(
  supabase: AdminClient,
  userId: string,
  exercisesByName: Map<string, ExerciseRow>,
) {
  const namesToMark = bodyweightExerciseNames.filter((name) =>
    exercisesByName.has(name),
  );

  if (namesToMark.length === 0) {
    return exercisesByName;
  }

  const { data: existingRows, error: loadError } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId)
    .in("name", namesToMark);

  if (loadError) {
    throw new Error(
      `Failed to load bodyweight exercises for flag sync: ${loadError.message}`,
    );
  }

  const rowsToUpdate = existingRows.filter((row) => !row.is_bodyweight);

  if (rowsToUpdate.length > 0) {
    const { error: updateError } = await supabase
      .from("exercises")
      .update({ is_bodyweight: true })
      .eq("user_id", userId)
      .in(
        "exercise_id",
        rowsToUpdate.map((row) => row.exercise_id),
      );

    if (updateError) {
      throw new Error(
        `Failed to update bodyweight exercise flags: ${updateError.message}`,
      );
    }

    countChange("updated");
  }

  const allNames = [...exercisesByName.keys()];

  if (allNames.length === 0) {
    return new Map<string, ExerciseRow>();
  }

  const { data: refreshedRows, error: refreshError } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId)
    .in("name", allNames);

  if (refreshError) {
    throw new Error(
      `Failed to refresh exercises after bodyweight sync: ${refreshError.message}`,
    );
  }

  return new Map(refreshedRows.map((row) => [row.name, row] as const));
}

async function syncGlobalBlocks(
  supabase: AdminClient,
  userId: string,
  plan: TrainingPlanSpec,
) {
  const desiredBlocks: TablesInsert<"blocks">[] = [
    ...plan.liftingBlocks.map((block) => ({
      owner_user_id: userId,
      block_name: block.blockName,
      block_type: block.blockType,
      display_order: 0,
      block_category: "lifting" as const,
      // Adjustable per-block set-scheme (B1/D4/D15). Written explicitly from the
      // parsed block: for Block II most lifts are block_type='failure' (structured
      // scheme) but NOT to failure, so to_failure must be seeded false rather than
      // left to the migration-025 backfill (D11). Only e.g. Thursday dips = true.
      warmup_sets: block.warmupSets,
      working_sets: block.workingSets,
      to_failure: block.toFailure,
    })),
    {
      owner_user_id: userId,
      block_name: plan.cardioBlockName,
      block_type: null,
      display_order: 0,
      block_category: "cardio" as const,
      // Scheme is conceptually lifting-only (D12); keep cardio/recovery at the
      // column defaults so the idempotent diff stays stable across runs.
      warmup_sets: 1,
      working_sets: 2,
      to_failure: false,
    },
    {
      owner_user_id: userId,
      block_name: plan.recoveryBlockName,
      block_type: null,
      display_order: 0,
      block_category: "recovery" as const,
      warmup_sets: 1,
      working_sets: 2,
      to_failure: false,
    },
  ];

  const { data: existingRows, error: loadError } = await supabase
    .from("blocks")
    .select("*")
    .eq("owner_user_id", userId);

  if (loadError) {
    throw new Error(`Failed to load blocks: ${loadError.message}`);
  }

  const existingByName = new Map(
    existingRows.map((row) => [row.block_name, row]),
  );
  const blockByName = new Map<string, BlockRow>();

  for (const desired of desiredBlocks) {
    const existing = existingByName.get(desired.block_name);

    if (!existing) {
      const { data: insertedRow, error: insertError } = await supabase
        .from("blocks")
        .insert(desired)
        .select("*")
        .single();

      if (insertError) {
        throw new Error(
          `Failed to insert block "${desired.block_name}": ${insertError.message}`,
        );
      }

      countChange("inserted");
      blockByName.set(insertedRow.block_name, insertedRow);
      continue;
    }

    const comparableExisting = {
      owner_user_id: existing.owner_user_id,
      block_name: existing.block_name,
      block_type: existing.block_type,
      display_order: existing.display_order,
      block_category: existing.block_category,
      warmup_sets: existing.warmup_sets,
      working_sets: existing.working_sets,
      to_failure: existing.to_failure,
    };
    const comparableDesired = {
      owner_user_id: desired.owner_user_id,
      block_name: desired.block_name,
      block_type: desired.block_type,
      display_order: desired.display_order,
      block_category: desired.block_category,
      warmup_sets: desired.warmup_sets,
      working_sets: desired.working_sets,
      to_failure: desired.to_failure,
    };

    if (equalRows(comparableExisting, comparableDesired)) {
      countChange("unchanged");
      blockByName.set(existing.block_name, existing);
      continue;
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("blocks")
      .update(comparableDesired)
      .eq("block_id", existing.block_id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(
        `Failed to update block "${desired.block_name}": ${updateError.message}`,
      );
    }

    countChange("updated");
    blockByName.set(updatedRow.block_name, updatedRow);
  }

  const desiredNames = new Set(desiredBlocks.map((row) => row.block_name));
  const staleRows = existingRows.filter(
    (row) => !desiredNames.has(row.block_name),
  );

  for (const staleRow of staleRows) {
    // set_logs.block_id and workout_blocks.block_id are ON DELETE CASCADE, so
    // dropping a block here would silently destroy logged history. A block
    // renamed outside the wiki (e.g. the Chest — Round 1/2/3 merge) reads as
    // "stale" purely by name; refuse rather than cascade.
    const { count: loggedSets, error: historyError } = await supabase
      .from("set_logs")
      .select("*", { count: "exact", head: true })
      .eq("block_id", staleRow.block_id);

    if (historyError) {
      throw new Error(
        `Failed to check history for block "${staleRow.block_name}": ${historyError.message}`,
      );
    }

    if ((loggedSets ?? 0) > 0) {
      throw new Error(
        `Refusing to delete block "${staleRow.block_name}": it has ${loggedSets} logged set(s). ` +
          `Deleting it would cascade that history away. Rename it in the wiki to match, or remove it deliberately.`,
      );
    }

    const { error: deleteError } = await supabase
      .from("blocks")
      .delete()
      .eq("block_id", staleRow.block_id);

    if (deleteError) {
      throw new Error(
        `Failed to delete stale block "${staleRow.block_name}": ${deleteError.message}`,
      );
    }

    countChange("deleted");
  }

  return blockByName;
}

function getDesiredBlockLiftingItems(
  block: ParsedBlock,
  blockRow: BlockRow,
  exercisesByName: Map<string, ExerciseRow>,
) {
  return block.exercises.map((exercise) => {
    const exerciseRow = exercisesByName.get(exercise.name);

    if (!exerciseRow) {
      throw new Error(`Missing exercise row for "${exercise.name}".`);
    }

    return {
      block_id: blockRow.block_id,
      exercise_id: exerciseRow.exercise_id,
      display_order: exercise.displayOrder,
    };
  });
}

async function syncBlockLiftingItems(
  supabase: AdminClient,
  plan: TrainingPlanSpec,
  blocksByName: Map<string, BlockRow>,
  exercisesByName: Map<string, ExerciseRow>,
) {
  const allBlockIds = plan.liftingBlocks
    .map((block) => blocksByName.get(block.blockName)?.block_id)
    .filter((value): value is string => Boolean(value));

  // A block that sources its bank from another owns no items of its own (see
  // migration 024). Rebuilding one here would write rows the app never reads
  // and quietly un-merge a shared bank.
  const { data: followerRows, error: followerError } = allBlockIds.length
    ? await supabase
        .from("blocks")
        .select("block_id")
        .in("block_id", allBlockIds)
        .not("bank_source_block_id", "is", null)
    : { data: [], error: null };

  if (followerError) {
    throw new Error(`Failed to resolve shared banks: ${followerError.message}`);
  }

  const followerIds = new Set((followerRows ?? []).map((row) => row.block_id));
  const liftingBlockIds = allBlockIds.filter((id) => !followerIds.has(id));

  const { data, error } = liftingBlockIds.length
    ? await supabase
        .from("block_lifting_items")
        .select("*")
        .in("block_id", liftingBlockIds)
        .order("display_order")
    : { data: [], error: null };

  if (error) {
    throw new Error(`Failed to load block lifting items: ${error.message}`);
  }

  const existingByBlockId = new Map<string, BlockLiftingItemRow[]>();

  for (const row of data ?? []) {
    const list = existingByBlockId.get(row.block_id) ?? [];
    list.push(row);
    existingByBlockId.set(row.block_id, list);
  }

  for (const block of plan.liftingBlocks) {
    const blockRow = blocksByName.get(block.blockName);

    if (!blockRow) {
      throw new Error(`Missing block row for "${block.blockName}".`);
    }

    const desiredRows = getDesiredBlockLiftingItems(
      block,
      blockRow,
      exercisesByName,
    );
    const existingRows = existingByBlockId.get(blockRow.block_id) ?? [];

    if (
      equalRows(
        existingRows.map((row) => ({
          block_id: row.block_id,
          exercise_id: row.exercise_id,
          display_order: row.display_order,
        })),
        desiredRows,
      )
    ) {
      countChange("unchanged");
      continue;
    }

    if (existingRows.length > 0) {
      const { error: deleteError } = await supabase
        .from("block_lifting_items")
        .delete()
        .eq("block_id", blockRow.block_id);

      if (deleteError) {
        throw new Error(
          `Failed to delete lifting items for "${block.blockName}": ${deleteError.message}`,
        );
      }

      countChange("deleted");
    }

    const { error: insertError } = await supabase
      .from("block_lifting_items")
      .insert(desiredRows);

    if (insertError) {
      throw new Error(
        `Failed to insert lifting items for "${block.blockName}": ${insertError.message}`,
      );
    }

    countChange("inserted");
  }
}

async function syncCardioActivities(
  supabase: AdminClient,
  userId: string,
  plan: TrainingPlanSpec,
) {
  const desiredActivities = plan.cardioActivities.map((activity) => ({
    owner_user_id: userId,
    name: activity.name,
    cardio_format: activity.cardioFormat,
    cardio_distance: activity.cardioDistance,
    cardio_target_zone: activity.cardioTargetZone,
    description: activity.description,
  }));

  const { data: existingRows, error: loadError } = await supabase
    .from("cardio_activities")
    .select("*")
    .eq("owner_user_id", userId);

  if (loadError) {
    throw new Error(`Failed to load cardio activities: ${loadError.message}`);
  }

  const existingByName = new Map(existingRows.map((row) => [row.name, row]));
  const activityByName = new Map<string, CardioActivityRow>();

  for (const desired of desiredActivities) {
    const existing = existingByName.get(desired.name);

    if (!existing) {
      const { data: insertedRow, error: insertError } = await supabase
        .from("cardio_activities")
        .insert(desired)
        .select("*")
        .single();

      if (insertError) {
        throw new Error(
          `Failed to insert cardio activity "${desired.name}": ${insertError.message}`,
        );
      }

      countChange("inserted");
      activityByName.set(insertedRow.name, insertedRow);
      continue;
    }

    const comparableExisting = {
      owner_user_id: existing.owner_user_id,
      name: existing.name,
      cardio_format: existing.cardio_format,
      cardio_distance: existing.cardio_distance,
      cardio_target_zone: existing.cardio_target_zone,
      description: existing.description,
    };

    if (equalRows(comparableExisting, desired)) {
      countChange("unchanged");
      activityByName.set(existing.name, existing);
      continue;
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("cardio_activities")
      .update(desired)
      .eq("activity_id", existing.activity_id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(
        `Failed to update cardio activity "${desired.name}": ${updateError.message}`,
      );
    }

    countChange("updated");
    activityByName.set(updatedRow.name, updatedRow);
  }

  const desiredNames = new Set(desiredActivities.map((row) => row.name));
  const staleRows = existingRows.filter((row) => !desiredNames.has(row.name));

  for (const staleRow of staleRows) {
    const { error: deleteError } = await supabase
      .from("cardio_activities")
      .delete()
      .eq("activity_id", staleRow.activity_id);

    if (deleteError) {
      throw new Error(
        `Failed to delete stale cardio activity "${staleRow.name}": ${deleteError.message}`,
      );
    }

    countChange("deleted");
  }

  return activityByName;
}

async function syncRecoveryActivities(
  supabase: AdminClient,
  userId: string,
  plan: TrainingPlanSpec,
) {
  const desiredActivities = plan.recoveryActivities.map((activity) => ({
    owner_user_id: userId,
    name: activity.name,
    description: activity.description,
  }));

  const { data: existingRows, error: loadError } = await supabase
    .from("recovery_activities")
    .select("*")
    .eq("owner_user_id", userId);

  if (loadError) {
    throw new Error(`Failed to load recovery activities: ${loadError.message}`);
  }

  const existingByName = new Map(existingRows.map((row) => [row.name, row]));
  const activityByName = new Map<string, RecoveryActivityRow>();

  for (const desired of desiredActivities) {
    const existing = existingByName.get(desired.name);

    if (!existing) {
      const { data: insertedRow, error: insertError } = await supabase
        .from("recovery_activities")
        .insert(desired)
        .select("*")
        .single();

      if (insertError) {
        throw new Error(
          `Failed to insert recovery activity "${desired.name}": ${insertError.message}`,
        );
      }

      countChange("inserted");
      activityByName.set(insertedRow.name, insertedRow);
      continue;
    }

    const comparableExisting = {
      owner_user_id: existing.owner_user_id,
      name: existing.name,
      description: existing.description,
    };

    if (equalRows(comparableExisting, desired)) {
      countChange("unchanged");
      activityByName.set(existing.name, existing);
      continue;
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("recovery_activities")
      .update(desired)
      .eq("activity_id", existing.activity_id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(
        `Failed to update recovery activity "${desired.name}": ${updateError.message}`,
      );
    }

    countChange("updated");
    activityByName.set(updatedRow.name, updatedRow);
  }

  const desiredNames = new Set(desiredActivities.map((row) => row.name));
  const staleRows = existingRows.filter((row) => !desiredNames.has(row.name));

  for (const staleRow of staleRows) {
    const { error: deleteError } = await supabase
      .from("recovery_activities")
      .delete()
      .eq("activity_id", staleRow.activity_id);

    if (deleteError) {
      throw new Error(
        `Failed to delete stale recovery activity "${staleRow.name}": ${deleteError.message}`,
      );
    }

    countChange("deleted");
  }

  return activityByName;
}

async function syncBlockCardioItems(
  supabase: AdminClient,
  cardioBlock: BlockRow,
  cardioActivities: CardioActivityRow[],
) {
  const desiredRows = cardioActivities.map((activity, index) => ({
    block_id: cardioBlock.block_id,
    activity_id: activity.activity_id,
    display_order: index,
  }));
  const { data: existingRows, error: loadError } = await supabase
    .from("block_cardio_items")
    .select("*")
    .eq("block_id", cardioBlock.block_id)
    .order("display_order");

  if (loadError) {
    throw new Error(`Failed to load block cardio items: ${loadError.message}`);
  }

  if (
    equalRows(
      existingRows.map((row) => ({
        block_id: row.block_id,
        activity_id: row.activity_id,
        display_order: row.display_order,
      })),
      desiredRows,
    )
  ) {
    countChange("unchanged");
    return;
  }

  if (existingRows.length > 0) {
    const { error: deleteError } = await supabase
      .from("block_cardio_items")
      .delete()
      .eq("block_id", cardioBlock.block_id);

    if (deleteError) {
      throw new Error(
        `Failed to delete cardio items for "${cardioBlock.block_name}": ${deleteError.message}`,
      );
    }

    countChange("deleted");
  }

  if (desiredRows.length > 0) {
    const { error: insertError } = await supabase
      .from("block_cardio_items")
      .insert(desiredRows);

    if (insertError) {
      throw new Error(
        `Failed to insert cardio items for "${cardioBlock.block_name}": ${insertError.message}`,
      );
    }

    countChange("inserted");
  }
}

async function syncBlockRecoveryItems(
  supabase: AdminClient,
  recoveryBlock: BlockRow,
  recoveryActivities: RecoveryActivityRow[],
) {
  const desiredRows = recoveryActivities.map((activity, index) => ({
    block_id: recoveryBlock.block_id,
    activity_id: activity.activity_id,
    display_order: index,
  }));
  const { data: existingRows, error: loadError } = await supabase
    .from("block_recovery_items")
    .select("*")
    .eq("block_id", recoveryBlock.block_id)
    .order("display_order");

  if (loadError) {
    throw new Error(
      `Failed to load block recovery items: ${loadError.message}`,
    );
  }

  if (
    equalRows(
      existingRows.map((row) => ({
        block_id: row.block_id,
        activity_id: row.activity_id,
        display_order: row.display_order,
      })),
      desiredRows,
    )
  ) {
    countChange("unchanged");
    return;
  }

  if (existingRows.length > 0) {
    const { error: deleteError } = await supabase
      .from("block_recovery_items")
      .delete()
      .eq("block_id", recoveryBlock.block_id);

    if (deleteError) {
      throw new Error(
        `Failed to delete recovery items for "${recoveryBlock.block_name}": ${deleteError.message}`,
      );
    }

    countChange("deleted");
  }

  if (desiredRows.length > 0) {
    const { error: insertError } = await supabase
      .from("block_recovery_items")
      .insert(desiredRows);

    if (insertError) {
      throw new Error(
        `Failed to insert recovery items for "${recoveryBlock.block_name}": ${insertError.message}`,
      );
    }

    countChange("inserted");
  }
}

async function syncWorkoutBlocks(
  supabase: AdminClient,
  plan: TrainingPlanSpec,
  workouts: Map<string, WorkoutRow>,
  blocksByName: Map<string, BlockRow>,
  cardioActivitiesByName: Map<string, CardioActivityRow>,
  recoveryActivitiesByName: Map<string, RecoveryActivityRow>,
) {
  const workoutIds = [...workouts.values()].map((row) => row.workout_id);
  const { data, error } = workoutIds.length
    ? await supabase
        .from("workout_blocks")
        .select("*")
        .in("workout_id", workoutIds)
        .order("display_order")
    : { data: [], error: null };

  if (error) {
    throw new Error(`Failed to load workout_blocks rows: ${error.message}`);
  }

  const existingByWorkoutId = new Map<string, Tables<"workout_blocks">[]>();

  for (const row of data ?? []) {
    const list = existingByWorkoutId.get(row.workout_id) ?? [];
    list.push(row);
    existingByWorkoutId.set(row.workout_id, list);
  }

  for (const day of plan.days) {
    for (const workout of day.workouts) {
      const workoutRow = workouts.get(
        `${day.dayOfWeek}:${workout.displayOrder}`,
      );

      if (!workoutRow) {
        throw new Error(`Missing workout row for "${workout.workoutName}".`);
      }

      const desiredRows = workout.blockRefs.map((blockRef) => {
        const blockRow = blocksByName.get(blockRef.blockName);

        if (!blockRow) {
          throw new Error(`Missing block row for "${blockRef.blockName}".`);
        }

        let presetActivityId: string | null = null;

        if (
          blockRef.presetActivityName &&
          blockRef.presetActivityType === "cardio"
        ) {
          presetActivityId =
            cardioActivitiesByName.get(blockRef.presetActivityName)
              ?.activity_id ?? null;
        }

        if (
          blockRef.presetActivityName &&
          blockRef.presetActivityType === "recovery"
        ) {
          presetActivityId =
            recoveryActivitiesByName.get(blockRef.presetActivityName)
              ?.activity_id ?? null;
        }

        if (blockRef.presetActivityName && !presetActivityId) {
          throw new Error(
            `Missing preset activity row for "${blockRef.presetActivityName}".`,
          );
        }

        return {
          workout_id: workoutRow.workout_id,
          block_id: blockRow.block_id,
          display_order: blockRef.displayOrder,
          preset_activity_id: presetActivityId,
          preset_activity_type: blockRef.presetActivityType,
        };
      });
      const existingRows = existingByWorkoutId.get(workoutRow.workout_id) ?? [];

      if (
        equalRows(
          existingRows.map((row) => ({
            workout_id: row.workout_id,
            block_id: row.block_id,
            display_order: row.display_order,
            preset_activity_id: row.preset_activity_id,
            preset_activity_type: row.preset_activity_type,
          })),
          desiredRows,
        )
      ) {
        countChange("unchanged");
        continue;
      }

      if (existingRows.length > 0) {
        const { error: deleteError } = await supabase
          .from("workout_blocks")
          .delete()
          .eq("workout_id", workoutRow.workout_id);

        if (deleteError) {
          throw new Error(
            `Failed to delete workout block rows for "${workout.workoutName}": ${deleteError.message}`,
          );
        }

        countChange("deleted");
      }

      if (desiredRows.length > 0) {
        const { error: insertError } = await supabase
          .from("workout_blocks")
          .insert(desiredRows);

        if (insertError) {
          throw new Error(
            `Failed to insert workout block rows for "${workout.workoutName}": ${insertError.message}`,
          );
        }

        countChange("inserted");
      }
    }
  }
}

async function syncNutritionTargets(
  supabase: AdminClient,
  userId: string,
  plan: TrainingPlanSpec,
) {
  const desired = {
    user_id: userId,
    cal_min: plan.nutritionTargets.calMin,
    cal_max: plan.nutritionTargets.calMax,
    protein_min_g: plan.nutritionTargets.proteinMinG,
    protein_max_g: plan.nutritionTargets.proteinMaxG,
    carbs_min_g: plan.nutritionTargets.carbsMinG,
    carbs_max_g: plan.nutritionTargets.carbsMaxG,
    fat_min_g: plan.nutritionTargets.fatMinG,
    fat_max_g: plan.nutritionTargets.fatMaxG,
  } as const;

  const { data, error } = await supabase
    .from("nutrition_targets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load nutrition targets: ${error.message}`);
  }

  if (!data) {
    const { error: insertError } = await supabase
      .from("nutrition_targets")
      .insert(desired);

    if (insertError) {
      throw new Error(
        `Failed to insert nutrition targets: ${insertError.message}`,
      );
    }

    countChange("inserted");
    return;
  }

  const comparableExisting = {
    user_id: data.user_id,
    cal_min: data.cal_min,
    cal_max: data.cal_max,
    protein_min_g: data.protein_min_g,
    protein_max_g: data.protein_max_g,
    carbs_min_g: data.carbs_min_g,
    carbs_max_g: data.carbs_max_g,
    fat_min_g: data.fat_min_g,
    fat_max_g: data.fat_max_g,
  };

  if (equalRows(comparableExisting, desired)) {
    countChange("unchanged");
    return;
  }

  const { error: updateError } = await supabase
    .from("nutrition_targets")
    .update(desired)
    .eq("target_id", data.target_id);

  if (updateError) {
    throw new Error(
      `Failed to update nutrition targets: ${updateError.message}`,
    );
  }

  countChange("updated");
}

async function syncPlanTemplate(
  supabase: AdminClient,
  userId: string,
  plan: TrainingPlanSpec,
) {
  const snapshotJson = JSON.parse(stableStringify(plan)) as Json;
  const { data, error } = await supabase
    .from("plan_templates")
    .select("*")
    .eq("owner_user_id", userId)
    .order("version", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load plan templates: ${error.message}`);
  }

  const latestTemplate = data[0];

  if (
    latestTemplate &&
    stableStringify(latestTemplate.snapshot_json) ===
      stableStringify(snapshotJson)
  ) {
    countChange("unchanged");
    return;
  }

  const nextVersion = latestTemplate ? latestTemplate.version + 1 : 1;
  const insertPayload: TablesInsert<"plan_templates"> = {
    owner_user_id: userId,
    version: nextVersion,
    is_public: false,
    snapshot_json: snapshotJson,
  };

  const { error: insertError } = await supabase
    .from("plan_templates")
    .insert(insertPayload);

  if (insertError) {
    throw new Error(
      `Failed to insert plan template snapshot: ${insertError.message}`,
    );
  }

  countChange("inserted");
}

async function syncHistoricalPrs(
  supabase: AdminClient,
  userId: string,
  plan: TrainingPlanSpec,
  exercisesByName: Map<string, ExerciseRow>,
) {
  const exerciseIds = plan.historicalPrs
    .map((pr) => exercisesByName.get(pr.exerciseName)?.exercise_id)
    .filter((value): value is string => Boolean(value));

  if (exerciseIds.length === 0) {
    return;
  }

  const { data, error } = await supabase
    .from("pr_history")
    .select("*")
    .eq("user_id", userId)
    .in("exercise_id", exerciseIds);

  if (error) {
    throw new Error(`Failed to load historical PRs: ${error.message}`);
  }

  for (const pr of plan.historicalPrs) {
    const exerciseRow = exercisesByName.get(pr.exerciseName);

    if (!exerciseRow) {
      summary.warnings.push(
        `Skipped historical PR for ${pr.exerciseName}: exercise row not found.`,
      );
      continue;
    }

    const alreadyExists = data.some(
      (row) =>
        row.exercise_id === exerciseRow.exercise_id &&
        row.pr_type === pr.prType &&
        row.weight_kg === pr.weightKg &&
        row.reps === pr.reps &&
        row.set_log_id === null,
    );

    if (alreadyExists) {
      countChange("unchanged");
      continue;
    }

    const insertPayload: TablesInsert<"pr_history"> = {
      user_id: userId,
      exercise_id: exerciseRow.exercise_id,
      set_log_id: null,
      pr_type: pr.prType,
      weight_kg: pr.weightKg,
      reps: pr.reps,
    };

    const { error: insertError } = await supabase
      .from("pr_history")
      .insert(insertPayload);

    if (insertError) {
      throw new Error(
        `Failed to insert historical PR for ${pr.exerciseName}: ${insertError.message}`,
      );
    }

    countChange("inserted");
  }
}

function printSummary(plan: TrainingPlanSpec) {
  console.log("Seed complete.");
  console.log(`Inserted: ${summary.inserted}`);
  console.log(`Updated: ${summary.updated}`);
  console.log(`Deleted: ${summary.deleted}`);
  console.log(`Unchanged: ${summary.unchanged}`);
  console.log(`Exercises deduplicated: ${summary.exercisesDeduped}`);

  if (plan.validation.softWarnings.length > 0) {
    console.log("Validation warnings:");

    for (const warning of plan.validation.softWarnings) {
      console.log(`- ${warning}`);
    }
  }

  if (summary.warnings.length > 0) {
    console.log("Seed warnings:");

    for (const warning of summary.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

async function main() {
  const supabase = createSupabaseAdminClient();
  const files = await readWikiFiles();
  const userId = await resolveTargetUserId(supabase);
  const plan = parsePlanFromWiki(files);

  const trainingPlan = await upsertActivePlan(supabase, userId, plan.name);
  const schedules = await syncSchedules(
    supabase,
    trainingPlan.plan_id,
    plan.days,
  );
  const workouts = await syncWorkouts(supabase, plan.days, schedules);
  const exercisesByName = await syncExercises(supabase, userId, plan);
  const exercisesWithBodyweightFlags = await syncBodyweightExerciseFlags(
    supabase,
    userId,
    exercisesByName,
  );
  const blocksByName = await syncGlobalBlocks(supabase, userId, plan);

  await syncBlockLiftingItems(
    supabase,
    plan,
    blocksByName,
    exercisesWithBodyweightFlags,
  );

  const cardioActivitiesByName = await syncCardioActivities(
    supabase,
    userId,
    plan,
  );
  const recoveryActivitiesByName = await syncRecoveryActivities(
    supabase,
    userId,
    plan,
  );

  const cardioBlock = blocksByName.get(plan.cardioBlockName);
  const recoveryBlock = blocksByName.get(plan.recoveryBlockName);

  if (!cardioBlock || !recoveryBlock) {
    throw new Error("Missing required cardio or recovery block rows.");
  }

  await syncBlockCardioItems(
    supabase,
    cardioBlock,
    plan.cardioActivities
      .map((activity) => cardioActivitiesByName.get(activity.name))
      .filter((value): value is CardioActivityRow => Boolean(value)),
  );

  await syncBlockRecoveryItems(
    supabase,
    recoveryBlock,
    plan.recoveryActivities
      .map((activity) => recoveryActivitiesByName.get(activity.name))
      .filter((value): value is RecoveryActivityRow => Boolean(value)),
  );

  await syncWorkoutBlocks(
    supabase,
    plan,
    workouts,
    blocksByName,
    cardioActivitiesByName,
    recoveryActivitiesByName,
  );
  await syncNutritionTargets(supabase, userId, plan);
  await syncPlanTemplate(supabase, userId, plan);
  await syncHistoricalPrs(supabase, userId, plan, exercisesWithBodyweightFlags);
  printSummary(plan);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Seed failed: ${message}`);
  process.exit(1);
});
