"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  LineChart,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

type TabDefinition = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const tabs: TabDefinition[] = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/nutrition", label: "Fuel", icon: UtensilsCrossed },
  { href: "/history", label: "Progress", icon: LineChart },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Bottom navigation"
      className="safe-pb fixed inset-x-0 bottom-0 border-t border-border/70 bg-card-alt/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-around px-3 pt-2.5">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-14 flex-col items-center justify-center gap-1.5 transition-colors",
                isActive ? "text-accent" : "text-faint hover:text-subtle",
              )}
            >
              <Icon
                className="h-6 w-6"
                strokeWidth={isActive ? 2.5 : 2}
                fill={isActive ? "currentColor" : "none"}
              />
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
