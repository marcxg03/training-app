import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { WorkoutRowValues } from "@/lib/plan/schemas";
import type { Database } from "@/lib/supabase/types";

type BrowserClient = SupabaseClient<Database>;

type MutationResult<T> = { ok: true; data: T } | { ok: false; error: string };

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

export async function saveDay(
  supabase: BrowserClient,
  input: {
    schedule_id: string;
    is_rest_day: boolean;
    workouts: WorkoutRowValues[];
    removed_workout_ids: string[];
  },
): Promise<MutationResult<void>> {
  // 1. Guard: never delete a workout that has logged history (FK cascade would
  //    silently drop set_logs / completions).
  if (await anyHasHistory(supabase, input.removed_workout_ids)) {
    return {
      ok: false,
      error: "A session with logged history can't be removed.",
    };
  }

  // 2. Rest-day flag.
  const { error: scheduleError } = await supabase
    .from("daily_schedules")
    .update({ is_rest_day: input.is_rest_day })
    .eq("schedule_id", input.schedule_id);

  if (scheduleError) {
    return { ok: false, error: translateMutationError(scheduleError) };
  }

  // 3. Deletes (history-free; cascades workout_blocks only).
  if (input.removed_workout_ids.length > 0) {
    const { error: deleteError } = await supabase
      .from("workouts")
      .delete()
      .in("workout_id", input.removed_workout_ids);
    if (deleteError) {
      return { ok: false, error: translateMutationError(deleteError) };
    }
  }

  // 4. Updates (existing) + inserts (new lifting sessions). display_order is
  //    renormalised to the row index. workout_type is preserved on updates and
  //    is always "lifting" for inserts, so the cardio CHECK can't be violated.
  for (let index = 0; index < input.workouts.length; index += 1) {
    const row = input.workouts[index];
    const gym = row.gym.trim();

    if (row.workout_id) {
      const { error } = await supabase
        .from("workouts")
        .update({
          workout_name: row.workout_name.trim(),
          timing: row.timing,
          gym: gym.length > 0 ? gym : null,
          display_order: index,
        })
        .eq("workout_id", row.workout_id);
      if (error) {
        return { ok: false, error: translateMutationError(error) };
      }
    } else {
      const { error } = await supabase.from("workouts").insert({
        schedule_id: input.schedule_id,
        workout_name: row.workout_name.trim(),
        workout_type: "lifting",
        timing: row.timing,
        gym: gym.length > 0 ? gym : null,
        display_order: index,
      });
      if (error) {
        return { ok: false, error: translateMutationError(error) };
      }
    }
  }

  return { ok: true, data: undefined };
}
