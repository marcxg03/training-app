"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FolderCog,
  Gauge,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { ADMIN_SECTIONS, isAdminSectionActive } from "@/lib/nav/admin";

/**
 * The admin hub's navigation (T3-A · D18).
 *
 * DESKTOP-FIRST, not desktop-only. At `lg:` and up it is a fixed left rail —
 * the shape a hub with wide tables and dashboards wants. Below `lg:` the same
 * list collapses to a horizontal scroller across the top, because "desktop
 * hub" must not mean "unusable if Marcus opens it on his phone to check one
 * thing". Nothing here is hidden at any width.
 *
 * The active-match rule lives in src/lib/nav/admin.ts so it is unit-testable
 * (scripts/verify-admin-nav.ts): "/admin" must match EXACTLY or it lights up
 * on every child route and two items read as active at once.
 */

const ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  folder: FolderCog,
  chart: BarChart3,
  users: Users,
};

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className={cn(
        // mobile: a horizontal strip under the header
        "flex gap-1.5 overflow-x-auto border-b border-border bg-card px-4 py-2",
        // desktop: a fixed left rail
        "lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-3 lg:py-5",
      )}
    >
      <div className="hidden lg:mb-4 lg:block lg:px-2">
        <p className="eyebrow">Owner</p>
        <p className="text-sm font-semibold text-foreground">Admin hub</p>
      </div>

      {ADMIN_SECTIONS.map((section) => {
        const Icon = ICONS[section.icon] ?? Gauge;
        const active = isAdminSectionActive(pathname, section.href);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors lg:gap-3",
              active
                ? "bg-input font-semibold text-foreground"
                : "text-subtle hover:bg-input/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.4 : 2} />
            <span className="min-w-0 lg:flex-1">
              <span className="block whitespace-nowrap">{section.label}</span>
              {/* The hint only earns its space on the wide rail. */}
              <span className="hidden text-[11px] font-normal text-faint lg:block">
                {section.hint}
              </span>
            </span>
            {section.soon ? (
              <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-faint">
                Soon
              </span>
            ) : null}
          </Link>
        );
      })}

      {/* The way back to the member app. Without it the hub is a dead end:
          it has no bottom tab bar, by design. */}
      <Link
        href="/today"
        className="mt-0 flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-faint transition-colors hover:bg-input/60 hover:text-foreground lg:mt-auto lg:gap-3"
      >
        <Smartphone className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">Back to app</span>
      </Link>
    </nav>
  );
}
