import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

// Resolving "what exercises does this block prescribe" is not a plain lookup
// any more: a block may source its bank from another block (migration 024), so
// several slots of the same muscle group share one list. Every surface that
// shows a block's exercises — the logger, the day plan, the week plan, today's
// workout detail — goes through here so they cannot disagree.

/** Derived from the table so it cannot drift from the schema — and so it stays
 * assignable to LoggerExercise, which picks the same columns. */
export type BankExercise = Pick<
  Tables<"exercises">,
  | "exercise_id"
  | "name"
  | "notes"
  | "prescribed_min"
  | "prescribed_max"
  | "muscle_groups"
  | "is_bodyweight"
  | "media_path"
  | "media_type"
>;

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

/** block_id → the block whose `block_lifting_items` rows it actually uses.
 * A block with no `bank_source_block_id` owns its own bank. */
export async function resolveBankSources(
  blockIds: string[],
): Promise<Map<string, string>> {
  const sourceByBlockId = new Map<string, string>();

  if (blockIds.length === 0) {
    return sourceByBlockId;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocks")
    .select("block_id, bank_source_block_id")
    .in("block_id", blockIds);

  if (error) {
    throw new Error(`Failed to resolve block banks: ${error.message}`);
  }

  for (const row of data ?? []) {
    sourceByBlockId.set(row.block_id, row.bank_source_block_id ?? row.block_id);
  }

  // A block id we were not able to read (RLS, deleted) still maps to itself so
  // callers never get an undefined lookup.
  for (const blockId of blockIds) {
    if (!sourceByBlockId.has(blockId)) {
      sourceByBlockId.set(blockId, blockId);
    }
  }

  return sourceByBlockId;
}

/** Ordered exercise bank for each of `blockIds`, following shared banks.
 * Blocks sharing a source all receive the same list. */
export async function getBankExercisesByBlockId(
  blockIds: string[],
): Promise<Map<string, BankExercise[]>> {
  const byBlockId = new Map<string, BankExercise[]>();

  if (blockIds.length === 0) {
    return byBlockId;
  }

  const sourceByBlockId = await resolveBankSources(blockIds);
  const sourceIds = [...new Set(sourceByBlockId.values())];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("block_lifting_items")
    .select(
      `
        block_id,
        display_order,
        exercises!inner (
          exercise_id,
          name,
          notes,
          prescribed_min,
          prescribed_max,
          muscle_groups,
          is_bodyweight,
          media_path,
          media_type
        )
      `,
    )
    .in("block_id", sourceIds)
    .order("display_order");

  if (error) {
    throw new Error(`Failed to load block exercise bank: ${error.message}`);
  }

  const bySourceId = new Map<string, BankExercise[]>();

  for (const item of data ?? []) {
    const list = bySourceId.get(item.block_id) ?? [];

    for (const exercise of toArray(item.exercises)) {
      if (!exercise) {
        continue;
      }

      list.push({
        exercise_id: exercise.exercise_id,
        name: exercise.name,
        notes: exercise.notes,
        prescribed_min: exercise.prescribed_min,
        prescribed_max: exercise.prescribed_max,
        muscle_groups: exercise.muscle_groups,
        is_bodyweight: exercise.is_bodyweight,
        media_path: exercise.media_path,
        media_type: exercise.media_type,
      });
    }

    bySourceId.set(item.block_id, list);
  }

  for (const [blockId, sourceId] of sourceByBlockId) {
    byBlockId.set(blockId, bySourceId.get(sourceId) ?? []);
  }

  return byBlockId;
}

/** BankExercise (schema-shaped) → the shape SessionDetailPanel renders. */
export function toSessionDetailExercises(exercises: BankExercise[]) {
  return exercises.map((exercise) => ({
    exerciseId: exercise.exercise_id,
    name: exercise.name,
    notes: exercise.notes,
    muscleGroups: exercise.muscle_groups,
  }));
}
