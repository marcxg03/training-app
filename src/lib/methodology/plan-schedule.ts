import type { Enums } from "@/lib/supabase/types";

// Pure schedule-validation methodology for the Plan Editor. No React, no
// Supabase — plain functions over plain data. v1 implements the two rules that
// are computable without a muscle-group / recovery-activity engine; the rest
// are tracked in FUTURE_WORK.

type SessionType = Enums<"session_type_enum">;
type Timing = Enums<"timing_enum">;

export type EditableWorkout = {
  workout_type: SessionType;
  timing: Timing;
  display_order: number;
};

const TIMING_ORDER: Record<Timing, number> = { am: 0, anytime: 1, pm: 2 };

function sortByTimingThenOrder(a: EditableWorkout, b: EditableWorkout): number {
  const delta = TIMING_ORDER[a.timing] - TIMING_ORDER[b.timing];
  return delta !== 0 ? delta : a.display_order - b.display_order;
}

/** Soft rule: cardio scheduled before lifting on the same day. */
export function daySoftWarnings(workouts: EditableWorkout[]): string[] {
  const ordered = [...workouts].sort(sortByTimingThenOrder);
  const firstLiftingIndex = ordered.findIndex(
    (w) => w.workout_type === "lifting",
  );
  if (firstLiftingIndex === -1) {
    return [];
  }
  const cardioBeforeLifting = ordered
    .slice(0, firstLiftingIndex)
    .some((w) => w.workout_type === "cardio");

  return cardioBeforeLifting
    ? ["Cardio is scheduled before lifting on this day."]
    : [];
}

export type ScheduleValidation = {
  hardErrors: string[];
  softWarnings: string[];
};

// Slice B2 (D5/D10): the methodology guardrails no longer HARD-block the editor.
// The only former hard rule here — "keep at least one rest day" — is cut, because
// a valid block can legitimately have no full rest day (Block II's Sunday is ATG
// recovery, not rest). validateSchedule therefore never returns hardErrors; it
// keeps the informational SOFT layer (cardio-before-lift) so the "Save anyway"
// affordance still surfaces advice without blocking. Signature preserved so
// DayEditForm keeps compiling.
export function validateSchedule(input: {
  isRestDay: boolean;
  workouts: EditableWorkout[];
  otherDaysHaveRest: boolean;
}): ScheduleValidation {
  // A rest day carries no workout-timing warnings.
  const softWarnings = input.isRestDay ? [] : daySoftWarnings(input.workouts);

  return { hardErrors: [], softWarnings };
}
