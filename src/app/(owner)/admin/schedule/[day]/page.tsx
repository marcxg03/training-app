import { redirect } from "next/navigation";

import { requireOwner } from "@/lib/auth/requireOwner";
import { createClient } from "@/lib/supabase/server";

/**
 * /admin/schedule/<day> — a REDIRECT (T3-C). See ./page.tsx.
 *
 * The member plan day card links here, so it forwards into the active
 * program's day editor rather than breaking.
 */
export default async function ScheduleDayRedirectPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const ownerId = await requireOwner();
  const { day } = await params;
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("training_plans")
    .select("plan_id")
    .eq("user_id", ownerId)
    .eq("is_active", true)
    .maybeSingle();

  redirect(plan ? `/admin/programs/${plan.plan_id}/${day}` : "/admin/programs");
}
