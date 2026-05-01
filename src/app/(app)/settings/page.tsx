import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <SignOutButton userId={user.id} />
    </div>
  );
}
