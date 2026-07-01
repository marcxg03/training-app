import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { createClient } from "@/lib/supabase/server";

type AppLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function AppLayout({ children }: AppLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, goal_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    console.error("Authenticated user is missing a profile row.", {
      userId: user.id,
    });
    redirect("/auth/callback");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-6 pb-24 pt-[calc(env(safe-area-inset-top)_+_2rem)]">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
