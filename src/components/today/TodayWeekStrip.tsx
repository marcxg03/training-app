import Link from "next/link";

import type { Enums } from "@/lib/supabase/types";
import { dayOfWeekLabel } from "@/lib/methodology/today";
import { cn } from "@/lib/utils/cn";

type DayOfWeek = Enums<"day_of_week_enum">;

type TodayWeekStripProps = {
  /** The day currently being viewed (highlighted). */
  selectedDay: DayOfWeek;
  /** The real calendar day, marked so it stays distinguishable from selection. */
  actualDay: DayOfWeek;
  /** Day-of-month number for each weekday in the current week (real dates). */
  weekDates: Record<DayOfWeek, number>;
};

type WeekDay = {
  key: DayOfWeek;
  label: string;
};

// Calendar order Mon→Sun; the active day is resolved from the live schedule via
// selectedDay and the real day is marked via actualDay.
const weekDays: WeekDay[] = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];

export function TodayWeekStrip({
  selectedDay,
  actualDay,
  weekDates,
}: TodayWeekStripProps) {
  return (
    <div className="flex items-center justify-between px-1">
      {weekDays.map((day) => {
        const isSelected = day.key === selectedDay;
        const isActualDay = day.key === actualDay;
        // The real day links back to the canonical /today URL; other days carry
        // the ?day param so the page renders that day read-only.
        const href = isActualDay ? "/today" : `/today?day=${day.key}`;

        return (
          <Link
            key={day.key}
            href={href}
            aria-label={`View ${dayOfWeekLabel(day.key)}${isActualDay ? " (today)" : ""}`}
            aria-current={isSelected ? "page" : undefined}
            className="flex flex-col items-center gap-1 rounded-[10px] px-1 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="text-[10px] uppercase text-faint">
              {day.label}
            </span>
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                isSelected
                  ? "bg-accent text-accent-foreground"
                  : "bg-input text-subtle",
                // Ring keeps the real calendar day identifiable even when a
                // different day is selected.
                isActualDay && !isSelected
                  ? "ring-2 ring-accent/60 ring-offset-1 ring-offset-background"
                  : "",
              )}
            >
              {weekDates[day.key]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
