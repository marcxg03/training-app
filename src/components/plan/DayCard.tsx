import { ChevronRight, Moon } from "lucide-react";
import Link from "next/link";

import type { Enums } from "@/lib/supabase/types";
import { SessionSummaryRow } from "@/components/plan/SessionSummaryRow";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export type DayCardSession = {
  workoutType: Enums<"session_type_enum">;
  sessionName: string;
  timing: Enums<"timing_enum">;
  gym: string | null;
  summary: string;
};

type DayCardProps = {
  dayOfWeek: Enums<"day_of_week_enum">;
  dayLabel: string;
  isRestDay: boolean;
  sessions: DayCardSession[];
};

const shortDayLabel: Record<Enums<"day_of_week_enum">, string> = {
  mon: "MON",
  tue: "TUE",
  wed: "WED",
  thu: "THU",
  fri: "FRI",
  sat: "SAT",
  sun: "SUN",
};

export function DayCard({
  dayOfWeek,
  dayLabel,
  isRestDay,
  sessions,
}: DayCardProps) {
  const sessionCount = sessions.length;

  if (isRestDay && sessionCount === 0) {
    return (
      <Link href={`/plan/${dayOfWeek}`} className="group block">
        <div className="flex items-center justify-between rounded-[var(--radius)] border border-dashed border-border px-[18px] py-[18px] transition-colors group-hover:border-faint">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              {shortDayLabel[dayOfWeek]}
            </p>
            <p className="mt-1.5 text-sm font-medium text-faint">Rest day</p>
          </div>
          <Moon className="h-5 w-5 text-ghost" aria-hidden="true" />
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/plan/${dayOfWeek}`} className="group block">
      <Card className="bg-card transition-colors group-hover:border-accent/60">
        <div className="flex items-center gap-2 px-[18px] pb-2 pt-[18px]">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
            {shortDayLabel[dayOfWeek]}
          </span>
          <span className="sr-only">{dayLabel}</span>
          {sessionCount > 0 ? (
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
              {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
            </span>
          ) : null}
          <ChevronRight
            className={cn(
              "h-5 w-5 shrink-0 text-ghost transition-colors group-hover:text-faint",
              sessionCount > 0 ? "ml-2" : "ml-auto",
            )}
            aria-hidden="true"
          />
        </div>

        {isRestDay ? (
          <div className="mx-[18px] mb-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-faint">
            Complete rest day.
          </div>
        ) : null}

        {sessionCount === 0 && !isRestDay ? (
          <p className="px-[18px] pb-[18px] text-sm text-faint">
            No sessions scheduled.
          </p>
        ) : null}

        <div className="divide-y divide-border/60">
          {sessions.map((session) => (
            <SessionSummaryRow
              key={`${session.workoutType}-${session.sessionName}-${session.timing}`}
              workoutType={session.workoutType}
              sessionName={session.sessionName}
              timing={session.timing}
              gym={session.gym}
              summary={session.summary}
            />
          ))}
        </div>
      </Card>
    </Link>
  );
}
