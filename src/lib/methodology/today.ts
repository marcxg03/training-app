import type { Enums } from "@/lib/supabase/types";

type DayOfWeek = Enums<"day_of_week_enum">;

const shortDayMap: Record<string, DayOfWeek> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

/** Calendar order Mon→Sun, used by week strips and day pickers. */
export const DAYS_OF_WEEK: DayOfWeek[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

const dayOfWeekLabels: Record<DayOfWeek, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Full weekday name for a day-of-week enum, e.g. "mon" → "Monday". */
export function dayOfWeekLabel(day: DayOfWeek): string {
  return dayOfWeekLabels[day];
}

/**
 * Narrow an untrusted value (e.g. a URL search param) to a valid day-of-week
 * enum, or return null when it is not one. Keeps day-picker routing safe
 * without throwing on arbitrary input.
 */
export function parseDayOfWeek(value: unknown): DayOfWeek | null {
  return typeof value === "string" && (DAYS_OF_WEEK as string[]).includes(value)
    ? (value as DayOfWeek)
    : null;
}

export function getTodayDayOfWeek(date: Date = new Date()) {
  const shortDay = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(date);
  const dayOfWeek = shortDayMap[shortDay];

  if (!dayOfWeek) {
    throw new Error(`Unsupported weekday value: ${shortDay}`);
  }

  return dayOfWeek;
}
