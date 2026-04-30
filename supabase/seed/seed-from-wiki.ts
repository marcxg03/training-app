import * as fs from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Json,
  Tables,
  TablesInsert,
} from "../../src/lib/supabase/types";
import { wikiPaths } from "../../src/lib/utils/wiki-paths";
import { parsePlanFromWiki } from "./lib/methodology-rules";
import { createSupabaseAdminClient } from "./lib/supabase-admin";
import type {
  DayOfWeek,
  ParsedBlock,
  ParsedDaySpec,
  ParsedExerciseSpec,
  ParsedSessionSpec,
  TrainingPlanSpec,
  WikiFiles,
} from "./lib/types";

type AdminClient = SupabaseClient<Database>;
type TrainingPlanRow = Tables<"training_plans">;
type ScheduleRow = Tables<"daily_schedules">;
type SessionRow = Tables<"sessions">;
type BlockRow = Tables<"blocks">;
type ExerciseRow = Tables<"exercises">;
type BlockExerciseRow = Tables<"block_exercises">;
type NutritionTargetsRow = Tables<"nutrition_targets">;
type PlanTemplateRow = Tables<"plan_templates">;
type PRHistoryRow = Tables<"pr_history">;

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
      .sort(([a], [b]) => a.localeCompare(b));

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
      .update({
        is_rest_day: desired.is_rest_day,
      })
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

async function syncSessions(
  supabase: AdminClient,
  days: ParsedDaySpec[],
  schedules: Map<DayOfWeek, ScheduleRow>,
) {
  const scheduleIds = [...schedules.values()].map((row) => row.schedule_id);
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .in("schedule_id", scheduleIds)
    .order("display_order");

  if (error) {
    throw new Error(`Failed to load sessions: ${error.message}`);
  }

  const existingBySchedule = new Map<string, SessionRow[]>();

  for (const row of data) {
    const list = existingBySchedule.get(row.schedule_id) ?? [];
    list.push(row);
    existingBySchedule.set(row.schedule_id, list);
  }

  const sessionByKey = new Map<string, SessionRow>();

  for (const day of days) {
    const schedule = schedules.get(day.dayOfWeek);

    if (!schedule) {
      throw new Error(`Missing schedule row for ${day.dayLabel}.`);
    }

    const existingRows = existingBySchedule.get(schedule.schedule_id) ?? [];

    for (const session of day.sessions) {
      const existing = existingRows.find(
        (row) => row.display_order === session.displayOrder,
      );
      const desired = {
        schedule_id: schedule.schedule_id,
        session_type: session.sessionType,
        session_name: session.sessionName,
        timing: session.timing,
        gym: session.gym,
        description: session.description,
        display_order: session.displayOrder,
        cardio_format: session.cardioFormat,
        cardio_distance: session.cardioDistance,
        cardio_target_zone: session.cardioTargetZone,
      } as const;

      if (!existing) {
        const { data: insertedSession, error: insertError } = await supabase
          .from("sessions")
          .insert(desired)
          .select("*")
          .single();

        if (insertError) {
          throw new Error(
            `Failed to insert session "${session.sessionName}": ${insertError.message}`,
          );
        }

        countChange("inserted");
        sessionByKey.set(
          `${day.dayOfWeek}:${session.displayOrder}`,
          insertedSession,
        );
        continue;
      }

      const comparableExisting = {
        schedule_id: existing.schedule_id,
        session_type: existing.session_type,
        session_name: existing.session_name,
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
        sessionByKey.set(`${day.dayOfWeek}:${session.displayOrder}`, existing);
        continue;
      }

      const { data: updatedSession, error: updateError } = await supabase
        .from("sessions")
        .update(desired)
        .eq("session_id", existing.session_id)
        .select("*")
        .single();

      if (updateError) {
        throw new Error(
          `Failed to update session "${session.sessionName}": ${updateError.message}`,
        );
      }

      countChange("updated");
      sessionByKey.set(
        `${day.dayOfWeek}:${session.displayOrder}`,
        updatedSession,
      );
    }

    const desiredOrders = new Set(
      day.sessions.map((session) => session.displayOrder),
    );
    const staleRows = existingRows.filter(
      (row) => !desiredOrders.has(row.display_order),
    );

    for (const staleRow of staleRows) {
      const { error: deleteError } = await supabase
        .from("sessions")
        .delete()
        .eq("session_id", staleRow.session_id);

      if (deleteError) {
        throw new Error(
          `Failed to delete stale session "${staleRow.session_name}": ${deleteError.message}`,
        );
      }

      countChange("deleted");
    }
  }

  return sessionByKey;
}

