import "server-only";

import type {
  CardioActivity,
  CardioBlockWithActivities,
  ExerciseListItem,
  LiftingBlockDetail,
  LiftingBlockSummary,
  RecoveryActivity,
  RecoveryBlockWithActivities,
  WorkoutDefDetail,
  WorkoutDefSummary,
} from "@/lib/library/projections";
import { getPrimaryMuscleGroupLabel } from "@/lib/methodology/muscle-groups";
import { createClient } from "@/lib/supabase/server";

function toRelationArray<T>(value: T | T[] | null): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export async function getLiftingBlocks(): Promise<LiftingBlockSummary[]> {
  const supabase = await createClient();
  const { data: blocks, error: blocksError } = await supabase
    .from("blocks")
    .select("block_id, block_name, block_type")
    .eq("block_category", "lifting")
    .order("block_name");

  if (blocksError) {
    throw new Error(`Failed to load lifting blocks: ${blocksError.message}`);
  }

  if (blocks.length === 0) {
    return [];
  }

  const blockIds = blocks.map((block) => block.block_id);
  const { data: items, error: itemsError } = await supabase
    .from("block_lifting_items")
    .select("block_id")
    .in("block_id", blockIds);

  if (itemsError) {
    throw new Error(`Failed to load block counts: ${itemsError.message}`);
  }

  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.block_id, (counts.get(item.block_id) ?? 0) + 1);
  }

  return blocks.flatMap<LiftingBlockSummary>((block) => {
    if (!block.block_type) {
      return [];
    }

    return [
      {
        block_id: block.block_id,
        block_name: block.block_name,
        block_type: block.block_type,
        exercise_count: counts.get(block.block_id) ?? 0,
      },
    ];
  });
}

export async function getBlockDetail(
  blockId: string,
): Promise<LiftingBlockDetail | null> {
  const supabase = await createClient();
  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("block_id, block_name, block_type")
    .eq("block_id", blockId)
    .eq("block_category", "lifting")
    .maybeSingle();

  if (blockError) {
    throw new Error(`Failed to load block detail: ${blockError.message}`);
  }

  if (!block || !block.block_type) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from("block_lifting_items")
    .select(
      `
        display_order,
        exercises!inner (
          exercise_id,
          name,
          prescribed_min,
          prescribed_max,
          muscle_groups,
          is_bodyweight,
          notes
        )
      `,
    )
    .eq("block_id", blockId)
    .order("display_order");

  if (itemsError) {
    throw new Error(`Failed to load block exercises: ${itemsError.message}`);
  }

  return {
    block_id: block.block_id,
    block_name: block.block_name,
    block_type: block.block_type,
    exercises: items.flatMap((item) =>
      toRelationArray(item.exercises).map((exercise) => ({
        exercise_id: exercise.exercise_id,
        name: exercise.name,
        prescribed_min: exercise.prescribed_min,
        prescribed_max: exercise.prescribed_max,
        muscle_groups: exercise.muscle_groups,
        is_bodyweight: exercise.is_bodyweight,
        notes: exercise.notes,
        display_order: item.display_order,
      })),
    ),
  };
}

export async function getCardioActivities(
  blockId: string,
): Promise<CardioActivity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("block_cardio_items")
    .select(
      `
        display_order,
        cardio_activities!inner (
          activity_id,
          name,
          cardio_format,
          cardio_distance,
          cardio_target_zone,
          description
        )
      `,
    )
    .eq("block_id", blockId)
    .order("display_order");

  if (error) {
    throw new Error(`Failed to load cardio activities: ${error.message}`);
  }

  return data.flatMap((item) =>
    toRelationArray(item.cardio_activities).map((activity) => ({
      activity_id: activity.activity_id,
      name: activity.name,
      cardio_format: activity.cardio_format,
      cardio_distance: activity.cardio_distance,
      cardio_target_zone: activity.cardio_target_zone,
      description: activity.description,
    })),
  );
}

export async function getRecoveryActivities(
  blockId: string,
): Promise<RecoveryActivity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("block_recovery_items")
    .select(
      `
        display_order,
        recovery_activities!inner (
          activity_id,
          name,
          description
        )
      `,
    )
    .eq("block_id", blockId)
    .order("display_order");

  if (error) {
    throw new Error(`Failed to load recovery activities: ${error.message}`);
  }

  return data.flatMap((item) =>
    toRelationArray(item.recovery_activities).map((activity) => ({
      activity_id: activity.activity_id,
      name: activity.name,
      description: activity.description,
    })),
  );
}

