import type { JSX } from "react";
import { redirect } from "next/navigation";

import { BodyweightSection } from "@/app/(app)/trends/_components/BodyweightSection";
import { E1rmSection } from "@/app/(app)/trends/_components/E1rmSection";
import { NutritionTrendSection } from "@/app/(app)/trends/_components/NutritionTrendSection";
import {
  TrendsSectionChips,
  type TrendsSection,
} from "@/app/(app)/trends/_components/TrendsSectionChips";
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
import {
  addDaysToDayKey,
  dayKeyDaysAgo as dayKeyDaysAgoTz,
} from "@/lib/time/appDay";
import { getAppTimezone, getAppToday } from "@/lib/time/server";
import {
  getMealsForDateRange,
  getNutritionTargets,
} from "@/lib/nutrition/queries";

const TRENDS_WINDOW_DAYS = 90;
const E1RM_RANK_WINDOW_DAYS = 30;
const E1RM_SPOTLIGHT_LIMIT = 4;
const VOLUME_WEEKS = 8;
const NUTRITION_WINDOW_DAYS = 30;
const BODYWEIGHT_WINDOW_DAYS = 90;

const SECTIONS: TrendsSection[] = ["strength", "load", "fuel", "body"];

function parseSection(value: string | undefined): TrendsSection {
  return SECTIONS.includes(value as TrendsSection)
    ? (value as TrendsSection)
    : "strength";
}

type TrendsPageProps = {
  searchParams: Promise<{ section?: string }>;
};

// Trends — segmented into one visible section at a time (?section=). Each
// render fetches ONLY the active section's data: fuel/body renders skip the
// paginated set_logs window entirely. (Supersedes the old D3 all-sections
// shared fetch — only one set_logs consumer renders per request now.)
export default async function TrendsPage({
  searchParams,
}: TrendsPageProps): Promise<JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { section: sectionParam } = await searchParams;
  const section = parseSection(sectionParam);

  const timeZone = await getAppTimezone();
  const today = await getAppToday();
  // One "now" for every window boundary within a render.
  const now = new Date();

  let content: JSX.Element;

  if (section === "strength") {
    const setRows = await getSetLogWindow(TRENDS_WINDOW_DAYS);
    const spotlights = buildE1rmSpotlights(setRows, {
      windowStartKey: dayKeyDaysAgoTz(TRENDS_WINDOW_DAYS, timeZone, now),
      rankCutoffKey: dayKeyDaysAgoTz(E1RM_RANK_WINDOW_DAYS, timeZone, now),
      limit: E1RM_SPOTLIGHT_LIMIT,
      timeZone,
    });
    content = <E1rmSection spotlights={spotlights} />;
  } else if (section === "load") {
    const setRows = await getSetLogWindow(TRENDS_WINDOW_DAYS);
    const volumeGroups = buildWeeklyVolumeByGroup(setRows, {
      weeks: VOLUME_WEEKS,
      timeZone,
      now,
    });
    content = <WeeklyVolumeSection groups={volumeGroups} />;
  } else if (section === "fuel") {
    const [meals, targets] = await Promise.all([
      getMealsForDateRange(
        addDaysToDayKey(today, -(NUTRITION_WINDOW_DAYS - 1)),
        today,
      ),
      getNutritionTargets(),
    ]);
    // Today is a partial day — keep its band point but exclude it from the
    // header averages so a breakfast-only morning doesn't read as a crash
    // diet.
    const series = buildNutritionBands(meals, { partialDayKey: today });
    content = <NutritionTrendSection series={series} targets={targets} />;
  } else {
    const bodyweight = await getBodyweightTrend(BODYWEIGHT_WINDOW_DAYS);
    content = (
      <BodyweightSection
        points={
          bodyweight.available ? buildBodyweightTrend(bodyweight.rows) : []
        }
        available={bodyweight.available}
        logDate={today}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header>
        <p className="eyebrow">Analytics</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Trends
        </h1>
      </header>

      <TrendsSectionChips active={section} />

      {content}
    </div>
  );
}