async function syncBlocks(
  supabase: AdminClient,
  days: ParsedDaySpec[],
  sessions: Map<string, SessionRow>,
) {
  const liftingSessionIds = [...sessions.values()]
    .filter((row) => row.session_type === "lifting")
    .map((row) => row.session_id);

  const { data, error } = liftingSessionIds.length
    ? await supabase
        .from("blocks")
        .select("*")
        .in("session_id", liftingSessionIds)
        .order("display_order")
    : { data: [], error: null };

  if (error) {
    throw new Error(`Failed to load blocks: ${error.message}`);
  }

  const existingBySession = new Map<string, BlockRow[]>();

  for (const row of data ?? []) {
    const list = existingBySession.get(row.session_id) ?? [];
    list.push(row);
    existingBySession.set(row.session_id, list);
  }

  const blockByKey = new Map<string, BlockRow>();

  for (const day of days) {
    for (const session of day.sessions.filter(
      (entry) => entry.sessionType === "lifting",
    )) {
      const sessionRow = sessions.get(
        `${day.dayOfWeek}:${session.displayOrder}`,
      );

      if (!sessionRow) {
        throw new Error(
          `Missing session row for ${day.dayLabel} ${session.sessionName}.`,
        );
      }

      const existingRows = existingBySession.get(sessionRow.session_id) ?? [];

      for (const block of session.blocks) {
        const existing = existingRows.find(
          (row) => row.display_order === block.displayOrder,
        );
        const desired = {
          session_id: sessionRow.session_id,
          block_name: block.blockName,
          block_type: block.blockType,
          display_order: block.displayOrder,
        } as const;

        if (!existing) {
          const { data: insertedBlock, error: insertError } = await supabase
            .from("blocks")
            .insert(desired)
            .select("*")
            .single();

          if (insertError) {
            throw new Error(
              `Failed to insert block "${block.blockName}": ${insertError.message}`,
            );
          }

          countChange("inserted");
          blockByKey.set(
            `${sessionRow.session_id}:${block.displayOrder}`,
            insertedBlock,
          );
          continue;
        }

        const comparableExisting = {
          session_id: existing.session_id,
          block_name: existing.block_name,
          block_type: existing.block_type,
          display_order: existing.display_order,
        };

        if (equalRows(comparableExisting, desired)) {
          countChange("unchanged");
          blockByKey.set(
            `${sessionRow.session_id}:${block.displayOrder}`,
            existing,
          );
          continue;
        }

        const { data: updatedBlock, error: updateError } = await supabase
          .from("blocks")
          .update(desired)
          .eq("block_id", existing.block_id)
          .select("*")
          .single();

        if (updateError) {
          throw new Error(
            `Failed to update block "${block.blockName}": ${updateError.message}`,
          );
        }

        countChange("updated");
        blockByKey.set(
          `${sessionRow.session_id}:${block.displayOrder}`,
          updatedBlock,
        );
      }

      const desiredOrders = new Set(
        session.blocks.map((block) => block.displayOrder),
      );
      const staleRows = existingRows.filter(
        (row) => !desiredOrders.has(row.display_order),
      );

      for (const staleRow of staleRows) {
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
    }
  }

  return blockByKey;
}

function collectExercises(days: ParsedDaySpec[]) {
  const exercisesByName = new Map<string, ParsedExerciseSpec>();

  for (const day of days) {
    for (const session of day.sessions) {
      for (const block of session.blocks) {
        for (const exercise of block.exercises) {
          const existing = exercisesByName.get(exercise.name);

          if (existing) {
            summary.exercisesDeduped += 1;
            const mergedNotes =
              exercise.notes &&
              existing.notes &&
              exercise.notes !== existing.notes
                ? `${existing.notes}\n${exercise.notes}`
                : existing.notes || exercise.notes;

            exercisesByName.set(exercise.name, {
              ...existing,
              notes: mergedNotes.trim(),
              prescribedMin: Math.min(
                existing.prescribedMin,
                exercise.prescribedMin,
              ),
              prescribedMax: Math.max(
                existing.prescribedMax,
                exercise.prescribedMax,
              ),
              muscleGroups: [
                ...new Set([
                  ...existing.muscleGroups,
                  ...exercise.muscleGroups,
                ]),
              ],
              isCompound: existing.isCompound || exercise.isCompound,
            });
            continue;
          }

          exercisesByName.set(exercise.name, {
            ...exercise,
            muscleGroups: [...exercise.muscleGroups],
          });
        }
      }
    }
  }

  return [...exercisesByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function syncExercises(
  supabase: AdminClient,
  userId: string,
  days: ParsedDaySpec[],
) {
  const desiredExercises = collectExercises(days);

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

  return new Map(refreshedRows.map((row) => [row.name, row]));
}

function getDesiredBlockExerciseRows(
  block: ParsedBlock,
  blockRow: BlockRow,
  exercisesByName: Map<string, ExerciseRow>,
) {
  return block.exercises.map((exercise, index) => {
    const exerciseRow = exercisesByName.get(exercise.name);

    if (!exerciseRow) {
      throw new Error(`Missing exercise row for "${exercise.name}".`);
    }

    return {
      block_id: blockRow.block_id,
      exercise_id: exerciseRow.exercise_id,
      display_order: index,
    };
  });
}

async function syncBlockExercises(
  supabase: AdminClient,
  days: ParsedDaySpec[],
  sessions: Map<string, SessionRow>,
  blocks: Map<string, BlockRow>,
  exercisesByName: Map<string, ExerciseRow>,
) {
  const blockIds = [...blocks.values()].map((row) => row.block_id);
  const { data, error } = blockIds.length
    ? await supabase
        .from("block_exercises")
        .select("*")
        .in("block_id", blockIds)
        .order("display_order")
    : { data: [], error: null };

  if (error) {
    throw new Error(`Failed to load block exercise rows: ${error.message}`);
  }

  const existingByBlock = new Map<string, BlockExerciseRow[]>();

  for (const row of data ?? []) {
    const list = existingByBlock.get(row.block_id) ?? [];
    list.push(row);
    existingByBlock.set(row.block_id, list);
  }

  for (const day of days) {
    for (const session of day.sessions.filter(
      (entry) => entry.sessionType === "lifting",
    )) {
      const sessionRow = sessions.get(
        `${day.dayOfWeek}:${session.displayOrder}`,
      );

      if (!sessionRow) {
        throw new Error(
          `Missing session row for ${day.dayLabel} ${session.sessionName}.`,
        );
      }

      for (const block of session.blocks) {
        const blockRow = blocks.get(
          `${sessionRow.session_id}:${block.displayOrder}`,
        );

        if (!blockRow) {
          throw new Error(`Missing block row for "${block.blockName}".`);
        }

        const desiredRows = getDesiredBlockExerciseRows(
          block,
          blockRow,
          exercisesByName,
        );
        const existingRows = existingByBlock.get(blockRow.block_id) ?? [];

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
            .from("block_exercises")
            .delete()
            .eq("block_id", blockRow.block_id);

          if (deleteError) {
            throw new Error(
              `Failed to delete block exercise rows for "${block.blockName}": ${deleteError.message}`,
            );
          }

          countChange("deleted");
        }

        const { error: insertError } = await supabase
          .from("block_exercises")
          .insert(desiredRows);

        if (insertError) {
          throw new Error(
            `Failed to insert block exercise rows for "${block.blockName}": ${insertError.message}`,
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
  const sessions = await syncSessions(supabase, plan.days, schedules);
  const blocks = await syncBlocks(supabase, plan.days, sessions);
  const exercisesByName = await syncExercises(supabase, userId, plan.days);

  await syncBlockExercises(
    supabase,
    plan.days,
    sessions,
    blocks,
    exercisesByName,
  );
  await syncNutritionTargets(supabase, userId, plan);
  await syncPlanTemplate(supabase, userId, plan);
  await syncHistoricalPrs(supabase, userId, plan, exercisesByName);
  printSummary(plan);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Seed failed: ${message}`);
  process.exit(1);
});
