// Read a display summary out of a `plan_templates.snapshot_json` blob (T3-A).
//
// WHY THIS IS PURE AND DEFENSIVE: `snapshot_json` is a `jsonb` column written
// by the seed (supabase/seed/seed-from-wiki.ts → syncPlanTemplate) as a
// stable-stringified dump of whatever shape TrainingPlanSpec had ON THE DAY IT
// RAN. The six rows in the database right now are NOT the same shape as each
// other — versions 1–3 have no `liftingBlocks`, `cardioActivities` or
// `recoveryActivities` keys at all; versions 4–6 do. There is no migration
// that reconciles them and there should not be: a snapshot is a historical
// record, and rewriting history to suit a list view is how you lose the
// ability to answer "what did the plan look like in May".
//
// So every field here is read through a guard and every one has a fallback.
// A malformed or half-shaped snapshot must render a row, never throw — the
// programs list showing one degraded row is recoverable; the whole hub 500ing
// because a 2026-04-30 snapshot predates a key is not.
//
// No React, no Supabase, no I/O — see scripts/verify-program-summary.ts.

export type ProgramSummary = {
  /** Best available human name, never empty. */
  name: string;
  /** Scheduled days found in the snapshot, or null when the shape is unknown. */
  dayCount: number | null;
  /** Days explicitly marked as rest, or null when unknown. */
  restDayCount: number | null;
  /** True when the snapshot has the post-v4 block keys. */
  hasBlocks: boolean;
  /** Keys present — surfaced in the UI so an odd row is explicable. */
  shapeKeys: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(
  source: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

/**
 * Summarize one snapshot for the programs list.
 *
 * `fallbackName` is used only when the snapshot carries no usable name — pass
 * something that identifies the ROW (e.g. `Version 3`) so a nameless program
 * is still distinguishable from its siblings in the table.
 */
export function summarizeProgramSnapshot(
  snapshot: unknown,
  fallbackName: string,
): ProgramSummary {
  if (!isRecord(snapshot)) {
    return {
      name: fallbackName,
      dayCount: null,
      restDayCount: null,
      hasBlocks: false,
      shapeKeys: [],
    };
  }

  // The seed has written the plan's name under three different keys across the
  // six versions; prefer the most specific.
  const name =
    firstString(snapshot, ["name", "masterPlanTitle", "overviewTitle"]) ??
    fallbackName;

  const days = snapshot.days;
  let dayCount: number | null = null;
  let restDayCount: number | null = null;

  if (Array.isArray(days)) {
    dayCount = days.length;
    restDayCount = days.filter(
      (day) => isRecord(day) && day.isRestDay === true,
    ).length;
  } else if (isRecord(days)) {
    // Older snapshots keyed days by weekday name rather than listing them.
    const entries = Object.values(days);
    dayCount = entries.length;
    restDayCount = entries.filter(
      (day) => isRecord(day) && day.isRestDay === true,
    ).length;
  }

  return {
    name,
    dayCount,
    restDayCount,
    hasBlocks:
      Array.isArray(snapshot.liftingBlocks) ||
      Array.isArray(snapshot.cardioActivities) ||
      Array.isArray(snapshot.recoveryActivities),
    shapeKeys: Object.keys(snapshot).sort(),
  };
}
