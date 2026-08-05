import { createClient } from "@/lib/supabase/server";

// Resolving a workout_blocks preset to a display name is needed by every
// surface that shows a cardio/recovery session — /today's session cards and
// /plan/[day]'s detail panel. It lives here so those two can't drift apart.

export type PresetActivityRef = {
  preset_activity_id: string | null;
  preset_activity_type: string | null;
};

function idsOfType(presets: PresetActivityRef[], type: "cardio" | "recovery") {
  return presets
    .filter(
      (preset) =>
        preset.preset_activity_id !== null &&
        preset.preset_activity_type === type,
    )
    .map((preset) => preset.preset_activity_id as string);
}

/** Maps `preset_activity_id` → activity name, across both activity catalogs.
 * Ids are globally unique (uuid PKs), so one flat map is unambiguous. */
export async function getPresetActivityNames(
  presets: PresetActivityRef[],
): Promise<Map<string, string>> {
  const cardioIds = idsOfType(presets, "cardio");
  const recoveryIds = idsOfType(presets, "recovery");

  if (cardioIds.length === 0 && recoveryIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const [
    { data: cardioActivities, error: cardioError },
    { data: recoveryActivities, error: recoveryError },
  ] = await Promise.all([
    cardioIds.length
      ? supabase
          .from("cardio_activities")
          .select("activity_id, name")
          .in("activity_id", cardioIds)
      : Promise.resolve({ data: [], error: null }),
    recoveryIds.length
      ? supabase
          .from("recovery_activities")
          .select("activity_id, name")
          .in("activity_id", recoveryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (cardioError) {
    throw new Error(`Failed to load cardio presets: ${cardioError.message}`);
  }
  if (recoveryError) {
    throw new Error(
      `Failed to load recovery presets: ${recoveryError.message}`,
    );
  }

  return new Map(
    [...(cardioActivities ?? []), ...(recoveryActivities ?? [])].map(
      (activity) => [activity.activity_id, activity.name],
    ),
  );
}
