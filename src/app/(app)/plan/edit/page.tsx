import { redirect } from "next/navigation";

import { PlanEditForm } from "@/app/(app)/plan/_components/PlanEditForm";
import { getPlanEditData } from "@/lib/plan/queries";
import { createClient } from "@/lib/supabase/server";

export default async function PlanEditPage() {
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
    redirect("/plan");
  }

  const data = await getPlanEditData(plan.plan_id);
  if (!data) {
    redirect("/plan");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PlanEditForm data={data} />
    </div>
  );
}
