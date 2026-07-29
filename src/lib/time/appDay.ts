import type { Enums } from "@/lib/supabase/types";

// The app's day clock, timezone-explicit. Pure — no React, no Supabase —
// so the 7pm-Central day-rollover class of bug is pinned by fixtures
// (scripts/verify-analytics.ts). Server code resolves the tz from the
// profile via lib/time/server.ts; these helpers do the math.

export const DEFAULT_APP_TIMEZONE = "America/Chicago";

type DayOfWeek = Enums<"day_of_week_enum">;

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();
const weekdayFormatters = new Map<string, Intl.DateTimeFormat>();

function dayKeyFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayKeyFormatters.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayKeyFormatters.set(timeZone, formatter);
  }

  return formatter;
}

function weekdayFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = weekdayFormatters.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    });
    weekdayFormatters.set(timeZone, formatter);
  }

  return formatter;
}

const shortDayMap: Record<string, DayOfWeek> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

/** YYYY-MM-DD of `date` in the given timezone. */
export function dateStringInTz(
  timeZone: string,
  date: Date = new Date(),
): string {
  return dayKeyFormatterFor(timeZone).format(date);
}

/** Day-of-week enum of `date` in the given timezone. */
export function dayOfWeekInTz(
  timeZone: string,
  date: Date = new Date(),
): DayOfWeek {
  const shortDay = weekdayFormatterFor(timeZone).format(date);
  const dayOfWeek = shortDayMap[shortDay];

  if (!dayOfWeek) {
    throw new Error(`Unsupported weekday value: ${shortDay}`);
  }

  return dayOfWeek;
}

/** Day key (YYYY-MM-DD in `timeZone`) of the instant `days` days before
 * `now` — window boundaries aligned to whole app-days. */
export function dayKeyDaysAgo(
  days: number,
  timeZone: string,
  now: Date = new Date(),
): string {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return dateStringInTz(timeZone, date);
}

/** Pure day-key arithmetic: dayKey + delta days (noon-UTC anchored, so it is
 * immune to DST and timezone offsets). */
export function addDaysToDayKey(dayKey: string, delta: number): string {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();

function wallClockFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = wallClockFormatters.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    wallClockFormatters.set(timeZone, formatter);
  }

  return formatter;
}

// The wall-clock reading (in timeZone) of an instant, re-encoded as a UTC
// timestamp — the standard trick for computing a timezone's offset without
// a tz library.
function wallClockMs(timeZone: string, epochMs: number): number {
  const parts: Record<string, string> = {};

  for (const part of wallClockFormatterFor(timeZone).formatToParts(
    new Date(epochMs),
  )) {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
  }

  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
}

/** The UTC instant of midnight (start of day) of `dayKey` in `timeZone` —
 * e.g. Chicago 2026-07-28 -> 2026-07-28T05:00:00Z. Used for "did this
 * timestamp happen today (app day)" DB boundaries. Two-pass offset
 * correction handles DST transitions. */
export function startOfDayInTzIso(timeZone: string, dayKey: string): string {
  const target = new Date(`${dayKey}T00:00:00Z`).getTime();
  let instant = target;

  for (let i = 0; i < 2; i++) {
    instant += target - wallClockMs(timeZone, instant);
  }

  return new Date(instant).toISOString();
}

/** True when `timeZone` is a valid IANA identifier on this runtime. */
export function isValidTimezone(timeZone: string): boolean {
  try {
    dayKeyFormatterFor(timeZone);
    return true;
  } catch {
    dayKeyFormatters.delete(timeZone);
    return false;
  }
}
