import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils/cn";

type TodayWeekStripProps = {
  dayOfWeek: Enums<"day_of_week_enum">;
};

type WeekDay = {
  key: Enums<"day_of_week_enum">;
  label: string;
  /** Visual session-type hint for the dot (presentational only). */
  tone: "lift" | "cardio" | "rest";
};

// Visual-only week rhythm. Dot colors hint session type; the active day is
// resolved from the live schedule via dayOfWeek.
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

export function TodayWeekStrip({ dayOfWeek }: TodayWeekStripProps) {
  return (
    <div className="flex justify-between">
      {weekDays.map((day) => {
        const isActive = day.key === dayOfWeek;

        return (
          <div
            key={day.key}
            className={cn(
              "flex min-w-9 flex-col items-center gap-2 rounded-[10px] py-1.5",
              isActive ? "bg-accent/[0.12]" : "",
            )}
          >
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                isActive ? "font-bold text-accent" : "font-semibold text-faint",
              )}
            >
              {day.label}
            </span>
            <span
              className={cn(
                "h-[7px] w-[7px] rounded-full",
                dotToneClass[day.tone],
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
