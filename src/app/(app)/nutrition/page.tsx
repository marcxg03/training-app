import Link from "next/link";
import { redirect } from "next/navigation";

import { DayTypeFrameworkCard } from "@/app/(app)/nutrition/_components/DayTypeFrameworkCard";
import { LogMealButton } from "@/app/(app)/nutrition/_components/LogMealButton";
import { MacroProgressBar } from "@/app/(app)/nutrition/_components/MacroProgressBar";
import { MealList } from "@/app/(app)/nutrition/_components/MealList";
import { dayTypeFramework, rangeStatus } from "@/lib/methodology/nutrition";
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
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein_g,
      carbs: acc.carbs + meal.carbs_g,
      fat: acc.fat + meal.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const framework = dayTypeFramework(dayType, goalMode);

  const bars: MacroBar[] = targets
    ? [
        {
          key: "calories",
          label: "Calories",
          unit: "kcal",
          total: Math.round(totals.calories),
          min: targets.cal_min,
          max: targets.cal_max,
          status: rangeStatus(
            totals.calories,
            targets.cal_min,
            targets.cal_max,
          ),
        },
        {
          key: "protein",
          label: "Protein",
          unit: "g",
          total: Math.round(totals.protein),
          min: targets.protein_min_g,
          max: targets.protein_max_g,
          status: rangeStatus(
            totals.protein,
            targets.protein_min_g,
            targets.protein_max_g,
          ),
        },
        {
          key: "carbs",
          label: "Carbs",
          unit: "g",
          total: Math.round(totals.carbs),
          min: targets.carbs_min_g,
          max: targets.carbs_max_g,
          status: rangeStatus(
            totals.carbs,
            targets.carbs_min_g,
            targets.carbs_max_g,
          ),
        },
        {
          key: "fat",
          label: "Fat",
          unit: "g",
          total: Math.round(totals.fat),
          min: targets.fat_min_g,
          max: targets.fat_max_g,
          status: rangeStatus(totals.fat, targets.fat_min_g, targets.fat_max_g),
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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Meals</h2>
          <LogMealButton userId={user.id} date={today} />
        </div>
        <MealList meals={meals} />
      </section>
    </div>
  );
}
