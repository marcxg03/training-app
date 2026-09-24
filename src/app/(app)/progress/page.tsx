import type { JSX } from "react";

import { AllWorkoutsRow } from "@/app/(app)/progress/_components/AllWorkoutsRow";
import { BodyweightSection } from "@/app/(app)/progress/_components/BodyweightSection";
import { NutritionTrendSection } from "@/app/(app)/progress/_components/NutritionTrendSection";
import { PRHistorySection } from "@/app/(app)/progress/_components/PRHistorySection";
import { PRTimelineRow } from "@/app/(app)/progress/_components/PRTimelineRow";
import { WeeklyVolumeSection } from "@/app/(app)/progress/_components/WeeklyVolumeSection";
import { ProgressSegments } from "@/app/(app)/progress/_components/ProgressSegments";
import { ProgressShowAllToggle } from "@/app/(app)/progress/_components/ProgressShowAllToggle";
import { RecentTimeline } from "@/app/(app)/progress/_components/RecentTimeline";
import { StatCard } from "@/components/shared";
import { buildPRSpotlights } from "@/lib/analytics/pr-history";
import {
  buildBodyweightTrend,
  buildNutritionBands,
  buildWeeklyVolumeByGroup,
} from "@/lib/analytics/projections";
import { getSetLogWindow } from "@/lib/analytics/queries";
import { getBodyweightTrend } from "@/lib/bodyweight/queries";
import { getAllWorkouts, getPRTimeline } from "@/lib/history/queries";
import type { PRTimelineRow as PRTimelineRowData } from "@/lib/history/projections";
import {
  getMealsForDateRange,
  getNutritionTargets,
} from "@/lib/nutrition/queries";
import {
  buildRecentTimeline,
  deriveOverviewStats,
} from "@/lib/progress/overview";
import { addDaysToDayKey } from "@/lib/time/appDay";
import { getAppTimezone, getAppToday } from "@/lib/time/server";

const TRENDS_WINDOW_DAYS = 90;
const PR_SPOTLIGHT_LIMIT = 4;
const VOLUME_WEEKS = 8;
const NUTRITION_WINDOW_DAYS = 30;
const BODYWEIGHT_WINDOW_DAYS = 90;
const RECENT_LIMIT = 6;

const dateHeadingFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

// PR timeline grouped by day (same grouping the old /history page used).
function groupRowsByDay(
  rows: PRTimelineRowData[],
): { key: string; label: string; rows: PRTimelineRowData[] }[] {
  const groups: { key: string; label: string; rows: PRTimelineRowData[] }[] =
    [];
  const indexByKey = new Map<string, number>();

  for (const row of rows) {
    const key = row.achieved_at.slice(0, 10);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        label: dateHeadingFormatter
          .format(new Date(row.achieved_at))
          .toUpperCase(),
        rows: [row],
      });
    } else {
      groups[existingIndex].rows.push(row);
    }
  }

  return groups;
}

type ProgressPageProps = {
  searchParams: Promise<{ showAll?: string; view?: string }>;
};

/**
 * /progress — the merged Progress tab (D19/S5): Overview · Trends · History,
 * absorbing the former /trends + /history surfaces. Reskin + WIRE over
 * the EXISTING analytics/history/bodyweight queries (D17) — nothing here rewrites
 * a query. The page (server) fetches every segment's data; ProgressSegments
 * (client) toggles which segment shows. Auth is enforced by (app)/layout.
 */
