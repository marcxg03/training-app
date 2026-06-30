import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";

import { MacroProgressBar } from "@/app/(app)/nutrition/_components/MacroProgressBar";
import type { MacroBar } from "@/lib/nutrition/projections";

type TodayFuelCardProps = {
  /** Calories/Protein/Carbs/Fat bars for today. Empty when no targets are set. */
  bars: MacroBar[];
};

/** Today's macro + calorie tracker. Mirrors the Fuel tab's bars in a compact
 * card so the day's nutrition is visible at a glance from Today. Tapping it
 * opens the full Fuel tab. */
export function TodayFuelCard({ bars }: TodayFuelCardProps) {
  const hasTargets = bars.length > 0;

  return (
    <Link
      href="/nutrition"
      className="block rounded-[var(--radius)] border border-border bg-card p-[18px] transition-colors hover:border-accent/50"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow inline-flex items-center gap-1.5 tracking-[0.14em]">
          <Flame className="h-3.5 w-3.5 text-cardio" />
          Today · Fuel
        </span>
        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
          {hasTargets ? "Log" : "Set targets"}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>

      {hasTargets ? (
        <div className="mt-4 flex flex-col gap-4">
          {bars.map((bar) => (
            <MacroProgressBar key={bar.key} bar={bar} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Set your calorie and macro targets to track them here.
        </p>
      )}
    </Link>
  );
}
