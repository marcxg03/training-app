import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type {
  BlockCategory,
  BlockFormValues,
  BlockType,
  CardioActivityFormValues,
  ExerciseFormValues,
  RecoveryActivityFormValues,
} from "@/lib/library/schemas";
import type { Database } from "@/lib/supabase/types";

type BrowserClient = SupabaseClient<Database>;

type MutationResult<T> = { ok: true; data: T } | { ok: false; error: string };

type BlockPayload = {
  block_name: string;
  block_category: BlockCategory;
  block_type: BlockType;
  bank: BlockFormValues["bank"];
};
type ExercisePayload = Omit<ExerciseFormValues, "own_id">;
type CardioPayload = Omit<
  CardioActivityFormValues,
  "own_id" | "cardio_format" | "cardio_target_zone"
> & {
  cardio_format: NonNullable<CardioActivityFormValues["cardio_format"]>;
  cardio_target_zone: NonNullable<
    CardioActivityFormValues["cardio_target_zone"]
  >;
};
type RecoveryPayload = Omit<RecoveryActivityFormValues, "own_id">;

function isUniqueViolation(error: PostgrestError | null): boolean {
  return error?.code === "23505";
}

function isCheckViolation(error: PostgrestError | null): boolean {
  return error?.code === "23514";
}

function isRlsDenied(error: PostgrestError | null): boolean {
  return error?.code === "42501";
}

function translateMutationError(
  error: PostgrestError | null,
  alreadyExistsMessage: string,
): string {
  if (isUniqueViolation(error)) {
    return alreadyExistsMessage;
  }

  if (isRlsDenied(error)) {
    return "You don't have permission to save this. Sign out and back in if the issue persists.";
  }

  if (isCheckViolation(error)) {
    return "Save failed — that combination of fields isn't allowed. Review your selections and retry.";
  }

  return "Save failed — please retry.";
}

function normalizeText(value: string): string {
  return value.trim();
}

async function getCurrentUserId(
  supabase: BrowserClient,
): Promise<MutationResult<string>> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, error: "Save failed — please retry." };
  }

  return { ok: true, data: user.id };
}

async function getNextBlockDisplayOrder(
  supabase: BrowserClient,
  ownerUserId: string,
  blockCategory: BlockCategory,
): Promise<MutationResult<number>> {
  const { data, error } = await supabase
    .from("blocks")
    .select("display_order")
    .eq("owner_user_id", ownerUserId)
    .eq("block_category", blockCategory)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Save failed — please retry." };
  }

  return { ok: true, data: (data?.display_order ?? -1) + 1 };
}

function toBankInsertRows(
  blockId: string,
  bank: BlockPayload["bank"],
): Database["public"]["Tables"]["block_lifting_items"]["Insert"][] {
  return bank.map((item, index) => ({
    block_id: blockId,
    exercise_id: item.exercise_id,
    display_order: index,
  }));
}

async function replaceBlockBank(
  supabase: BrowserClient,
  blockId: string,
  bank: BlockPayload["bank"],
): Promise<MutationResult<null>> {
  const { error: deleteError } = await supabase
    .from("block_lifting_items")
    .delete()
    .eq("block_id", blockId);

  if (deleteError) {
    return { ok: false, error: "Save failed — please retry." };
  }

  const rows = toBankInsertRows(blockId, bank);

  if (rows.length === 0) {
    return { ok: true, data: null };
  }

  const { error: insertError } = await supabase
    .from("block_lifting_items")
    .insert(rows);

  if (insertError) {
    return { ok: false, error: "Save failed — please retry." };
  }

  return { ok: true, data: null };
}

function blockAlreadyExistsMessage(): string {
  return "A block with this name already exists.";
}

function exerciseAlreadyExistsMessage(): string {
  return "An exercise with this name already exists.";
}

function cardioAlreadyExistsMessage(): string {
  return "A cardio activity with this name already exists.";
}

