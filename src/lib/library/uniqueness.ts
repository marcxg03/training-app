import { createClient } from "@/lib/supabase/client";

type NameConflictArgs =
  | {
      table: "blocks";
      name: string;
      ownId?: string;
    }
  | {
      table: "exercises";
      name: string;
      ownId?: string;
    }
  | {
      table: "cardio_activities";
      name: string;
      ownId?: string;
    }
  | {
      table: "recovery_activities";
      name: string;
      ownId?: string;
    };

export async function nameConflicts(args: NameConflictArgs): Promise<boolean> {
  const normalizedName = args.name.trim();

  if (!normalizedName) {
    return false;
  }

  const supabase = createClient();

  if (args.table === "blocks") {
    let query = supabase
      .from("blocks")
      .select("block_id")
      .eq("block_name", normalizedName)
      .limit(2);

    if (args.ownId) {
      query = query.neq("block_id", args.ownId);
    }

    const { data, error } = await query;

    return !error && (data?.length ?? 0) > 0;
  }

  if (args.table === "exercises") {
    let query = supabase
      .from("exercises")
      .select("exercise_id")
      .eq("name", normalizedName)
      .limit(2);

    if (args.ownId) {
      query = query.neq("exercise_id", args.ownId);
    }

    const { data, error } = await query;

    return !error && (data?.length ?? 0) > 0;
  }

  if (args.table === "cardio_activities") {
    let query = supabase
      .from("cardio_activities")
      .select("activity_id")
      .eq("name", normalizedName)
      .limit(2);

    if (args.ownId) {
      query = query.neq("activity_id", args.ownId);
    }

    const { data, error } = await query;

    return !error && (data?.length ?? 0) > 0;
  }

  let query = supabase
    .from("recovery_activities")
    .select("activity_id")
    .eq("name", normalizedName)
    .limit(2);

  if (args.ownId) {
    query = query.neq("activity_id", args.ownId);
  }

  const { data, error } = await query;

  return !error && (data?.length ?? 0) > 0;
}
