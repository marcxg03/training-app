import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { WorkoutRowValues } from "@/lib/plan/schemas";
import type { Database, Enums } from "@/lib/supabase/types";

type BrowserClient = SupabaseClient<Database>;

type MutationResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** A session inserted during a saveDay call, reported back even when a later
 * step fails so the form can adopt the id instead of re-inserting on retry. */
export type InsertedWorkout = { index: number; workout_id: string };

export type SaveDayResult =
  | { ok: true }
  | { ok: false; error: string; inserted: InsertedWorkout[] };

function translateMutationError(error: PostgrestError | null): string {
  if (error?.code === "42501") {
    return "You don't have permission to save this. Sign out and back in if the issue persists.";
  }
  if (error?.code === "23514") {
    return "Save failed — those values aren't allowed for a session.";
  }
  return error?.message ?? "Save failed — please retry.";
}

/** Re-check history client-side so a removed workout with logs is never deleted. */
async function anyHasHistory(
  supabase: BrowserClient,
  workoutIds: string[],
): Promise<boolean> {
  if (workoutIds.length === 0) {
    return false;
  }
  // All three tables FK workout_id → workouts ON DELETE CASCADE, so any of them
  // having a row means deleting the workout would silently destroy history.
  const [{ count: setCount }, { count: compCount }, { count: activityCount }] =
    await Promise.all([
      supabase
        .from("set_logs")
        .select("*", { count: "exact", head: true })
        .in("workout_id", workoutIds),
      supabase
        .from("workout_completions")
        .select("*", { count: "exact", head: true })
        .in("workout_id", workoutIds),
      supabase
        .from("activity_completions")
        .select("*", { count: "exact", head: true })
        .in("workout_id", workoutIds),
    ]);
  return (
    (setCount ?? 0) > 0 || (compCount ?? 0) > 0 || (activityCount ?? 0) > 0
  );
}

// --- Plan editor (Slice 17) ------------------------------------------------

/** Server-authoritative set of workout ids that have logged history. Used to
 * decide which snapshots must stay frozen — never trust the client's stale
 * has_history flag for that safety guarantee. */
async function workoutsWithHistory(
  supabase: BrowserClient,
  workoutIds: string[],
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (workoutIds.length === 0) {
    return ids;
  }
  const [{ data: sets }, { data: completions }, { data: activities }] =
    await Promise.all([
      supabase
        .from("set_logs")
        .select("workout_id")
        .in("workout_id", workoutIds),
      supabase
        .from("workout_completions")
        .select("workout_id")
        .in("workout_id", workoutIds),
      supabase
        .from("activity_completions")
        .select("workout_id")
        .in("workout_id", workoutIds),
    ]);
  for (const row of sets ?? []) {
    ids.add(row.workout_id);
  }
  for (const row of completions ?? []) {
    ids.add(row.workout_id);
  }
  for (const row of activities ?? []) {
    ids.add(row.workout_id);
  }
  return ids;
}

type PlanSaveRow = {
  workout_id: string | null;
  workout_def_id: string | null;
  has_history: boolean;
};

type PlanSaveDay = {
  schedule_id: string;
  is_rest_day: boolean;
  rows: PlanSaveRow[];
  removed_workout_ids: string[];
};

// Copies a workout definition's current blocks onto a scheduled workout's
// snapshot (workout_blocks). Returns an error result on failure, else null.
async function materializeBlocks(
  supabase: BrowserClient,
  workoutId: string,
  blockIds: string[],
): Promise<MutationResult<void> | null> {
  const { error: deleteError } = await supabase
    .from("workout_blocks")
    .delete()
    .eq("workout_id", workoutId);

  if (deleteError) {
    return { ok: false, error: translateMutationError(deleteError) };
  }

  if (blockIds.length === 0) {
    return null;
  }

  const rows = blockIds.map((blockId, index) => ({
    workout_id: workoutId,
    block_id: blockId,
    display_order: index,
    preset_activity_id: null,
    preset_activity_type: null,
  }));

  const { error: insertError } = await supabase
    .from("workout_blocks")
    .insert(rows);

  if (insertError) {
    return { ok: false, error: translateMutationError(insertError) };
  }

  return null;
}

