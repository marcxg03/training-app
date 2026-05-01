import type { Enums } from "@/lib/supabase/types";

const shortDayMap: Record<string, Enums<"day_of_week_enum">> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

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
