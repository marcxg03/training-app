import Link from "next/link";
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
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Nutrition
        </p>
        <h1 className="text-3xl font-semibold text-foreground">Today</h1>
      </header>

      <DayTypeFrameworkCard framework={framework} />

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Macros today
          </h2>
          <Link
            href="/nutrition/targets"
            className="text-sm font-medium text-accent transition-colors hover:text-accent/80"
          >
            {targets ? "Edit targets" : "Set targets"}
          </Link>
        </div>
        {targets ? (
          <div className="space-y-4">
            {bars.map((bar) => (
              <MacroProgressBar key={bar.key} bar={bar} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set your daily calorie and macro ranges to track progress against
            them.
          </p>
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