/**
 * Saves the whole week. For each day: sets the rest flag, deletes removed
 * workouts (history-guarded), and upserts the rest in order. Catalog-linked
 * workouts (workout_def_id set) get their name re-synced and their blocks
 * re-materialized from the current definition — unless the workout already has
 * logged history, in which case its snapshot stays frozen. Ad-hoc workouts
 * (no def) only have their order updated.
 */
export async function savePlan(
  supabase: BrowserClient,
  days: PlanSaveDay[],
): Promise<MutationResult<void>> {
  // 1. Guard every removal up front.
  const allRemoved = days.flatMap((day) => day.removed_workout_ids);
  if (await anyHasHistory(supabase, allRemoved)) {
    return {
      ok: false,
      error: "A session with logged history can't be removed.",
    };
  }

  // 2. Resolve the definitions referenced anywhere in the payload (name, type,
  //    and ordered block ids) so assignments can be materialized.
  const defIds = [
    ...new Set(
      days.flatMap((day) =>
        day.rows
          .map((row) => row.workout_def_id)
          .filter((id): id is string => id !== null),
      ),
    ),
  ];

  const defMeta = new Map<
    string,
    { name: string; workout_type: Enums<"session_type_enum"> }
  >();
  const defBlocks = new Map<string, string[]>();

  if (defIds.length > 0) {
    const { data: defs, error: defsError } = await supabase
      .from("workout_defs")
      .select("workout_def_id, name, workout_type")
      .in("workout_def_id", defIds);
    if (defsError) {
      return { ok: false, error: translateMutationError(defsError) };
    }
    for (const def of defs ?? []) {
      defMeta.set(def.workout_def_id, {
        name: def.name,
        workout_type: def.workout_type,
      });
    }

    const { data: blocks, error: blocksError } = await supabase
      .from("workout_def_blocks")
      .select("workout_def_id, block_id, display_order")
      .in("workout_def_id", defIds)
      .order("display_order");
    if (blocksError) {
      return { ok: false, error: translateMutationError(blocksError) };
    }
    for (const block of blocks ?? []) {
      const list = defBlocks.get(block.workout_def_id) ?? [];
      list.push(block.block_id);
      defBlocks.set(block.workout_def_id, list);
    }
  }

  // Server-authoritative history check for existing catalog-linked workouts, so
  // a snapshot a session was logged against can never be overwritten. Closes the
  // load→save TOCTOU; the client's has_history is display-only (mirrors how the
  // removal path re-checks history server-side).
  const existingCatalogIds = days
    .flatMap((day) => day.rows)
    .filter((row) => row.workout_def_id !== null && row.workout_id !== null)
    .map((row) => row.workout_id)
    .filter((id): id is string => id !== null);
  const historySet = await workoutsWithHistory(supabase, existingCatalogIds);

  // 3. Apply each day.
  for (const day of days) {
    const { error: scheduleError } = await supabase
      .from("daily_schedules")
      .update({ is_rest_day: day.is_rest_day })
      .eq("schedule_id", day.schedule_id);
    if (scheduleError) {
      return { ok: false, error: translateMutationError(scheduleError) };
    }

    if (day.removed_workout_ids.length > 0) {
      const { error: deleteError } = await supabase
        .from("workouts")
        .delete()
        .in("workout_id", day.removed_workout_ids);
      if (deleteError) {
        return { ok: false, error: translateMutationError(deleteError) };
      }
    }

    for (let index = 0; index < day.rows.length; index += 1) {
      const row = day.rows[index];

      if (row.workout_id === null) {
        // New assignment from the catalog.
        if (!row.workout_def_id) {
          continue;
        }
        const def = defMeta.get(row.workout_def_id);
        if (!def) {
          continue;
        }
        // The catalog is lifting-only today, so no cardio_* fields are set and
        // the workouts cardio CHECK holds. A future cardio/recovery def would
        // need its format fields supplied here.
        const { data: inserted, error: insertError } = await supabase
          .from("workouts")
          .insert({
            schedule_id: day.schedule_id,
            workout_def_id: row.workout_def_id,
            workout_name: def.name,
            workout_type: def.workout_type,
            timing: "anytime",
            gym: null,
            display_order: index,
          })
          .select("workout_id")
          .single();
        if (insertError || !inserted) {
          return { ok: false, error: translateMutationError(insertError) };
        }
        const materializeError = await materializeBlocks(
          supabase,
          inserted.workout_id,
          defBlocks.get(row.workout_def_id) ?? [],
        );
        if (materializeError) {
          return materializeError;
        }
        continue;
      }

      // Existing workout — update order (and name for catalog-linked rows).
      const update: { display_order: number; workout_name?: string } = {
        display_order: index,
      };
      if (row.workout_def_id) {
        const def = defMeta.get(row.workout_def_id);
        if (def) {
          update.workout_name = def.name;
        }
      }
      const { error: updateError } = await supabase
        .from("workouts")
        .update(update)
        .eq("workout_id", row.workout_id);
      if (updateError) {
        return { ok: false, error: translateMutationError(updateError) };
      }

      // Re-sync blocks for catalog-linked, unlogged workouts so definition
      // edits propagate. Logged workouts keep their frozen snapshot (history
      // checked server-side, not from the client flag).
      if (row.workout_def_id && !historySet.has(row.workout_id)) {
        const materializeError = await materializeBlocks(
          supabase,
          row.workout_id,
          defBlocks.get(row.workout_def_id) ?? [],
        );
        if (materializeError) {
          return materializeError;
        }
      }
    }
  }

  return { ok: true, data: undefined };
}

