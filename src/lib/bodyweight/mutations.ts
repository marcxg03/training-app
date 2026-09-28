import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { lbsToKg } from "@/lib/units";
import type { Database } from "@/lib/supabase/types";

type BrowserClient = SupabaseClient<Database>;

// Three-state result: a partial success (log written, profile sync failed)
// is ok:true WITH a warning — the caller must treat the write as real
// (refresh the chart, clear the input) and surface the warning as
// non-blocking text, not an error loop.
type LogBodyweightResult =
  | {
      ok: true;
      data: { weight_kg: number; log_date: string };
      warning?: string;
    }
  | { ok: false; error: string };

// Guardrails mirror the migration CHECK (0 < kg < 500); input is lbs.
export const BODYWEIGHT_MIN_LBS = 50;
export const BODYWEIGHT_MAX_LBS = 1000;

function translateMutationError(error: PostgrestError | null): string {
  if (error?.code === "PGRST205" || error?.code === "42P01") {
    return "Bodyweight tracking isn't set up yet — apply migration 021 first.";
  }
  if (error?.code === "23514") {
    return "That weight looks out of range — double-check the number.";
  }
  return error?.message ?? "Save failed — please retry.";
}

// Upsert today's entry (one per day; re-logging overwrites) and keep
// profiles.bodyweight_kg — the app-wide "current" value — in sync. The user
// id comes from the session, not a prop; logDate comes from the APP clock
// (server-resolved profile timezone) so bodyweight days can never disagree
// with the rest of the app — one clock everywhere.
export async function logBodyweight(
  supabase: BrowserClient,
  weightLbs: number,
  logDate: string,
): Promise<LogBodyweightResult> {
  if (
    !Number.isFinite(weightLbs) ||
    weightLbs < BODYWEIGHT_MIN_LBS ||
    weightLbs > BODYWEIGHT_MAX_LBS
  ) {
    return {
      ok: false,
      error: `Enter a weight between ${BODYWEIGHT_MIN_LBS} and ${BODYWEIGHT_MAX_LBS} lbs.`,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in — reload and try again." };
  }

  const weightKg = lbsToKg(weightLbs);

  const { error } = await supabase.from("bodyweight_logs").upsert(
    {
      user_id: user.id,
      log_date: logDate,
      weight_kg: weightKg,
      logged_at: new Date().toISOString(),
    },
    { onConflict: "user_id,log_date" },
  );

  if (error) {
    return { ok: false, error: translateMutationError(error) };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ bodyweight_kg: weightKg })
    .eq("user_id", user.id);

  return {
    ok: true,
    data: { weight_kg: weightKg, log_date: logDate },
    warning: profileError
      ? `Logged, but couldn't update your profile's current weight: ${profileError.message}`
      : undefined,
  };
}

/**
 * Re-point `profiles.bodyweight_kg` at the most recent bodyweight log.
 *
 * logBodyweight() sets the profile's "current" weight to whatever it just
 * wrote — correct when the entry is today's, WRONG once the Body control can
 * back-date (T2-C): filling in last Tuesday's missed weigh-in would otherwise
 * overwrite today's current weight with a stale number, and every surface that
 * reads profiles.bodyweight_kg would quietly regress.
 *
 * Additive on purpose — logBodyweight's signature and behaviour are untouched;
 * the caller invokes this AFTER a back-dated log to restore the invariant
 * "profiles.bodyweight_kg == the newest bodyweight_logs row". Failure is
 * non-fatal: the log itself is already saved, so this returns a warning
 * string, never an error the UI must block on.
 */
export async function syncCurrentBodyweight(
  supabase: BrowserClient,
): Promise<{ warning?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { warning: undefined };
  }

  const { data, error } = await supabase
    .from("bodyweight_logs")
    .select("weight_kg")
    .eq("user_id", user.id)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      warning: error
        ? `Saved, but couldn't refresh your current weight: ${error.message}`
        : undefined,
    };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ bodyweight_kg: data.weight_kg })
    .eq("user_id", user.id);

  return {
    warning: profileError
      ? `Saved, but couldn't refresh your current weight: ${profileError.message}`
      : undefined,
  };
}
