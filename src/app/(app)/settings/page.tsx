import { Apple, ChevronRight, Dumbbell, User } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { createClient } from "@/lib/supabase/server";

const MENU_ITEMS = [
  {
    href: "/settings/profile",
    label: "Profile",
    description: "Bodyweight, height, and goal mode",
    icon: User,
  },
  {
    href: "/nutrition/targets",
    label: "Nutrition targets",
    description: "Daily calorie and macro ranges",
    icon: Apple,
  },
  {
    href: "/library/exercises",
    label: "Exercise library",
    description: "Edit exercises, blocks, and activities",
    icon: Dumbbell,
  },
] as const;

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </p>
        <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
      </header>

      <nav className="space-y-2">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="h-5 w-5 text-accent" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">
                  {item.label}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border pt-4">
        <SignOutButton userId={user.id} />
      </div>
    </div>
  );
}
