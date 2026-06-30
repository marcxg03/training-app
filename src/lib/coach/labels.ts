// =============================================================================
// MOCK presentation helpers for the coaching UI. Pure formatting only — safe to
// keep when the real data layer lands. No Supabase, no React.
// =============================================================================

import type { CoachClient, CoachGoalMode } from "@/lib/coach/types";

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
