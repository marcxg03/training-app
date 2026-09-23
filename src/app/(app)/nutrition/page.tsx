import Link from "next/link";
import { History } from "lucide-react";
import { redirect } from "next/navigation";

import { MealsSection } from "@/app/(app)/nutrition/_components/MealsSection";
import { MacroRangeBar } from "@/components/shared";
import type { GoalMode } from "@/lib/methodology/nutrition";
import {
  getGoalMode,
  getMealsForDate,
  getNutritionTargets,
  getTodayDayType,
} from "@/lib/nutrition/queries";
import { dayTypeFramework } from "@/lib/methodology/nutrition";
import type { MacroBar } from "@/lib/nutrition/projections";
import { buildMacroBars, sumMealTotals } from "@/lib/nutrition/summary";
import { getAppToday } from "@/lib/time/server";
import { createClient } from "@/lib/supabase/server";

const GOAL_MODE_LABEL: Record<GoalMode, string> = {
  cut: "Cut",
  maintain: "Maintain",
  lean_bulk: "Lean bulk",
};

const CAL_STATUS_META: Record<
  MacroBar["status"],
  { label: string; className: string }
> = {
  in: { label: "In range", className: "bg-success/15 text-success" },
  under: { label: "Under", className: "bg-warning/15 text-warning" },
  over: { label: "Over", className: "bg-danger/15 text-danger" },
};

const fmt = (value: number) => value.toLocaleString("en-US");

/** Collapse an exact [min, max] range to a single readout ("1,980" or "1,900–2,050"). */
const rangeLabel = (min: number, max: number) =>
  min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;

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
  const bars = buildMacroBars(targets, totals);
  const calBar = bars.find((bar) => bar.key === "calories") ?? null;
  const macroBars = bars.filter((bar) => bar.key !== "calories");

  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  }).format(new Date(`${today}T00:00:00`));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* header — day + day-type + goal-mode pill */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
            {weekday} · Nutrition
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {framework.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/nutrition/history"
            aria-label="Meal log history"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card-alt text-subtle transition-colors hover:border-accent/50 hover:text-foreground"
          >
            <History className="h-4 w-4" />
          </Link>
          <Link
            href="/nutrition/targets"
            aria-label={
              targets ? "Edit nutrition targets" : "Set nutrition targets"
            }
            className="rounded-full bg-input px-3 py-1 text-[11px] font-medium text-subtle transition-colors hover:text-foreground"
          >
            {GOAL_MODE_LABEL[goalMode]}
          </Link>
        </div>
      </header>

      {/* calories headline — the one number that matters, then P/C/F bars */}
      {calBar ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                Calories
              </span>
              <span className="text-3xl font-bold tabular-nums">
                {rangeLabel(calBar.totalMin, calBar.totalMax)}
                <span className="text-base font-medium text-faint">
                  {" "}
                  / {rangeLabel(calBar.min, calBar.max)}
                </span>
              </span>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${CAL_STATUS_META[calBar.status].className}`}
            >
              {CAL_STATUS_META[calBar.status].label}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {macroBars.map((bar) => (
              <MacroRangeBar
                key={bar.key}
                label={bar.label}
                value={`${rangeLabel(bar.totalMin, bar.totalMax)} / ${rangeLabel(
                  bar.min,
                  bar.max,
                )}${bar.unit === "g" ? "g" : ""}`}
                currentMin={bar.totalMin}
                currentMax={bar.totalMax}
                rangeMin={bar.min}
                rangeMax={bar.max}
                state={bar.status}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Set your daily calorie and macro ranges to track intake against
            them.
          </p>
          <Link
            href="/nutrition/targets"
            className="mt-3 inline-flex text-sm font-medium text-accent transition-colors hover:text-accent/80"
          >
            Set targets +
          </Link>
        </div>
      )}

      <MealsSection
        meals={meals}
        userId={user.id}
        date={today}
        aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
      />
    </div>
  );
}
