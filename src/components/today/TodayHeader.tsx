import Link from "next/link";
import { Settings } from "lucide-react";

import type { Enums } from "@/lib/supabase/types";
import { dayOfWeekLabel } from "@/lib/methodology/today";

type TodayHeaderProps = {
  /** The day currently being viewed. */
  dayOfWeek: Enums<"day_of_week_enum">;
  /** Real calendar date (used for the eyebrow on the current day). */
  date: Date;
  /** False when viewing another day of the plan (read-only). */
  isToday: boolean;
  /**
   * The day-type headline for today (e.g. the primary session name, "Upper").
   * When absent (a rest day) the title falls back to "Today".
   */
  dayType?: string | null;
};

function formatDateEyebrow(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
    .format(date)
    .replace(",", " ·");
}

export function TodayHeader({
  dayOfWeek,
  date,
  isToday,
  dayType,
}: TodayHeaderProps) {
  const dayLabel = dayOfWeekLabel(dayOfWeek);
  const title = isToday ? (dayType ?? "Today") : dayLabel;

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
          {isToday ? formatDateEyebrow(date) : "Plan preview · read-only"}
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="sr-only">{dayLabel}</p>
      </div>
      <Link
        href="/settings"
        aria-label="Settings and profile"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card-alt text-subtle transition-colors hover:border-accent/50 hover:text-foreground"
      >
        <Settings className="h-5 w-5" />
      </Link>
    </div>
  );
}
