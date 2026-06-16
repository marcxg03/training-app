import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/settings/projections";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, bodyweight_kg, height_cm, goal_mode")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  return data;
}
