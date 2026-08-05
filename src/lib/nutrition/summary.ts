import { rangeStatusForRange } from "@/lib/methodology/nutrition";
import type {
  MacroBar,
  MacroTotals,
  MealEntry,
  NutritionTargets,
} from "./projections";

// Shared, pure builders for the macro/calorie view-models used by both the
// Fuel tab and the Today tab. No React, no Supabase.

/** Sum a day's logged meals into per-macro [min, max] totals. */
export function sumMealTotals(meals: MealEntry[]): MacroTotals {
  return meals.reduce<MacroTotals>(
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
}

/** Build the Calories/Protein/Carbs/Fat progress bars from targets + totals.
 * Returns an empty array when no targets are set. */
export function buildMacroBars(
  targets: NutritionTargets | null,
  totals: MacroTotals,
): MacroBar[] {
  if (!targets) {
    return [];
  }

  return [
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
  ];
}

export type MealDaySummary = {
  date: string;
  mealCount: number;
  calMin: number;
  calMax: number;
  /** Day's calories vs target zone; null when no targets are set. */
  status: ReturnType<typeof rangeStatusForRange> | null;
};

/** Group a date-range of meals into per-day summaries, newest first — the
 * meal-log analog of the workout history list. */
export function buildMealDaySummaries(
  meals: (MealEntry & { date: string })[],
  targets: NutritionTargets | null,
): MealDaySummary[] {
  const byDate = new Map<
    string,
    { count: number; calMin: number; calMax: number }
  >();

  for (const meal of meals) {
    const bucket = byDate.get(meal.date) ?? { count: 0, calMin: 0, calMax: 0 };
    bucket.count += 1;
    bucket.calMin += meal.cal_min;
    bucket.calMax += meal.cal_max;
    byDate.set(meal.date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, bucket]) => ({
      date,
      mealCount: bucket.count,
      calMin: bucket.calMin,
      calMax: bucket.calMax,
      status: targets
        ? rangeStatusForRange(
            bucket.calMin,
            bucket.calMax,
            targets.cal_min,
            targets.cal_max,
          )
        : null,
    }));
}
