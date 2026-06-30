import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { redirect } from "next/navigation";

import { DayTypeFrameworkCard } from "@/app/(app)/nutrition/_components/DayTypeFrameworkCard";
import { MacroProgressBar } from "@/app/(app)/nutrition/_components/MacroProgressBar";
import { MealsSection } from "@/app/(app)/nutrition/_components/MealsSection";
import {
  dayTypeFramework,
  rangeStatusForRange,
} from "@/lib/methodology/nutrition";
import type { MacroBar, MacroTotals } from "@/lib/nutrition/projections";
import {
  getGoalMode,
  getMealsForDate,
  getNutritionTargets,
  getTodayDateString,
  getTodayDayType,
} from "@/lib/nutrition/queries";
import { createClient } from "@/lib/supabase/server";

export default async function NutritionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = getTodayDateString();
  const [targets, meals, dayType, goalMode] = await Promise.all([
    getNutritionTargets(),
    getMealsForDate(today),
    getTodayDayType(),
    getGoalMode(),
  ]);

  const totals = meals.reduce<MacroTotals>(
    (acc, meal) => ({
      calories: {
        min: acc.calories.min + meal.cal_min,
        max: acc.calories.max + meal.cal_max,
      },
      protein: {
        min: acc.protein.min + meal.protein_min_g,
        max: acc.protein.max + meal.protein_max_g,
      },
      carbs: {
        min: acc.carbs.min + meal.carbs_min_g,
        max: acc.carbs.max + meal.carbs_max_g,
      },
      fat: {
        min: acc.fat.min + meal.fat_min_g,
        max: acc.fat.max + meal.fat_max_g,
      },
    }),
    {
      calories: { min: 0, max: 0 },
      protein: { min: 0, max: 0 },
      carbs: { min: 0, max: 0 },
      fat: { min: 0, max: 0 },
    },
  );

  const framework = dayTypeFramework(dayType, goalMode);

  const dateEyebrow = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
    .format(new Date(`${today}T00:00:00`))
    .replace(",", " ·");

  const bars: MacroBar[] = targets
    ? [
        {
          key: "calories",
          label: "Calories",
          unit: "kcal",
          totalMin: Math.round(totals.calories.min),
          totalMax: Math.round(totals.calories.max),
          min: targets.cal_min,
          max: targets.cal_max,
          status: rangeStatusForRange(
            totals.calories.min,
            totals.calories.max,
            targets.cal_min,
            targets.cal_max,
          ),
        },
        {
          key: "protein",
          label: "Protein",
          unit: "g",
          totalMin: Math.round(totals.protein.min),
          totalMax: Math.round(totals.protein.max),
          min: targets.protein_min_g,
          max: targets.protein_max_g,
          status: rangeStatusForRange(
            totals.protein.min,
            totals.protein.max,
            targets.protein_min_g,
            targets.protein_max_g,
          ),
        },
        {
          key: "carbs",
          label: "Carbs",
          unit: "g",
          totalMin: Math.round(totals.carbs.min),
          totalMax: Math.round(totals.carbs.max),
          min: targets.carbs_min_g,
          max: targets.carbs_max_g,
          status: rangeStatusForRange(
            totals.carbs.min,
            totals.carbs.max,
            targets.carbs_min_g,
            targets.carbs_max_g,
          ),
        },
        {
          key: "fat",
          label: "Fat",
          unit: "g",
          totalMin: Math.round(totals.fat.min),
          totalMax: Math.round(totals.fat.max),
          min: targets.fat_min_g,
          max: targets.fat_max_g,
          status: rangeStatusForRange(
            totals.fat.min,
            totals.fat.max,
            targets.fat_min_g,
            targets.fat_max_g,
          ),
        },
      ]
    : [];

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
