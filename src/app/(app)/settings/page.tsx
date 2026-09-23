import {
  ChevronRight,
  Dumbbell,
  ShieldCheck,
  User,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { isOwner } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";

type MenuItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof User;
};

// Shown to every authenticated user.
const ACCOUNT_ITEMS: MenuItem[] = [
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
];

// Authoring surfaces — owner-only (D18). Non-owners would 404 on these, so they
// are only listed for the owner.
const OWNER_ITEMS: MenuItem[] = [
  {
    href: "/admin",
    label: "Admin hub",
    description: "Programs, publishing, and analytics",
    icon: ShieldCheck,
  },
  {
    href: "/library/exercises",
    label: "Exercise library",
    description: "Edit exercises, blocks, and activities",
    icon: Dumbbell,
  },
];

function SettingsLink({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
    >
      <Icon className="h-5 w-5 shrink-0 text-accent" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {item.label}
        </span>
        <span className="block text-xs text-subtle">{item.description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
    </Link>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const owner = isOwner(user.id);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <header className="space-y-1">
        <p className="eyebrow">Settings</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
      </header>

      <section className="space-y-3">
        <p className="eyebrow">Account</p>
        <nav className="space-y-2">
          {ACCOUNT_ITEMS.map((item) => (
            <SettingsLink key={item.href} item={item} />
          ))}
        </nav>
      </section>

      {owner ? (
        <section className="space-y-3">
          <p className="eyebrow">Owner</p>
          <nav className="space-y-2">
            {OWNER_ITEMS.map((item) => (
              <SettingsLink key={item.href} item={item} />
            ))}
          </nav>
        </section>
      ) : null}

      <div className="pt-2">
        <SignOutButton userId={user.id} />
      </div>
    </div>
  );
}
