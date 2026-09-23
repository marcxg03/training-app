import type { JSX } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buildMealDaySummaries } from "@/lib/nutrition/summary";
import {
  getMealsForDateRange,
  getNutritionTargets,
} from "@/lib/nutrition/queries";
import { dayLabelOf } from "@/lib/analytics/projections";
import { addDaysToDayKey } from "@/lib/time/appDay";
import { getAppToday } from "@/lib/time/server";

// Meal log history — the Fuel analog of the all-workouts list: one row per
// logged day, newest first, into the day's full log.
const HISTORY_WINDOW_DAYS = 90;

const statusStyles: Record<string, string> = {
  in: "text-accent",
  under: "text-subtle",
  over: "text-warning",
};

const statusLabels: Record<string, string> = {
  in: "In range",
  under: "Under",
  over: "Over",
};

export default async function MealHistoryPage(): Promise<JSX.Element> {
  const today = await getAppToday();
  const [meals, targets] = await Promise.all([
    getMealsForDateRange(
      addDaysToDayKey(today, -(HISTORY_WINDOW_DAYS - 1)),
      today,
    ),
    getNutritionTargets(),
  ]);

  const days = buildMealDaySummaries(meals, targets);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link
          href="/nutrition"
          aria-label="Back to Fuel"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card-alt text-subtle transition-colors hover:border-accent/50 hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="eyebrow">Meal log</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            History
          </h1>
        </div>
      </header>

      {days.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {days.map((day) => (
            <li key={day.date}>
              <Link
                href={`/nutrition/history/${day.date}`}
                className="flex items-center justify-between rounded-[14px] border border-border bg-card px-4 py-3.5 transition-colors hover:border-accent/50"
              >
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground">
                    {day.date === today ? "Today" : dayLabelOf(day.date)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {day.mealCount} meal{day.mealCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
                    {day.calMin === day.calMax
                      ? day.calMin
                      : `${day.calMin}–${day.calMax}`}
                    <span className="ml-1 text-[10px] font-normal uppercase text-faint">
                      kcal
                    </span>
                  </p>
                  {day.status ? (
                    <p
                      className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${statusStyles[day.status]}`}
                    >
                      {statusLabels[day.status]}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          No meals logged in the last {HISTORY_WINDOW_DAYS} days.
        </div>
      )}
    </div>
  );
}
