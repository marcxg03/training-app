// =============================================================================
// Presentation helpers for the coaching UI. Pure formatting only — no Supabase,
// no React.
// =============================================================================

import type {
  ClientTargets,
  CoachClient,
  CoachGoalMode,
} from "@/lib/coach/types";
import { kgToLbs } from "@/lib/units";

const GOAL_MODE_LABELS: Record<CoachGoalMode, string> = {
  cut: "Cut",
  maintain: "Maintain",
  lean_bulk: "Lean bulk",
};

export function goalModeLabel(mode: CoachGoalMode): string {
  return GOAL_MODE_LABELS[mode];
}

/** Uppercase status line for a client header, e.g. "LEAN BULK · ACTIVE TODAY". */
export function clientStatusLine(client: CoachClient): string {
  const goal = goalModeLabel(client.goalMode).toUpperCase();

  if (client.status === "invited") {
    return `${goal} · INVITE PENDING`;
  }

  return `${goal} · ACTIVE ${client.lastActiveLabel.toUpperCase()}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Human relative-day label for a client's last activity, e.g. "Today",
 * "Yesterday", "5 days ago". Returns "No activity yet" when null. `now` is
 * passed in so callers (server) own the clock.
 */
export function relativeActivityLabel(iso: string | null, now: Date): string {
  if (!iso) {
    return "No activity yet";
  }

  const then = new Date(iso);
  const days = Math.floor(
    (startOfDay(now).getTime() - startOfDay(then).getTime()) / DAY_MS,
  );

  if (days <= 0) {
    return "Today";
  }
  if (days === 1) {
    return "Yesterday";
  }
  return `${days} days ago`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Format a PR as the roster/review pill, e.g. "245×5" (weighted) or "BW×12"
 * (bodyweight). Weight is converted from stored kg to display lbs.
 */
export function formatPrResult(
  weightKg: number | null,
  reps: number,
  isBodyweight: boolean,
): string {
  if (isBodyweight || weightKg === null || weightKg === 0) {
    return `BW×${reps}`;
  }

  return `${Math.round(kgToLbs(weightKg))}×${reps}`;
}

/** One-line targets summary, e.g. "Lean bulk · 2,400–2,700 kcal". */
export function targetsSummary(targets: ClientTargets): string {
  return `${goalModeLabel(targets.goalMode)} · ${targets.calMin.toLocaleString()}–${targets.calMax.toLocaleString()} kcal`;
}
