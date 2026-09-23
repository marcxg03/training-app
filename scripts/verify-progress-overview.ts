/**
 * verify-progress-overview — fixture tests for src/lib/progress/overview.ts.
 * Guards S5's Overview derivations (stat row + interleaved Recent feed).
 * Run: pnpm exec tsx scripts/verify-progress-overview.ts
 * Exits non-zero on any failure. No test framework needed.
 */
import {
  deriveOverviewStats,
  buildRecentTimeline,
  type RecentTimelineItem,
} from "../src/lib/progress/overview";
import type {
  AllWorkoutsRow,
  PRTimelineRow,
} from "../src/lib/history/projections";
import { DEFAULT_APP_TIMEZONE } from "../src/lib/time/appDay";

const TZ = DEFAULT_APP_TIMEZONE; // America/Chicago
let failed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(
      `✗ ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`,
    );
  }
}

// Noon-UTC on a day → same calendar day in Chicago (avoids tz-boundary flake).
function w(
  completion_id: string,
  dayKey: string,
  state: AllWorkoutsRow["state"] = "complete",
): AllWorkoutsRow {
  return {
    completion_id,
    workout_display_name: `Session · ${dayKey}`,
    started_at: `${dayKey}T12:00:00Z`,
    state,
    blocks_completed_count: 5,
    blocks_total_count: 6,
    pr_count: 1,
  };
}

function pr(
  pr_id: string,
  dayKey: string,
  opts: { set_log_id?: string; pr_type?: PRTimelineRow["pr_type"] } = {},
): PRTimelineRow {
  return {
    pr_id,
    achieved_at: `${dayKey}T12:00:00Z`,
    exercise_id: `ex-${pr_id}`,
    exercise_name: `Ex ${pr_id}`,
    pr_type: opts.pr_type ?? "weight",
    weight_kg: 100,
    reps: 5,
    is_bodyweight: false,
    set_log_id: opts.set_log_id ?? `sl-${pr_id}`,
    completion_id: `c-${pr_id}`,
    workout_display_name: "W",
  };
}

// --- deriveOverviewStats: month counting ---
{
  const workouts = [w("a", "2026-09-01"), w("b", "2026-09-20"), w("c", "2026-08-31")];
  const prs = [pr("p1", "2026-09-05"), pr("p2", "2026-08-15")];
  const stats = deriveOverviewStats(workouts, prs, {
    todayKey: "2026-09-23",
    timeZone: TZ,
  });
  check("workoutsThisMonth counts only Sep sessions", stats.workoutsThisMonth, 2);
  check("prsThisMonth counts only Sep PRs", stats.prsThisMonth, 1);
}

// --- deriveOverviewStats: in-progress excluded from counts ---
{
  const workouts = [w("a", "2026-09-20"), w("b", "2026-09-21", "in_progress")];
  const stats = deriveOverviewStats(workouts, [], {
    todayKey: "2026-09-23",
    timeZone: TZ,
  });
  check("in-progress session not counted", stats.workoutsThisMonth, 1);
}

// --- deriveOverviewStats: ended_early sessions are NOT counted (complete-only) ---
// isCounted counts `complete` only. AllWorkoutsRow exposes no per-session set
// count (deriving one would mean a new/modified query — D17), so an ended_early
// session is never counted, whether or not it logged sets. Both a "with sets"
// (blocks/PRs > 0) and a "without sets" (all zero) ended_early row are excluded.
{
  const endedEarlyWithSets: AllWorkoutsRow = {
    completion_id: "ee-sets",
    workout_display_name: "Session · 2026-09-21",
    started_at: "2026-09-21T12:00:00Z",
    state: "ended_early",
    blocks_completed_count: 3,
    blocks_total_count: 6,
    pr_count: 1,
  };
  const endedEarlyNoSets: AllWorkoutsRow = {
    completion_id: "ee-empty",
    workout_display_name: "Session · 2026-09-20",
    started_at: "2026-09-20T12:00:00Z",
    state: "ended_early",
    blocks_completed_count: 0,
    blocks_total_count: 6,
    pr_count: 0,
  };
  // A complete session yesterday (09-22), then ended_early days 09-21/09-20.
  const workouts = [
    w("done", "2026-09-22"),
    endedEarlyWithSets,
    endedEarlyNoSets,
  ];
  const stats = deriveOverviewStats(workouts, [], {
    todayKey: "2026-09-23",
    timeZone: TZ,
  });
  check(
    "ended_early sessions (with OR without sets) not counted in workoutsThisMonth",
    stats.workoutsThisMonth,
    1,
  );
  // Grace anchor lands on yesterday (09-22, complete) → streak 1; the
  // ended_early 09-21/09-20 days do NOT extend it past the complete day.
  check("ended_early days do not extend the streak", stats.streakDays, 1);
  const feed = buildRecentTimeline(workouts, [], { limit: 10 });
  check(
    "ended_early sessions excluded from Recent feed",
    feed.length,
    1,
  );
}