export default async function ProgressPage({
  searchParams,
}: ProgressPageProps): Promise<JSX.Element> {
  const { showAll: showAllParam, view } = await searchParams;
  const showAll = showAllParam === "1";
  const initialSegment =
    view === "history" ? "History" : view === "trends" ? "Trends" : "Overview";

  const timeZone = await getAppTimezone();
  const today = await getAppToday();
  const now = new Date();

  // --- Shared analytics window (fetch set_logs ONCE; feed the load views,
  //     exactly as the old /trends page derived them). ---
  const setRows = await getSetLogWindow(TRENDS_WINDOW_DAYS);
  const volumeGroups = buildWeeklyVolumeByGroup(setRows, {
    weeks: VOLUME_WEEKS,
    timeZone,
    now,
  });

  // --- Nutrition trend + bodyweight (unchanged queries, re-homed). ---
  const [meals, targets, bodyweight, prTimeline, allWorkouts] =
    await Promise.all([
      getMealsForDateRange(
        addDaysToDayKey(today, -(NUTRITION_WINDOW_DAYS - 1)),
        today,
      ),
      getNutritionTargets(),
      getBodyweightTrend(BODYWEIGHT_WINDOW_DAYS),
      getPRTimeline({ showAll }),
      getAllWorkouts(),
    ]);
  const nutritionSeries = buildNutritionBands(meals, { partialDayKey: today });

  // PR spotlights reuse the timeline this page ALREADY fetched — one query,
  // two surfaces. Estimated 1RM used to live in this slot; it was a derived
  // guess, and these are the real logged events (T2-B).
  const spotlights = buildPRSpotlights(prTimeline, {
    limit: PR_SPOTLIGHT_LIMIT,
    timeZone,
  });

  // --- Overview derivations (pure, from the fetched projections). ---
  const stats = deriveOverviewStats(allWorkouts, prTimeline, {
    todayKey: today,
    timeZone,
  });
  const recent = buildRecentTimeline(allWorkouts, prTimeline, {
    limit: RECENT_LIMIT,
  });

  const prGroups = groupRowsByDay(prTimeline);
  const prEmptyCopy = showAll
    ? "No PRs yet."
    : "No PRs in the last 90 days. Tap All time to see your full history.";

  // ---------------- Segment: OVERVIEW ----------------
  // A tight glance: the three stats, the ONE featured PR graph, and the
  // Recent feed. Every analytical chart lives in the Trends segment below —
  // nothing else belongs here.
  const overview = (
    <>
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          value={stats.workoutsThisMonth}
          label="workouts"
          sublabel="this month"
        />
        <StatCard
          value={stats.prsThisMonth}
          label="PRs"
          sublabel="this month"
        />
        <StatCard
          value={stats.streakDays}
          label="day streak"
          sublabel="current"
        />
      </div>

      {/* Featured per-exercise chart (the most-PR'd lift). The full list + all
          other analytical charts live in the Trends segment. */}
      <PRHistorySection spotlights={spotlights.slice(0, 1)} />

      <RecentTimeline items={recent} todayKey={today} timeZone={timeZone} />
    </>
  );

  // ---------------- Segment: TRENDS ----------------
  // All the analytical charts: the full per-exercise PR history plus the
  // re-homed weekly-volume, bodyweight, and nutrition trends.
  const trends = (
    <>
      <p className="text-sm leading-6 text-muted-foreground">
        Weight and rep PRs per exercise, over time. Tap any to open its full
        history and recent sets.
      </p>
      <PRHistorySection spotlights={spotlights} />
      <WeeklyVolumeSection groups={volumeGroups} />
      <BodyweightSection
        points={
          bodyweight.available ? buildBodyweightTrend(bodyweight.rows) : []
        }
        available={bodyweight.available}
        logDate={today}
      />
      <NutritionTrendSection series={nutritionSeries} targets={targets} />
    </>
  );

  // ---------------- Segment: HISTORY ----------------
  const history = (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="eyebrow mt-2">Personal records</h2>
          <ProgressShowAllToggle showAll={showAll} />
        </div>
        {prGroups.length > 0 ? (
          <div className="flex flex-col gap-2">
            {prGroups.map((group) => (
              <section key={group.key} className="flex flex-col gap-2">
                <h3 className="eyebrow mt-2">{group.label}</h3>
                <ul className="flex flex-col gap-2">
                  {group.rows.map((row) => (
                    <PRTimelineRow key={row.pr_id} row={row} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
            {prEmptyCopy}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow mt-2">All workouts</h2>
        {allWorkouts.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {allWorkouts.map((row) => (
              <AllWorkoutsRow key={row.completion_id} row={row} />
            ))}
          </ul>
        ) : (
          <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
            No completed sessions yet.
          </div>
        )}
      </section>
    </>
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Progress
        </h1>
      </header>

      <ProgressSegments
        overview={overview}
        trends={trends}
        history={history}
        initial={initialSegment}
      />
    </div>
  );
}