export async function saveDay(
  supabase: BrowserClient,
  input: {
    schedule_id: string;
    is_rest_day: boolean;
    workouts: WorkoutRowValues[];
    removed_workout_ids: string[];
  },
): Promise<SaveDayResult> {
  // 1. Guard: never delete a workout that has logged history (FK cascade would
  //    silently drop set_logs / completions).
  if (await anyHasHistory(supabase, input.removed_workout_ids)) {
    return {
      ok: false,
      error: "A session with logged history can't be removed.",
      inserted: [],
    };
  }

  const inserted: InsertedWorkout[] = [];

  // 2. Rest-day flag.
  const { error: scheduleError } = await supabase
    .from("daily_schedules")
    .update({ is_rest_day: input.is_rest_day })
    .eq("schedule_id", input.schedule_id);

  if (scheduleError) {
    return {
      ok: false,
      error: translateMutationError(scheduleError),
      inserted,
    };
  }

  // 3. Deletes (history-free; cascades workout_blocks only).
  if (input.removed_workout_ids.length > 0) {
    const { error: deleteError } = await supabase
      .from("workouts")
      .delete()
      .in("workout_id", input.removed_workout_ids);
    if (deleteError) {
      return {
        ok: false,
        error: translateMutationError(deleteError),
        inserted,
      };
    }
  }

  // 4. Updates (existing) + inserts (new sessions). display_order is renormalised
  //    to the row index. Existing rows keep their type/cardio fields (the update
  //    never touches them). New rows carry the type the user picked; a cardio row
  //    also carries its format (the schema guarantees a new cardio row has one, so
  //    the workouts cardio CHECK — cardio ⇒ format NOT NULL, non-cardio ⇒ all
  //    cardio_* NULL — always holds).
  // Server-authoritative history check, mirroring savePlan: a session that has
  // been logged keeps its block snapshot frozen. `history/queries.ts` reports
  // blocks_completed_count from the frozen completed_block_ids but
  // blocks_total_count from LIVE workout_blocks, so rewriting a logged
  // session's blocks retroactively corrupts every past completion of it
  // ("3/2 blocks"). Never trust the client's display-only has_history flag.
  const historySet = await workoutsWithHistory(
    supabase,
    input.workouts
      .map((row) => row.workout_id)
      .filter((id): id is string => id !== null),
  );

  for (let index = 0; index < input.workouts.length; index += 1) {
    const row = input.workouts[index];
    const gym = row.gym.trim();
    let workoutId = row.workout_id;

    if (workoutId) {
      const { error } = await supabase
        .from("workouts")
        .update({
          workout_name: row.workout_name.trim(),
          timing: row.timing,
          gym: gym.length > 0 ? gym : null,
          display_order: index,
        })
        .eq("workout_id", workoutId);
      if (error) {
        return {
          ok: false,
          error: translateMutationError(error),
          inserted,
        };
      }
    } else {
      const isCardio = row.workout_type === "cardio";
      // .select() so the new id is available to sync this session's blocks
      // below — without it a newly added session could never gain content.
      const { data: insertedRow, error } = await supabase
        .from("workouts")
        .insert({
          schedule_id: input.schedule_id,
          workout_name: row.workout_name.trim(),
          workout_type: row.workout_type,
          cardio_format: isCardio ? row.cardio_format : null,
          timing: row.timing,
          gym: gym.length > 0 ? gym : null,
          display_order: index,
        })
        .select("workout_id")
        .single();
      if (error) {
        return { ok: false, error: translateMutationError(error), inserted };
      }
      workoutId = insertedRow.workout_id;
      // Reported back even on a later failure so the form can adopt the id;
      // otherwise a retry re-inserts and the day ends up with duplicates.
      inserted.push({ index, workout_id: workoutId });
    }

    // 5. Session content (workout_blocks membership + preset activity).
    const blocksResult = await syncSessionBlocks(
      supabase,
      workoutId,
      row,
      blocksLockReason(row, historySet),
    );
    if (!blocksResult.ok) {
      return { ok: false, error: blocksResult.error, inserted };
    }
  }

  return { ok: true };
}