// --- deriveOverviewStats + buildRecentTimeline: PR dedupe by set_log_id ---
// One set that earns BOTH a weight and an in-range-rep PR emits two pr_history
// rows sharing a set_log_id — that is one PR-earning set, not two.
{
  const prs = [
    pr("weight", "2026-09-10", { set_log_id: "sl-shared", pr_type: "weight" }),
    pr("rep", "2026-09-10", {
      set_log_id: "sl-shared",
      pr_type: "in_range_rep",
    }),
  ];
  const stats = deriveOverviewStats([], prs, {
    todayKey: "2026-09-23",
    timeZone: TZ,
  });
  check(
    "two PR rows sharing a set_log_id count as one PR this month",
    stats.prsThisMonth,
    1,
  );
  const feed = buildRecentTimeline([], prs, { limit: 10 });
  check(
    "two PR rows sharing a set_log_id yield one Recent entry",
    feed.filter((i) => i.kind === "pr").length,
    1,
  );
}

// --- deriveOverviewStats: streak (grace anchor on yesterday) ---
{
  // No session today (09-23); yesterday + the two before → streak 3.
  const workouts = [
    w("a", "2026-09-22"),
    w("b", "2026-09-21"),
    w("c", "2026-09-20"),
    w("gap", "2026-09-18"),
  ];
  const stats = deriveOverviewStats(workouts, [], {
    todayKey: "2026-09-23",
    timeZone: TZ,
  });
  check("streak anchors on yesterday and stops at the gap", stats.streakDays, 3);
}

// --- deriveOverviewStats: streak broken (gap at yesterday too) ---
{
  const workouts = [w("a", "2026-09-20")]; // today=23, yesterday=22 both empty
  const stats = deriveOverviewStats(workouts, [], {
    todayKey: "2026-09-23",
    timeZone: TZ,
  });
  check("streak is 0 when neither today nor yesterday trained", stats.streakDays, 0);
}

// --- deriveOverviewStats: streak counts today when trained today ---
{
  const workouts = [w("a", "2026-09-23"), w("b", "2026-09-22")];
  const stats = deriveOverviewStats(workouts, [], {
    todayKey: "2026-09-23",
    timeZone: TZ,
  });
  check("streak includes today when trained today", stats.streakDays, 2);
}

// --- buildRecentTimeline: interleave newest-first, PR before session on tie ---
{
  const workouts = [w("s-early", "2026-09-19"), w("s-late", "2026-09-22")];
  const prs = [pr("p-mid", "2026-09-20"), pr("p-tie", "2026-09-22")];
  const feed = buildRecentTimeline(workouts, prs, { limit: 10 });
  const shape = feed.map((i: RecentTimelineItem) =>
    i.kind === "pr" ? `pr:${i.pr.pr_id}` : `session:${i.session.completion_id}`,
  );
  // 09-22 tie: PR p-tie before session s-late; then p-mid (20), then s-early (19).
  check("interleave order (newest first, PR-before-session tie)", shape, [
    "pr:p-tie",
    "session:s-late",
    "pr:p-mid",
    "session:s-early",
  ]);
}

// --- buildRecentTimeline: limit + in-progress session excluded ---
{
  const workouts = [
    w("s1", "2026-09-22"),
    w("s2", "2026-09-21", "in_progress"),
    w("s3", "2026-09-20"),
  ];
  const feed = buildRecentTimeline(workouts, [], { limit: 2 });
  check("limit respected", feed.length, 2);
  check(
    "no in-progress in feed",
    feed.some((i) => i.kind === "session" && i.session.completion_id === "s2"),
    false,
  );
}

if (failed > 0) {
  console.error(`\n${failed} progress-overview assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll progress-overview assertions passed.");
