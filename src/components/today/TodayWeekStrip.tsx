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
};

type WeekDay = {
  key: DayOfWeek;
  label: string;
  /** Visual session-type hint for the dot (presentational only). */
  tone: "lift" | "cardio" | "rest";
};

// Visual-only week rhythm. Dot colors hint session type; the active day is
// resolved from the live schedule via selectedDay.
const weekDays: WeekDay[] = [
  { key: "mon", label: "M", tone: "lift" },
  { key: "tue", label: "T", tone: "lift" },
  { key: "wed", label: "W", tone: "cardio" },
  { key: "thu", label: "T", tone: "lift" },
  { key: "fri", label: "F", tone: "rest" },
  { key: "sat", label: "S", tone: "lift" },
  { key: "sun", label: "S", tone: "rest" },
];

const dotToneClass: Record<WeekDay["tone"], string> = {
  lift: "bg-accent",
  cardio: "bg-cardio",
  rest: "bg-border",
};

export function TodayWeekStrip({
  selectedDay,
  actualDay,
}: TodayWeekStripProps) {
  return (
    <div className="flex justify-between">
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
            className={cn(
              "flex min-w-9 flex-col items-center gap-2 rounded-[10px] py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isSelected ? "bg-accent/[0.12]" : "hover:bg-card-alt",
            )}
          >
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                isSelected
                  ? "font-bold text-accent"
                  : "font-semibold text-faint",
              )}
            >
              {day.label}
            </span>
            <span
              className={cn(
                "h-[7px] w-[7px] rounded-full",
                dotToneClass[day.tone],
                // Ring keeps the real calendar day identifiable even when a
                // different day is selected.
                isActualDay && !isSelected
                  ? "ring-2 ring-accent/70 ring-offset-1 ring-offset-background"
                  : "",
              )}
            />
          </Link>
        );
      })}
    </div>
  );
}
