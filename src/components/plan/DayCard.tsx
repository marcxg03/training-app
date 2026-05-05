import Link from "next/link";

import type { Enums } from "@/lib/supabase/types";
import { SessionSummaryRow } from "@/components/plan/SessionSummaryRow";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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

export function DayCard({
  dayOfWeek,
  dayLabel,
  isRestDay,
  sessions,
}: DayCardProps) {
  return (
    <Link href={`/plan/${dayOfWeek}`} className="group block">
      <Card className="bg-card/80 transition-colors group-hover:border-accent/60">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Weekly Plan
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {dayLabel}
            </h2>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:border-accent/60 group-hover:text-foreground">
            View Day
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          {isRestDay ? (
            <div className="rounded-xl border border-dashed border-border/80 px-4 py-3 text-sm text-muted-foreground">
              Complete rest day.
            </div>
          ) : null}
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
        </CardContent>
      </Card>
    </Link>
  );
}
