import Link from "next/link";
import { ChevronDown, Settings } from "lucide-react";

import type { Enums } from "@/lib/supabase/types";

type TodayHeaderProps = {
  dayOfWeek: Enums<"day_of_week_enum">;
  date: Date;
};

const dayLabels: Record<Enums<"day_of_week_enum">, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
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

export function TodayHeader({ dayOfWeek, date }: TodayHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
            My Training
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-faint" />
        </div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
          {formatDateEyebrow(date)}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Today
        </h1>
        <p className="sr-only">{dayLabels[dayOfWeek]}</p>
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
