import type { Enums } from "@/lib/supabase/types";

// Pure methodology for the Plan week's per-day session-type dot (Slice S4, D19).
// No React, no Supabase — plain functions over plain data, unit-testable under
// `tsx` (see scripts/verify-plan-dots.ts).
//
// D19 palette intent: accent = lift, warning = sport/basketball, cardio-teal =
// HYROX/conditioning, border/grey = rest. The real `session_type_enum` is
// `lifting | cardio | recovery` (+ a per-day `is_rest_day` flag) and has NO
// dedicated "sport" value — so basketball currently rides its stored type
// (typically `cardio` → the conditioning lane). The "sport" token is kept in
// the palette, reserved for a future schema distinction; nothing produces it
// today. Flagged for the desktop builder / a future data-shape decision.

type SessionType = Enums<"session_type_enum">;

/** The four dot lanes from the /demo Plan screen. */
export type PlanDotKind = "lift" | "sport" | "cond" | "rest";

/** Tailwind background token for each dot lane (matches /demo verbatim). */
export const PLAN_DOT_COLOR: Record<PlanDotKind, string> = {
  lift: "bg-accent",
  sport: "bg-warning",
  cond: "bg-cardio",
  rest: "bg-border",
};

/** Map a single session type to its dot lane. */
export function sessionTypeToDotKind(type: SessionType): PlanDotKind {
  switch (type) {
    case "lifting":
      return "lift";
    case "cardio":
      return "cond";
    case "recovery":
      return "rest";
  }
}

// A day can hold several sessions; the dot shows ONE representative lane.
// Priority mirrors the day's headline: a lift day reads as a lift even when it
// also carries conditioning; conditioning outranks a recovery-only day.
const KIND_PRIORITY: Record<PlanDotKind, number> = {
  lift: 0,
  sport: 1,
  cond: 2,
  rest: 3,
};

/**
 * The representative dot lane for a whole day. A `is_rest_day` flag (or a day
 * with no sessions) is always `rest`; otherwise the highest-priority lane among
 * the day's sessions wins (lift > sport > cond > rest).
 */
export function dayDotKind(input: {
  isRestDay: boolean;
  sessionTypes: SessionType[];
}): PlanDotKind {
  if (input.isRestDay || input.sessionTypes.length === 0) {
    return "rest";
  }

  return input.sessionTypes
    .map(sessionTypeToDotKind)
    .reduce((best, kind) =>
      KIND_PRIORITY[kind] < KIND_PRIORITY[best] ? kind : best,
    );
}
