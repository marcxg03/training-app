"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Apple,
  BarChart3,
  Calendar,
  Home,
  Settings,
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
  { href: "/plan", label: "Plan", icon: Calendar },
  { href: "/history", label: "History", icon: BarChart3 },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Bottom navigation"
      className="safe-pb fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-1 border-t-2 px-2 py-3 text-xs font-medium text-muted-foreground transition-colors",
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
