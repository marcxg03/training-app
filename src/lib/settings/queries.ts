import { DEFAULT_APP_TIMEZONE } from "@/lib/time/appDay";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/settings/projections";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    display_name: data.display_name,
    bodyweight_kg: data.bodyweight_kg,
    height_cm: data.height_cm,
    goal_mode: data.goal_mode,
    // Pre-migration-022 rows have no timezone column; fall back rather than
    // 500 the settings page in the deploy-before-migration window.
    timezone: data.timezone ?? DEFAULT_APP_TIMEZONE,
  };
}