/** Why this session's blocks may not be rewritten here, or null if they may.
 *
 * Two owners other than this editor: a logged session's snapshot is frozen
 * history, and a catalog-linked session's blocks belong to its workout
 * definition (savePlan re-materializes them, so an edit here would be silently
 * reverted). The UI renders both read-only; this is the server enforcing it. */
export function blocksLockReason(
  row: WorkoutRowValues,
  historySet: Set<string>,
): { reason: string } | null {
  if (row.workout_id && historySet.has(row.workout_id)) {
    return {
      reason: `"${row.workout_name.trim()}" has logged history, so its blocks are frozen. Edit the blocks in the Library instead.`,
    };
  }

  if (row.workout_def_id) {
    return {
      reason: `"${row.workout_name.trim()}" comes from the workout catalog — edit its blocks in the Library.`,
    };
  }

  return null;
}

/** Replaces a session's `workout_blocks` membership with `row.blocks`, in order.
 *
 * No-ops when the stored membership already matches. That matters: the rewrite
 * is delete-then-insert (not transactional, matching the Library's updateBlock
 * idiom), so re-running it on every save would put a session's whole block list
 * at risk every time the user merely renamed a session.
 *
 * `locked` sessions never have their blocks rewritten — see saveDay. A locked
 * session whose submitted blocks differ from storage means the client was
 * working from a stale snapshot, so it errors instead of silently winning. */
async function syncSessionBlocks(
  supabase: BrowserClient,
  workoutId: string,
  row: WorkoutRowValues,
  locked: { reason: string } | null,
): Promise<MutationResult<void>> {
  const presetType = row.workout_type === "lifting" ? null : row.workout_type;

  const { data: current, error: readError } = await supabase
    .from("workout_blocks")
    .select("block_id, display_order, preset_activity_id")
    .eq("workout_id", workoutId)
    .order("display_order");

  if (readError) {
    return { ok: false, error: translateMutationError(readError) };
  }

  const signature = (
    rows: Array<{ block_id: string; preset_activity_id: string | null }>,
  ) => rows.map((r) => `${r.block_id}:${r.preset_activity_id ?? ""}`).join("|");

  const unchanged = signature(current ?? []) === signature(row.blocks);

  if (unchanged) {
    return { ok: true, data: undefined };
  }

  if (locked) {
    return { ok: false, error: locked.reason };
  }

  const { error: deleteError } = await supabase
    .from("workout_blocks")
    .delete()
    .eq("workout_id", workoutId);

  if (deleteError) {
    return { ok: false, error: translateMutationError(deleteError) };
  }

  if (row.blocks.length === 0) {
    return { ok: true, data: undefined };
  }

  const { error: insertError } = await supabase.from("workout_blocks").insert(
    row.blocks.map((block, blockIndex) => ({
      workout_id: workoutId,
      block_id: block.block_id,
      display_order: blockIndex,
      // The table's CHECK requires both preset columns set or both NULL.
      preset_activity_id: presetType ? block.preset_activity_id : null,
      preset_activity_type:
        presetType && block.preset_activity_id ? presetType : null,
    })),
  );

  if (insertError) {
    return { ok: false, error: translateMutationError(insertError) };
  }

  return { ok: true, data: undefined };
}
