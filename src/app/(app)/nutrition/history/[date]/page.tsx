import type { JSX } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { MacroProgressBar } from "@/app/(app)/nutrition/_components/MacroProgressBar";
import { buildMacroBars, sumMealTotals } from "@/lib/nutrition/summary";
import {
  getMealsForDate,
  getNutritionTargets,
} from "@/lib/nutrition/queries";
import { dayLabelOf } from "@/lib/analytics/projections";
import { getAppToday } from "@/lib/time/server";

// Read-only day detail — edits stay on the Fuel page (today only), matching
// how past workout sessions are viewable but not editable.

type MealDayPageProps = {
  params: Promise<{ date: string }>;
};

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T12:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function range(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

export default async function MealDayPage({
  params,
}: MealDayPageProps): Promise<JSX.Element> {
  const { date } = await params;

  if (!isValidDateKey(date)) {
    notFound();
  }

  const today = await getAppToday();
  const [meals, targets] = await Promise.all([
    getMealsForDate(date),
    getNutritionTargets(),
  ]);

  const bars = buildMacroBars(targets, sumMealTotals(meals));
  const isToday = date === today;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link
          href="/nutrition/history"
          aria-label="Back to meal history"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card-alt text-subtle transition-colors hover:border-accent/50 hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="eyebrow">Meal log</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            {isToday ? "Today" : dayLabelOf(date)}
          </h1>
        </div>
      </header>

      {/* meals.length guard: a directly-typed unlogged (even future) date
          must not render a zeroed "under target" scorecard. */}
      {bars.length > 0 && meals.length > 0 ? (
        <section className="flex flex-col gap-5 rounded-[var(--radius)] border border-border bg-card p-[18px]">
          {bars.map((bar) => (
            <MacroProgressBar key={bar.key} bar={bar} />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow">
          Meals{isToday ? " · edit on the Fuel tab" : ""}
        </h2>
        {meals.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {meals.map((meal) => (
              <li
                key={meal.meal_id}
                className="rounded-[14px] border border-border bg-card px-4 py-3.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-foreground">
                    {meal.meal_type}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-subtle">
                    {range(meal.cal_min, meal.cal_max)} kcal
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-[10px] uppercase tabular-nums tracking-[0.05em] text-faint">
                  P {range(meal.protein_min_g, meal.protein_max_g)} · C{" "}
                  {range(meal.carbs_min_g, meal.carbs_max_g)} · F{" "}
                  {range(meal.fat_min_g, meal.fat_max_g)}
                </div>
                {meal.note ? (
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {meal.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
            No meals logged on this day.
          </div>
        )}
      </section>
    </div>
  );
}
