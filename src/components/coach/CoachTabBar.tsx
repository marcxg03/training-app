"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Dumbbell, Users } from "lucide-react";

import { cn } from "@/lib/utils/cn";

type CoachTab = {
  label: string;
  href: string;
  icon: typeof Users;
  /** Match prefix for the active highlight. */
  match: string;
};

// "Library" points back to the athlete library (the coach's own catalog).
const tabs: CoachTab[] = [
  { label: "Clients", href: "/coach", icon: Users, match: "/coach" },
  {
    label: "Activity",
    href: "/coach/activity",
    icon: Bell,
    match: "/coach/activity",
  },
  { label: "Library", href: "/library", icon: Dumbbell, match: "/library" },
];

/** Coach-shell sub navigation. Separate from the athlete BottomTabBar, which is
 * left untouched. Shown only on the top-level coach roster + activity surfaces. */
export function CoachTabBar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-around border-t border-border bg-card-alt px-3.5 pb-2 pt-2.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          tab.match === "/coach"
            ? pathname === "/coach"
            : pathname.startsWith(tab.match);

        return (
          <Link
            key={tab.label}
            href={tab.href}
            className="flex min-w-14 flex-col items-center gap-1"
          >
            <Icon
              className={cn(
                "h-[22px] w-[22px]",
                isActive ? "text-accent" : "text-faint",
              )}
            />
            <span
              className={cn(
                "font-mono text-[9px] font-semibold uppercase tracking-[0.08em]",
                isActive ? "text-accent" : "text-faint",
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
