import Link from "next/link";
import { Settings } from "lucide-react";

import { PersonaSwitcher } from "@/components/coach/PersonaSwitcher";
import type { Enums } from "@/lib/supabase/types";
import { dayOfWeekLabel } from "@/lib/methodology/today";

type TodayHeaderProps = {
  /** The day currently being viewed. */
  dayOfWeek: Enums<"day_of_week_enum">;
  /** Real calendar date (used for the eyebrow on the current day). */
  date: Date;
  /** False when viewing another day of the plan (read-only). */
  isToday: boolean;
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

export function TodayHeader({ dayOfWeek, date, isToday }: TodayHeaderProps) {
  const dayLabel = dayOfWeekLabel(dayOfWeek);

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="mb-3.5">
          <PersonaSwitcher active="training" />
        </div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
          {isToday ? formatDateEyebrow(date) : "Plan preview · read-only"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          {isToday ? "Today" : dayLabel}
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