function recoveryAlreadyExistsMessage(): string {
  return "A recovery activity with this name already exists.";
}

export async function createBlock(
  supabase: BrowserClient,
  input: BlockPayload,
): Promise<
  MutationResult<{
    block_id: string;
    block_category: BlockCategory;
  }>
> {
  const userResult = await getCurrentUserId(supabase);

  if (!userResult.ok) {
    return userResult;
  }

  const displayOrderResult = await getNextBlockDisplayOrder(
    supabase,
    userResult.data,
    input.block_category,
  );

  if (!displayOrderResult.ok) {
    return displayOrderResult;
  }

  const { data, error } = await supabase
    .from("blocks")
    .insert({
      owner_user_id: userResult.data,
      block_name: normalizeText(input.block_name),
      block_category: input.block_category,
      block_type: input.block_type,
      display_order: displayOrderResult.data,
    })
    .select("block_id, block_category")
    .single();

  if (error) {
    return {
      ok: false,
      error: translateMutationError(error, blockAlreadyExistsMessage()),
    };
  }

  const bankResult = await replaceBlockBank(
    supabase,
    data.block_id,
    input.bank,
  );

  if (!bankResult.ok) {
    return bankResult;
  }

  return {
    ok: true,
    data: {
      block_id: data.block_id,
      block_category: data.block_category,
    },
  };
}

export async function updateBlock(
  supabase: BrowserClient,
  blockId: string,
  input: Pick<BlockPayload, "block_name" | "block_type" | "bank">,
): Promise<MutationResult<null>> {
  const { error } = await supabase
    .from("blocks")
    .update({
      block_name: normalizeText(input.block_name),
      block_type: input.block_type,
    })
    .eq("block_id", blockId);

  if (error) {
    return {
      ok: false,
      error: translateMutationError(error, blockAlreadyExistsMessage()),
    };
  }

  return replaceBlockBank(supabase, blockId, input.bank);
}

export async function createExercise(
  supabase: BrowserClient,
  input: ExercisePayload,
): Promise<MutationResult<{ exercise_id: string }>> {
  const userResult = await getCurrentUserId(supabase);

  if (!userResult.ok) {
    return userResult;
  }

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: userResult.data,
      name: normalizeText(input.name),
      notes: input.notes,
      prescribed_min: input.prescribed_min,
      prescribed_max: input.prescribed_max,
      muscle_groups: input.muscle_groups,
      is_bodyweight: input.is_bodyweight,
    })
    .select("exercise_id")
    .single();

  if (error) {
    return {
      ok: false,
      error: translateMutationError(error, exerciseAlreadyExistsMessage()),
    };
  }

  return { ok: true, data: { exercise_id: data.exercise_id } };
}

export async function updateExercise(
  supabase: BrowserClient,
  exerciseId: string,
  input: ExercisePayload,
): Promise<MutationResult<null>> {
  const { error } = await supabase
    .from("exercises")
    .update({
      name: normalizeText(input.name),
      notes: input.notes,
      prescribed_min: input.prescribed_min,
      prescribed_max: input.prescribed_max,
      muscle_groups: input.muscle_groups,
      is_bodyweight: input.is_bodyweight,
    })
    .eq("exercise_id", exerciseId);

  if (error) {
    return {
      ok: false,
      error: translateMutationError(error, exerciseAlreadyExistsMessage()),
    };
  }

  return { ok: true, data: null };
}

async function getNextActivityDisplayOrder(
  supabase: BrowserClient,
  table: "block_cardio_items" | "block_recovery_items",
  blockId: string,
): Promise<MutationResult<number>> {
  const { data, error } = await supabase
    .from(table)
    .select("display_order")
    .eq("block_id", blockId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Save failed — please retry." };
  }

  return { ok: true, data: (data?.display_order ?? -1) + 1 };
}

