import Link from "next/link";

import { SessionSummaryRow } from "@/components/plan/SessionSummaryRow";
import { StartWorkoutButton } from "@/components/today/StartWorkoutButton";
import type { TodaySessionListItem } from "@/components/today/TodaySessionList";
import type { Enums } from "@/lib/supabase/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

type TodaySessionCardProps = {
  session: TodaySessionListItem;
  /** Day the session belongs to; carried into the detail link. */
  day: Enums<"day_of_week_enum">;
  /** When true, hide the Start Workout entry point (non-current day). */
  readOnly?: boolean;
};

// Decorative progress pips matching the Instrument lift card (presentational).
const liftPips = ["bg-accent", "bg-accent opacity-55", "bg-accent opacity-30"];

export function TodaySessionCard({
  session,
  day,
  readOnly = false,
}: TodaySessionCardProps) {
  const isLift = session.workoutType === "lifting";
  // Non-current days pass ?day so the detail page resolves against that day and
  // suppresses its own logging entry point.
  const detailHref = readOnly
    ? `/today/workout/${session.workoutId}?day=${day}`
    : `/today/workout/${session.workoutId}`;

  return (
    <Card className="bg-card transition-colors hover:border-accent/60">
      <CardContent className="p-0">
        <Link
          href={detailHref}
          className="block rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <SessionSummaryRow
            workoutType={session.workoutType}
            sessionName={session.workoutName}
            timing={session.timing}
            gym={session.gym}
            summary={session.summary}
          />
        </Link>
      </CardContent>
      {isLift && !readOnly ? (
        <CardFooter className="flex-col items-stretch gap-4 px-[18px] pb-[18px] pt-0">
          <div className="flex gap-1.5">
            {liftPips.map((tone, index) => (
              <span key={index} className={`h-1 flex-1 rounded-full ${tone}`} />
            ))}
          </div>
          <StartWorkoutButton workoutId={session.workoutId} />
        </CardFooter>
      ) : null}
    </Card>
  );
}
