import { redirect } from "next/navigation";

import { ProfileForm } from "@/app/(app)/settings/_components/ProfileForm";
import { getNutritionTargets } from "@/lib/nutrition/queries";
import { getProfile } from "@/lib/settings/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile, currentTargets] = await Promise.all([
    getProfile(),
    getNutritionTargets(),
  ]);

  return (
    <ProfileForm
      userId={user.id}
      profile={profile}
      currentTargets={currentTargets}
    />
  );
}
