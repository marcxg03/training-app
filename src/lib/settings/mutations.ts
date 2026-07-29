import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { ProfileFormValues } from "@/lib/settings/schemas";
import type { Database } from "@/lib/supabase/types";

type BrowserClient = SupabaseClient<Database>;

type MutationResult<T> =
  | { ok: true; data: T; warning?: string }
  | { ok: false; error: string };

function translateMutationError(error: PostgrestError | null): string {
  if (error?.code === "42501") {
    return "You don't have permission to save this. Sign out and back in if the issue persists.";
  }
  if (error?.code === "23514") {
    return "Save failed — those values aren't allowed.";
  }
  if (error?.code === "23505") {
    return "That entry already exists — reload and try again.";
  }
  return error?.message ?? "Save failed — please retry.";
}

export async function updateProfile(
  supabase: BrowserClient,
  userId: string,
  input: ProfileFormValues,
): Promise<MutationResult<void>> {
  const displayName = input.display_name.trim();
  const row = {
    user_id: userId,
    display_name: displayName.length > 0 ? displayName : null,
    bodyweight_kg: input.bodyweight_kg,
    height_cm: input.height_cm,
    goal_mode: input.goal_mode,
  };

  const { error } = await supabase
    .from("profiles")
    .upsert({ ...row, timezone: input.timezone }, { onConflict: "user_id" });

  if (error) {
    // Pre-migration-022 the timezone column doesn't exist (PGRST204). Save
    // the rest of the profile rather than bricking the settings form.
    if (error.code === "PGRST204") {
      const { error: retryError } = await supabase
        .from("profiles")
        .upsert(row, { onConflict: "user_id" });

      if (retryError) {
        return { ok: false, error: translateMutationError(retryError) };
      }

      // Everything except timezone saved. Say so — a silent ok here means
      // the user's timezone choice evaporates when migration 022 lands.
      return {
        ok: true,
        data: undefined,
        warning:
          "Saved — except timezone: apply migration 022 first, then set it again.",
      };
    }

    return { ok: false, error: translateMutationError(error) };
  }

  return { ok: true, data: undefined };
}
