import { redirect } from "next/navigation";

import { requireOwner } from "@/lib/auth/requireOwner";
import { createClient } from "@/lib/supabase/server";

/**
 * /admin/schedule — a REDIRECT, kept only so old links keep working (T3-C).
 *
 * Schedule was folded into Programs (D48): it only existed as its own section
 * because the week editor was hardcoded to the active plan, which is exactly
 * the confusion Marcus named — "shouldn't editing only happen in the program
 * editing page?". It should, and now it does.
 *
 * This forwards to the active program's editor rather than 404ing, because
 * `/admin/schedule` was linked from the hub and from the member day cards for
 * one slice, and a dead link is a worse answer than a redirect. Delete this
 * once nothing points here.
 */
export default async function ScheduleRedirectPage() {
  const ownerId = await requireOwner();
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("training_plans")
    .select("plan_id")
    .eq("user_id", ownerId)
    .eq("is_active", true)
    .maybeSingle();

  redirect(plan ? `/admin/programs/${plan.plan_id}` : "/admin/programs");
}
