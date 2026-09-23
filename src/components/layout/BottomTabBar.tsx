"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  LineChart,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { isTabActive } from "@/lib/nav/tabs";

type TabDefinition = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should light this tab (surfaces merged into it). */
  activeMatch?: string[];
};

/**
 * Mobile bottom nav — the 5-tab IA (D19): Today · Plan · Nutrition · Progress ·
 * Community. Settings is NOT a tab; it is reached via the gear in the Today
 * header (TodayHeader). Removed as tabs (D19): Library (→ owner-only, S0 gate),
 * Trends + History (→ merged into Progress, S5). "Fuel" is renamed Nutrition.
 *
 * Progress points at /progress (S5 builds the merged screen; an S0 placeholder
 * redirects it to the existing /history surface). /trends and /history still
 * light the Progress tab so the merged surfaces read as one destination.
 */
const tabs: TabDefinition[] = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/nutrition", label: "Nutrition", icon: UtensilsCrossed },
  {
    href: "/progress",
    label: "Progress",
    icon: LineChart,
    activeMatch: ["/history", "/trends"],
  },
  { href: "/community", label: "Community", icon: Users },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Bottom navigation"
      className="safe-pb fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-around px-1 pt-2.5">
        {tabs.map(({ href, label, icon: Icon, activeMatch }) => {
          const isActive = isTabActive(pathname, href, activeMatch);

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 transition-colors",
                isActive ? "text-accent" : "text-faint hover:text-subtle",
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em]">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
