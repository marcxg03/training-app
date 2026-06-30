"use server";

// =============================================================================
// Coaching mutations (server actions). Each returns { ok, data?, error? } to
// match the app-wide mutation contract (REDESIGN_BRIEF §9.1). Coaching tables
// are written with the session client; RLS enforces that the caller is the
// coach (or, for client-authored notes, the client) of the relationship.
// =============================================================================

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { CoachGoalMode } from "@/lib/coach/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Returns the relationship row if the caller is its coach, else null. */
async function requireCoachRelationship(relationshipId: string) {
  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) {
    return null;
  }
  const { data } = await supabase
    .from("coach_clients")
    .select("relationship_id, coach_user_id")
    .eq("relationship_id", relationshipId)
    .eq("coach_user_id", userId)
    .maybeSingle();
  return data;
}

export type OnboardClientInput = {
  name: string;
  email: string;
  goalMode: CoachGoalMode | null;
};

export async function onboardClient(
  input: OnboardClientInput,
): Promise<ActionResult<{ relationshipId: string }>> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data, error } = await supabase
    .from("coach_clients")
    .insert({
      coach_user_id: userId,
      invite_email: email,
      invite_name: input.name.trim() || null,
      goal_mode: input.goalMode,
      status: "invited",
    })
    .select("relationship_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "You've already invited this email." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/coach");
  return { ok: true, data: { relationshipId: data.relationship_id } };
}

export async function addCoachNote(
  relationshipId: string,
  body: string,
): Promise<ActionResult<{ noteId: string }>> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, error: "Note can't be empty." };
  }

  const relationship = await requireCoachRelationship(relationshipId);
  if (!relationship) {
    return { ok: false, error: "Client not found." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_notes")
    .insert({
      relationship_id: relationshipId,
      author: "coach",
      body: trimmed,
      client_visible: true,
    })
    .select("note_id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/coach/clients/${relationshipId}/notes`);
  revalidatePath(`/coach/clients/${relationshipId}`);
  return { ok: true, data: { noteId: data.note_id } };
}

/** Client-authored reply to their coach (from the My Coach screen). */
export async function addClientNote(
  body: string,
): Promise<ActionResult<{ noteId: string }>> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, error: "Message can't be empty." };
  }

  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: rel, error: relError } = await supabase
    .from("coach_clients")
    .select("relationship_id")
    .eq("client_user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (relError) {
    return { ok: false, error: relError.message };
  }
  if (!rel) {
    return { ok: false, error: "You don't have a coach yet." };
  }

  const { data, error } = await supabase
    .from("coach_notes")
    .insert({
      relationship_id: rel.relationship_id,
      author: "client",
      body: trimmed,
      client_visible: true,
    })
    .select("note_id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/coach/my-coach");
  return { ok: true, data: { noteId: data.note_id } };
}

export type SaveClientTargetsInput = {
  relationshipId: string;
  goalMode: CoachGoalMode;
  calMin: number;
  calMax: number;
  proteinMinG: number;
  proteinMaxG: number;
  carbsMinG: number;
  carbsMaxG: number;
  fatMinG: number;
  fatMaxG: number;
};

export async function saveClientTargets(
  input: SaveClientTargetsInput,
): Promise<ActionResult> {
  const relationship = await requireCoachRelationship(input.relationshipId);
  if (!relationship) {
    return { ok: false, error: "Client not found." };
  }

  const ranges: [number, number][] = [
    [input.calMin, input.calMax],
    [input.proteinMinG, input.proteinMaxG],
    [input.carbsMinG, input.carbsMaxG],
    [input.fatMinG, input.fatMaxG],
  ];
  for (const [min, max] of ranges) {
    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min < 0 ||
      max < min
    ) {
      return { ok: false, error: "Each range needs a valid min ≤ max." };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("coach_client_targets").upsert(
    {
      relationship_id: input.relationshipId,
      goal_mode: input.goalMode,
      cal_min: Math.round(input.calMin),
      cal_max: Math.round(input.calMax),
      protein_min_g: Math.round(input.proteinMinG),
      protein_max_g: Math.round(input.proteinMaxG),
      carbs_min_g: Math.round(input.carbsMinG),
      carbs_max_g: Math.round(input.carbsMaxG),
      fat_min_g: Math.round(input.fatMinG),
      fat_max_g: Math.round(input.fatMaxG),
    },
    { onConflict: "relationship_id" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/coach/clients/${input.relationshipId}`);
  revalidatePath(`/coach/clients/${input.relationshipId}/targets`);
  return { ok: true };
}

export async function assignTraining(
  relationshipId: string,
  planId: string | null,
): Promise<ActionResult> {
  const relationship = await requireCoachRelationship(relationshipId);
  if (!relationship) {
    return { ok: false, error: "Client not found." };
  }

  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) {
    return { ok: false, error: "You must be signed in." };
  }

  let planName: string | null = null;
  if (planId) {
    const { data: plan, error: planError } = await supabase
      .from("training_plans")
      .select("name")
      .eq("plan_id", planId)
      .eq("user_id", userId)
      .maybeSingle();
    if (planError) {
      return { ok: false, error: planError.message };
    }
    if (!plan) {
      return { ok: false, error: "Plan not found in your library." };
    }
    planName = plan.name;
  }

  const { error } = await supabase
    .from("coach_clients")
    .update({ assigned_plan_id: planId, assigned_plan_name: planName })
    .eq("relationship_id", relationshipId)
    .eq("coach_user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/coach/clients/${relationshipId}`);
  revalidatePath(`/coach/clients/${relationshipId}/assign`);
  return { ok: true };
}

/**
 * Link any pending invites addressed to the signed-in user's email to their
 * account (called when a coached athlete opens their coach view). Safe no-op
 * when there are none.
 */
export async function acceptPendingInvites(): Promise<
  ActionResult<{ linked: number }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("link_pending_coach_invites");
  if (error) {
    return { ok: false, error: error.message };
  }
  if ((data ?? 0) > 0) {
    revalidatePath("/coach/my-coach");
  }
  return { ok: true, data: { linked: data ?? 0 } };
}
