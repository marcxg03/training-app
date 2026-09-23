import { dayKeyOf } from "@/lib/analytics/projections";
import { addDaysToDayKey } from "@/lib/time/appDay";
import type { AllWorkoutsRow, PRTimelineRow } from "@/lib/history/projections";

/**
 * Progress · Overview derivations (Slice S5).
 *
 * Pure functions that turn the EXISTING history queries (getAllWorkouts,
 * getPRTimeline) into the Overview segment's stat row + interleaved "Recent"
 * timeline. No query rewrite — these consume the already-fetched projections.
 * Kept pure (no I/O, timezone passed in) so scripts/verify-progress-overview.ts
 * can fixture-test them.
 */

export type OverviewStats = {
  /** Completed sessions started in the current calendar month (app tz). */
  workoutsThisMonth: number;
  /** Sets that earned any PR in the current calendar month (app tz). A single
   *  set can log both a weight and an in-range-rep PR row — those are one
   *  PR-earning set, so this de-dupes by set_log_id and counts sets, not rows. */
  prsThisMonth: number;
  /** Consecutive-day training streak ending today (grace: anchors on
   *  yesterday when today has no session yet, so it isn't zeroed mid-day). */
  streakDays: number;
};

type StatsWorkout = Pick<AllWorkoutsRow, "started_at" | "state">;
type StatsPR = Pick<PRTimelineRow, "achieved_at" | "set_log_id">;

// A day counts as "trained" only when a session that started that day is
// COMPLETE. The workout projection (AllWorkoutsRow) exposes no per-session
// logged-set count, and deriving one would mean modifying the history query
// (D17 — reuse, don't rewrite), so we deliberately count `complete` only: an
// `ended_early` session (even one with logged sets) is NOT counted, and neither
// is `in_progress`. This gates workoutsThisMonth, the streak day set, AND
// buildRecentTimeline, so all three agree on the same definition of "trained".
function isCounted(state: AllWorkoutsRow["state"]): boolean {
  return state === "complete";
}

function computeStreak(dayKeys: string[], todayKey: string): number {
  const days = new Set(dayKeys);
  if (days.size === 0) {
    return 0;
  }

  // Anchor on today if trained today, else yesterday (grace window) so an
  // active streak survives until the day is actually skipped.
  let cursor = days.has(todayKey) ? todayKey : addDaysToDayKey(todayKey, -1);
  if (!days.has(cursor)) {
    return 0;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDaysToDayKey(cursor, -1);
  }
  return streak;
}

export function deriveOverviewStats(
  workouts: StatsWorkout[],
  prs: StatsPR[],
  opts: { todayKey: string; timeZone: string },
): OverviewStats {
  const monthPrefix = opts.todayKey.slice(0, 7); // YYYY-MM

  const completed = workouts.filter((w) => isCounted(w.state));

  const workoutsThisMonth = completed.filter(
    (w) => dayKeyOf(w.started_at, opts.timeZone).slice(0, 7) === monthPrefix,
  ).length;

  // De-dupe by set_log_id: one set that earned both a weight + rep PR is a
  // single PR-earning set, not two (matches buildRecentTimeline below).
  const prSetLogIdsThisMonth = new Set(
    prs
      .filter(
        (p) =>
          dayKeyOf(p.achieved_at, opts.timeZone).slice(0, 7) === monthPrefix,
      )
      .map((p) => p.set_log_id),
  );
  const prsThisMonth = prSetLogIdsThisMonth.size;

  const streakDays = computeStreak(
    completed.map((w) => dayKeyOf(w.started_at, opts.timeZone)),
    opts.todayKey,
  );

  return { workoutsThisMonth, prsThisMonth, streakDays };
}

export type RecentTimelineItem =
  | { kind: "pr"; iso: string; pr: PRTimelineRow }
  | { kind: "session"; iso: string; session: AllWorkoutsRow };

/**
 * Interleave recent PRs and completed sessions into one reverse-chronological
 * feed (the Overview "Recent" list). Ties (same instant) put the PR before the
 * session so a session's own PRs read above the session summary. PRs are
 * de-duped by set_log_id — a set that earned both a weight and an in-range-rep
 * PR is one entry, not two ▲ rows (the first-seen row wins, and `prs` arrives
 * newest-first from getPRTimeline).
 */
export function buildRecentTimeline(
  workouts: AllWorkoutsRow[],
  prs: PRTimelineRow[],
  opts: { limit: number },
): RecentTimelineItem[] {
  const seenSetLogIds = new Set<string>();
  const dedupedPrs = prs.filter((pr) => {
    if (seenSetLogIds.has(pr.set_log_id)) {
      return false;
    }
    seenSetLogIds.add(pr.set_log_id);
    return true;
  });

  const items: RecentTimelineItem[] = [
    ...dedupedPrs.map(
      (pr): RecentTimelineItem => ({ kind: "pr", iso: pr.achieved_at, pr }),
    ),
    ...workouts
      .filter((session) => isCounted(session.state))
      .map(
        (session): RecentTimelineItem => ({
          kind: "session",
          iso: session.started_at,
          session,
        }),
      ),
  ];

  items.sort((a, b) => {
    if (a.iso !== b.iso) {
      return a.iso < b.iso ? 1 : -1; // newest first
    }
    // Same instant: PR before session.
    if (a.kind === b.kind) {
      return 0;
    }
    return a.kind === "pr" ? -1 : 1;
  });

  return items.slice(0, opts.limit);
}