export async function createCardioActivity(
  supabase: BrowserClient,
  cardioBlockId: string,
  input: CardioPayload,
): Promise<MutationResult<{ activity_id: string }>> {
  const userResult = await getCurrentUserId(supabase);

  if (!userResult.ok) {
    return userResult;
  }

  const { data, error } = await supabase
    .from("cardio_activities")
    .insert({
      owner_user_id: userResult.data,
      name: normalizeText(input.name),
      cardio_format: input.cardio_format,
      cardio_distance: input.cardio_distance || null,
      cardio_target_zone: input.cardio_target_zone,
      description: input.description || null,
    })
    .select("activity_id")
    .single();

  if (error) {
    return {
      ok: false,
      error: translateMutationError(error, cardioAlreadyExistsMessage()),
    };
  }

  const displayOrderResult = await getNextActivityDisplayOrder(
    supabase,
    "block_cardio_items",
    cardioBlockId,
  );

  if (!displayOrderResult.ok) {
    return displayOrderResult;
  }

  const { error: linkError } = await supabase
    .from("block_cardio_items")
    .insert({
      block_id: cardioBlockId,
      activity_id: data.activity_id,
      display_order: displayOrderResult.data,
    });

  if (linkError) {
    return {
      ok: false,
      error:
        "Activity created but not yet wired to your Cardio block — retry to wire it up.",
    };
  }

  return { ok: true, data: { activity_id: data.activity_id } };
}

export async function updateCardioActivity(
  supabase: BrowserClient,
  activityId: string,
  input: CardioPayload,
): Promise<MutationResult<null>> {
  const { error } = await supabase
    .from("cardio_activities")
    .update({
      name: normalizeText(input.name),
      cardio_format: input.cardio_format,
      cardio_distance: input.cardio_distance || null,
      cardio_target_zone: input.cardio_target_zone,
      description: input.description || null,
    })
    .eq("activity_id", activityId);

  if (error) {
    return {
      ok: false,
      error: translateMutationError(error, cardioAlreadyExistsMessage()),
    };
  }

  return { ok: true, data: null };
}

export async function createRecoveryActivity(
  supabase: BrowserClient,
  recoveryBlockId: string,
  input: RecoveryPayload,
): Promise<MutationResult<{ activity_id: string }>> {
  const userResult = await getCurrentUserId(supabase);

  if (!userResult.ok) {
    return userResult;
  }

  const { data, error } = await supabase
    .from("recovery_activities")
    .insert({
      owner_user_id: userResult.data,
      name: normalizeText(input.name),
      description: input.description || null,
    })
    .select("activity_id")
    .single();

  if (error) {
    return {
      ok: false,
      error: translateMutationError(error, recoveryAlreadyExistsMessage()),
    };
  }

  const displayOrderResult = await getNextActivityDisplayOrder(
    supabase,
    "block_recovery_items",
    recoveryBlockId,
  );

  if (!displayOrderResult.ok) {
    return displayOrderResult;
  }

  const { error: linkError } = await supabase
    .from("block_recovery_items")
    .insert({
      block_id: recoveryBlockId,
      activity_id: data.activity_id,
      display_order: displayOrderResult.data,
    });

  if (linkError) {
    return {
      ok: false,
      error:
        "Activity created but not yet wired to your Recovery block — retry to wire it up.",
    };
  }

  return { ok: true, data: { activity_id: data.activity_id } };
}

export async function updateRecoveryActivity(
  supabase: BrowserClient,
  activityId: string,
  input: RecoveryPayload,
): Promise<MutationResult<null>> {
  const { error } = await supabase
    .from("recovery_activities")
    .update({
      name: normalizeText(input.name),
      description: input.description || null,
    })
    .eq("activity_id", activityId);

  if (error) {
    return {
      ok: false,
      error: translateMutationError(error, recoveryAlreadyExistsMessage()),
    };
  }

  return { ok: true, data: null };
}
