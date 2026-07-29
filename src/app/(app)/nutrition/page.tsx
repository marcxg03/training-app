import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { redirect } from "next/navigation";

import { DayTypeFrameworkCard } from "@/app/(app)/nutrition/_components/DayTypeFrameworkCard";
import { MacroProgressBar } from "@/app/(app)/nutrition/_components/MacroProgressBar";
import { MealsSection } from "@/app/(app)/nutrition/_components/MealsSection";
import { dayTypeFramework } from "@/lib/methodology/nutrition";
import {
  getGoalMode,
  getMealsForDate,
  getNutritionTargets,
  getTodayDayType,
} from "@/lib/nutrition/queries";
import { buildMacroBars, sumMealTotals } from "@/lib/nutrition/summary";
import { getAppToday } from "@/lib/time/server";
import { createClient } from "@/lib/supabase/server";

export default async function NutritionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = await getAppToday();
  const [targets, meals, dayType, goalMode] = await Promise.all([
    getNutritionTargets(),
    getMealsForDate(today),
    getTodayDayType(),
    getGoalMode(),
  ]);

  const totals = sumMealTotals(meals);
  const framework = dayTypeFramework(dayType, goalMode);

  const dateEyebrow = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
    .format(new Date(`${today}T00:00:00`))
    .replace(",", " ·");

  const bars = buildMacroBars(targets, totals);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow tracking-[0.16em]">{dateEyebrow}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Fuel
          </h1>
        </div>
        <Link
          href="/nutrition/targets"
          aria-label={
            targets ? "Edit nutrition targets" : "Set nutrition targets"
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card-alt text-subtle transition-colors hover:border-accent/50 hover:text-foreground"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </Link>
      </header>

      <DayTypeFrameworkCard framework={framework} />

      <section className="space-y-3">
        <h2 className="eyebrow tracking-[0.16em]">Macros · range vs target</h2>
        {targets ? (
          <div className="flex flex-col gap-5 rounded-[var(--radius)] border border-border bg-card p-[18px]">
            {bars.map((bar) => (
              <MacroProgressBar key={bar.key} bar={bar} />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius)] border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Set your daily calorie and macro ranges to track progress against
              them.
            </p>
            <Link
              href="/nutrition/targets"
              className="mt-3 inline-flex text-sm font-medium text-accent transition-colors hover:text-accent/80"
            >
              Set targets
            </Link>
          </div>
        )}
      </section>

      <MealsSection
        meals={meals}
        userId={user.id}
        date={today}
        aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
      />
    </div>
  );
}
