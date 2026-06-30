import { Dumbbell, HeartPulse, Moon, type LucideIcon } from "lucide-react";

import type { DayTypeFramework } from "@/lib/methodology/nutrition";

const EMPHASIS_LABEL = {
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
} as const;

/** Picks an icon from the framework title so the card mirrors the day type
 * without needing a new prop. Falls back to the rest-day icon. */
function iconForTitle(title: string): LucideIcon {
  const lower = title.toLowerCase();
  if (lower.includes("lift")) {
    return Dumbbell;
  }
  if (lower.includes("cardio")) {
    return HeartPulse;
  }
  return Moon;
}

export function DayTypeFrameworkCard({
  framework,
}: {
  framework: DayTypeFramework;
}) {
  const Icon = iconForTitle(framework.title);

  return (
    <section className="flex items-center gap-3.5 rounded-[var(--radius)] border border-border bg-card p-4">
      <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl bg-accent/15">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <div className="min-w-0">
        <span className="eyebrow inline-flex items-center rounded-md bg-accent/15 px-2.5 py-1 text-accent">
          {framework.title} · {EMPHASIS_LABEL[framework.emphasis]}
        </span>
        <p className="mt-1.5 font-mono text-[11px] leading-snug tracking-[0.03em] text-muted-foreground">
          {framework.guidance}
        </p>
      </div>
    </section>
  );
}
