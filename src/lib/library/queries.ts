import "server-only";

import type {
  CardioActivity,
  CardioBlockWithActivities,
  LiftingBlockDetail,
  LiftingBlockSummary,
  RecoveryActivity,
  RecoveryBlockWithActivities,
} from "@/lib/library/projections";
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
