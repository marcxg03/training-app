import type { JSX } from "react";
import { redirect } from "next/navigation";

import { BodyweightSection } from "@/app/(app)/trends/_components/BodyweightSection";
import { E1rmSection } from "@/app/(app)/trends/_components/E1rmSection";
import { NutritionTrendSection } from "@/app/(app)/trends/_components/NutritionTrendSection";
import { WeeklyVolumeSection } from "@/app/(app)/trends/_components/WeeklyVolumeSection";
import {
  buildBodyweightTrend,
  buildE1rmSpotlights,
  buildNutritionBands,
  buildWeeklyVolumeByGroup,
} from "@/lib/analytics/projections";
import { getSetLogWindow } from "@/lib/analytics/queries";
import { getBodyweightTrend } from "@/lib/bodyweight/queries";
import { createClient } from "@/lib/supabase/server";
import { addDaysToDayKey, dayKeyDaysAgo as dayKeyDaysAgoTz } from "@/lib/time/appDay";
import { getAppTimezone, getAppToday } from "@/lib/time/server";
import {
  getMealsForDateRange,
  getNutritionTargets,
} from "@/lib/nutrition/queries";

// One shared window fetch feeds every set_logs-based section (D3).
const TRENDS_WINDOW_DAYS = 90;
const E1RM_RANK_WINDOW_DAYS = 30;
const E1RM_SPOTLIGHT_LIMIT = 4;
const VOLUME_WEEKS = 8;
const NUTRITION_WINDOW_DAYS = 30;
const BODYWEIGHT_WINDOW_DAYS = 90;

// Trends — the analytics hub.
export default async function TrendsPage(): Promise<JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // One app timezone (profile setting) drives every "what day is it"
  // decision: meal filing, chart bucketing, window boundaries.
  const timeZone = await getAppTimezone();
  const today = await getAppToday();
  // One "now" for every window boundary — three separate new Date() calls
  // could disagree across a midnight rollover mid-render.
  const now = new Date();
  const [setRows, meals, targets, bodyweight] = await Promise.all([
    getSetLogWindow(TRENDS_WINDOW_DAYS),
    getMealsForDateRange(
      addDaysToDayKey(today, -(NUTRITION_WINDOW_DAYS - 1)),
      today,
    ),
    getNutritionTargets(),
    getBodyweightTrend(BODYWEIGHT_WINDOW_DAYS),
  ]);

  const e1rmSpotlights = buildE1rmSpotlights(setRows, {
    windowStartKey: dayKeyDaysAgoTz(TRENDS_WINDOW_DAYS, timeZone, now),
    rankCutoffKey: dayKeyDaysAgoTz(E1RM_RANK_WINDOW_DAYS, timeZone, now),
    limit: E1RM_SPOTLIGHT_LIMIT,
    timeZone,
  });
  const volumeGroups = buildWeeklyVolumeByGroup(setRows, {
    weeks: VOLUME_WEEKS,
    timeZone,
    now,
  });
  // Today is a partial day — keep its band point but exclude it from the
  // header averages so a breakfast-only morning doesn't read as a crash diet.
  const nutritionSeries = buildNutritionBands(meals, { partialDayKey: today });

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header>
        <p className="eyebrow">Analytics</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Trends
        </h1>
      </header>

      <E1rmSection spotlights={e1rmSpotlights} />

      <WeeklyVolumeSection groups={volumeGroups} />

      <NutritionTrendSection series={nutritionSeries} targets={targets} />

      <BodyweightSection
        points={
          bodyweight.available ? buildBodyweightTrend(bodyweight.rows) : []
        }
        available={bodyweight.available}
        logDate={today}
      />
    </div>
  );
}
