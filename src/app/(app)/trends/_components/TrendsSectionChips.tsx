"use client";

import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export type TrendsSection = "strength" | "load" | "fuel" | "body";

const segments: { section: TrendsSection; label: string; href: string }[] = [
  { section: "strength", label: "Strength", href: "/trends" },
  { section: "load", label: "Load", href: "/trends?section=load" },
  { section: "fuel", label: "Fuel", href: "/trends?section=fuel" },
  { section: "body", label: "Body", href: "/trends?section=body" },
];

const segmentBase =
  "flex-1 rounded-lg py-2 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors";

// One section renders at a time — same URL-param segmented idiom as the
// history PRTimelineShowAllToggle.
export function TrendsSectionChips({ active }: { active: TrendsSection }) {
  return (
    <div className="flex gap-1.5 rounded-[var(--radius)] border border-border bg-input p-1">
      {segments.map(({ section, label, href }) => (
        <Link
          key={section}
          href={href}
          aria-current={active === section ? "true" : undefined}
          className={cn(
            segmentBase,
            active === section
              ? "bg-accent text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
