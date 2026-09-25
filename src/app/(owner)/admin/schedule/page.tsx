import Link from "next/link";
import { redirect } from "next/navigation";

import { PlanEditForm } from "./_components/PlanEditForm";
import { requireOwner } from "@/lib/auth/requireOwner";
import { getPlanEditData } from "@/lib/plan/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * /admin/schedule — the weekly schedule editor (moved here in T3-B).
 *
 * IT USED TO LIVE AT `/plan/edit`, which was a real routing bug: the member
 * group's dynamic `/plan/[day]` route ALSO matched that path, so Next resolved
 * `day = "edit"` and served the member page inside the phone shell. The build
 * stayed green throughout — two route groups claiming one URL is not a
 * compile error (D45).
 *
 * The no-active-plan case renders an empty state IN THE HUB rather than
 * redirecting to `/plan`. Bouncing the owner out to a member page is the exact
 * dead end this slice exists to remove, and "you have no plan yet" is a state
 * the builder should be able to show and act on.
 */

function NoActivePlan({ reason }: { reason: string }) {
  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-1.5">
        <p className="eyebrow">Owner · Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Schedule
        </h1>
      </header>
      <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-dashed border-border bg-card-alt p-5">
        <p className="eyebrow">No active plan</p>
        <p className="text-sm leading-relaxed text-subtle">{reason}</p>
        <Link
          href="/admin/programs"
          className="text-sm font-medium text-accent underline underline-offset-2"
        >
          Go to Programs
        </Link>
      </div>
    </div>
  );
}

export default async function PlanEditPage() {
  // Plan editing is owner-only authoring (Slice S0 · D18/D22): a non-owner
  // gets notFound() before any plan data is read.
  await requireOwner();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: plan, error } = await supabase
    .from("training_plans")
    .select("plan_id")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load active plan: ${error.message}`);
  }
  if (!plan) {
    return (
      <NoActivePlan reason="There is no active training plan to schedule against. Activate one and its week becomes editable here." />
    );
  }

  const data = await getPlanEditData(plan.plan_id);
  if (!data) {
    return (
      <NoActivePlan reason="The active plan could not be loaded — it may have no schedule rows yet." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1.5">
        <p className="eyebrow">Owner · Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Schedule
        </h1>
      </header>
      <div className="max-w-4xl">
        <PlanEditForm data={data} />
      </div>
    </div>
  );
}
