import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { macroCalories } from "@/lib/methodology/nutrition";
import type {
  MealFormValues,
  TargetsFormValues,
} from "@/lib/nutrition/schemas";
import type { Database } from "@/lib/supabase/types";

type BrowserClient = SupabaseClient<Database>;

type MutationResult<T> = { ok: true; data: T } | { ok: false; error: string };

function translateMutationError(error: PostgrestError | null): string {
  if (error?.code === "42501") {
    return "You don't have permission to save this. Sign out and back in if the issue persists.";
  }
  if (error?.code === "23514") {
    return "Save failed — those values aren't allowed (check that each maximum is above its minimum).";
  }
  if (error?.code === "23505") {
    return "That entry already exists — reload and try again.";
  }
  return error?.message ?? "Save failed — please retry.";
}

export async function logMeal(
  supabase: BrowserClient,
  userId: string,
  date: string,
  input: MealFormValues,
): Promise<MutationResult<{ meal_id: string }>> {
  const calories = macroCalories(input.protein_g, input.carbs_g, input.fat_g);
  const note = input.note.trim();

  const { data, error } = await supabase
    .from("meal_entries")
    .insert({
      user_id: userId,
      date,
      meal_type: input.meal_type.trim(),
      protein_g: input.protein_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
      calories,
      note: note.length > 0 ? note : null,
    })
    .select("meal_id")
    .single();

  if (error || !data) {
    return { ok: false, error: translateMutationError(error) };
  }

  return { ok: true, data: { meal_id: data.meal_id } };
}

export async function upsertTargets(
  supabase: BrowserClient,
  userId: string,
  input: TargetsFormValues,
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from("nutrition_targets")
    .upsert({ user_id: userId, ...input }, { onConflict: "user_id" });

  if (error) {
    return { ok: false, error: translateMutationError(error) };
  }

  return { ok: true, data: undefined };
}
