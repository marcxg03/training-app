import { redirect } from "next/navigation";

import { TargetsForm } from "@/app/(app)/nutrition/_components/TargetsForm";
import { getGoalMode, getNutritionTargets } from "@/lib/nutrition/queries";
import { createClient } from "@/lib/supabase/server";

export default async function NutritionTargetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [targets, goalMode] = await Promise.all([
    getNutritionTargets(),
    getGoalMode(),
  ]);

  return (
    <TargetsForm userId={user.id} initialValues={targets} goalMode={goalMode} />
  );
}
