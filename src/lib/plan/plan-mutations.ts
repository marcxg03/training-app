import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database, Enums } from "@/lib/supabase/types";

type BrowserClient = SupabaseClient<Database>;

type MutationResult<T> = { ok: true; data: T } | { ok: false; error: string };

const DAYS_OF_WEEK: Enums<"day_of_week_enum">[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

function translateMutationError(error: PostgrestError | null): string {
  if (error?.code === "42501") {
    return "You don't have permission to make this change.";
  }
  if (error?.code === "23505") {
    return "A plan with that name already exists.";
  }
  return error?.message ?? "Save failed — please retry.";
}

/**
 * Creates a new plan as a 7-day rest-day skeleton. The plan is inactive unless
 * the user has no active plan (so the app always has exactly one active plan).
 */
export async function createPlan(
  supabase: BrowserClient,
  userId: string,
  name: string,
): Promise<MutationResult<{ plan_id: string }>> {
  // Only self-activate when we can confirm there is no active plan. On a count
  // error, default to NOT activating so a transient read can't steal active
  // status from the existing plan.
  const { count: activeCount, error: countError } = await supabase
    .from("training_plans")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const shouldActivate = !countError && (activeCount ?? 1) === 0;

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .insert({ user_id: userId, name: name.trim(), is_active: shouldActivate })
    .select("plan_id")
    .single();

  if (planError || !plan) {
    return { ok: false, error: translateMutationError(planError) };
  }

  const { error: scheduleError } = await supabase
    .from("daily_schedules")
    .insert(
      DAYS_OF_WEEK.map((day) => ({
        plan_id: plan.plan_id,
        day_of_week: day,
        is_rest_day: true,
      })),
    );

  if (scheduleError) {
    // Compensating delete: a plan with no schedules is unusable and a duplicate
    // name would block retry, so remove the just-created (history-free) plan.
    await supabase.from("training_plans").delete().eq("plan_id", plan.plan_id);
    return { ok: false, error: translateMutationError(scheduleError) };
  }

  return { ok: true, data: { plan_id: plan.plan_id } };
}

/** Activates one plan and deactivates the rest (exactly one active plan). */
export async function activatePlan(
  supabase: BrowserClient,
  userId: string,
  planId: string,
): Promise<MutationResult<void>> {
  const { error: deactivateError } = await supabase
    .from("training_plans")
    .update({ is_active: false })
    .eq("user_id", userId)
    .neq("plan_id", planId);

  if (deactivateError) {
    return { ok: false, error: translateMutationError(deactivateError) };
  }

  const { error: activateError } = await supabase
    .from("training_plans")
    .update({ is_active: true })
    .eq("plan_id", planId);

  if (activateError) {
    return { ok: false, error: translateMutationError(activateError) };
  }

  return { ok: true, data: undefined };
}

export async function renamePlan(
  supabase: BrowserClient,
  planId: string,
  name: string,
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from("training_plans")
    .update({ name: name.trim() })
    .eq("plan_id", planId);

  if (error) {
    return { ok: false, error: translateMutationError(error) };
  }

  return { ok: true, data: undefined };
}
