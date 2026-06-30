import { ChevronRight, Dumbbell, User, UtensilsCrossed } from "lucide-react";
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
    icon: UtensilsCrossed,
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
        <p className="eyebrow">Settings</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
      </header>

      <section className="space-y-3">
        <p className="eyebrow">Account</p>
        <nav className="space-y-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
              >
                <Icon className="h-5 w-5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {item.label}
                  </span>
                  <span className="block text-xs text-subtle">
                    {item.description}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
              </Link>
            );
          })}
        </nav>
      </section>

      <div className="pt-2">
        <SignOutButton userId={user.id} />
      </div>
    </div>
  );
}