export async function getCardioBlock(): Promise<CardioBlockWithActivities | null> {
  const supabase = await createClient();
  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("block_id, block_name")
    .eq("block_category", "cardio")
    .maybeSingle();

  if (blockError) {
    throw new Error(`Failed to load cardio block: ${blockError.message}`);
  }

  if (!block) {
    return null;
  }

  return {
    block_id: block.block_id,
    block_name: block.block_name,
    activities: await getCardioActivities(block.block_id),
  };
}

export async function getRecoveryBlock(): Promise<RecoveryBlockWithActivities | null> {
  const supabase = await createClient();
  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("block_id, block_name")
    .eq("block_category", "recovery")
    .maybeSingle();

  if (blockError) {
    throw new Error(`Failed to load recovery block: ${blockError.message}`);
  }

  if (!block) {
    return null;
  }

  return {
    block_id: block.block_id,
    block_name: block.block_name,
    activities: await getRecoveryActivities(block.block_id),
  };
}

export async function getExercises(): Promise<ExerciseListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "exercise_id, name, muscle_groups, is_bodyweight, is_compound, prescribed_min, prescribed_max, notes",
    )
    .order("name");

  if (error) {
    throw new Error(`Failed to load exercises: ${error.message}`);
  }

  return data.map((exercise) => ({
    exercise_id: exercise.exercise_id,
    name: exercise.name,
    muscle_groups: exercise.muscle_groups,
    primary_muscle_group_label: getPrimaryMuscleGroupLabel(
      exercise.muscle_groups,
    ),
    is_bodyweight: exercise.is_bodyweight,
    is_compound: exercise.is_compound,
    prescribed_min: exercise.prescribed_min,
    prescribed_max: exercise.prescribed_max,
    notes: exercise.notes,
  }));
}

export async function getWorkoutDefs(): Promise<WorkoutDefSummary[]> {
  const supabase = await createClient();
  const { data: defs, error } = await supabase
    .from("workout_defs")
    .select("workout_def_id, name, workout_type")
    .order("name");

  if (error) {
    throw new Error(`Failed to load workouts: ${error.message}`);
  }

  if (defs.length === 0) {
    return [];
  }

  const defIds = defs.map((def) => def.workout_def_id);
  const { data: items, error: itemsError } = await supabase
    .from("workout_def_blocks")
    .select("workout_def_id")
    .in("workout_def_id", defIds);

  if (itemsError) {
    throw new Error(
      `Failed to load workout block counts: ${itemsError.message}`,
    );
  }

  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.workout_def_id, (counts.get(item.workout_def_id) ?? 0) + 1);
  }

  return defs.map((def) => ({
    workout_def_id: def.workout_def_id,
    name: def.name,
    workout_type: def.workout_type,
    block_count: counts.get(def.workout_def_id) ?? 0,
  }));
}

export async function getWorkoutDefDetail(
  workoutDefId: string,
): Promise<WorkoutDefDetail | null> {
  const supabase = await createClient();
  const { data: def, error: defError } = await supabase
    .from("workout_defs")
    .select("workout_def_id, name, workout_type")
    .eq("workout_def_id", workoutDefId)
    .maybeSingle();

  if (defError) {
    throw new Error(`Failed to load workout: ${defError.message}`);
  }

  if (!def) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from("workout_def_blocks")
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
    .eq("workout_def_id", workoutDefId)
    .order("display_order");

  if (itemsError) {
    throw new Error(`Failed to load workout blocks: ${itemsError.message}`);
  }

  // Exercise counts for each block, to mirror the lifting-block summary line.
  const blockIds = items.flatMap((item) =>
    toRelationArray(item.blocks).map((block) => block.block_id),
  );
  const exerciseCounts = new Map<string, number>();

  if (blockIds.length > 0) {
    const { data: liftingItems, error: liftingError } = await supabase
      .from("block_lifting_items")
      .select("block_id")
      .in("block_id", blockIds);

    if (liftingError) {
      throw new Error(`Failed to load block counts: ${liftingError.message}`);
    }

    for (const item of liftingItems) {
      exerciseCounts.set(
        item.block_id,
        (exerciseCounts.get(item.block_id) ?? 0) + 1,
      );
    }
  }

  return {
    workout_def_id: def.workout_def_id,
    name: def.name,
    workout_type: def.workout_type,
    blocks: items.flatMap((item) =>
      toRelationArray(item.blocks).map((block) => ({
        block_id: block.block_id,
        block_name: block.block_name,
        block_type: block.block_type,
        exercise_count: exerciseCounts.get(block.block_id) ?? 0,
        display_order: item.display_order,
      })),
    ),
  };
}

export async function getHistoricalSetLogCount(
  blockId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("set_logs")
    .select("*", { count: "exact", head: true })
    .eq("block_id", blockId);

  if (error) {
    throw new Error(`Failed to load historical set count: ${error.message}`);
  }

  return count ?? 0;
}
