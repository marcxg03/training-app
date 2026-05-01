import Link from "next/link";

import { SessionSummaryRow } from "@/components/plan/SessionSummaryRow";
import { StartWorkoutButton } from "@/components/today/StartWorkoutButton";
import type { TodaySessionListItem } from "@/components/today/TodaySessionList";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

type TodaySessionCardProps = {
  session: TodaySessionListItem;
};

export function TodaySessionCard({ session }: TodaySessionCardProps) {
  return (
    <Card className="bg-card/80 transition-colors hover:border-accent/60">
      <CardContent className="p-0">
        <Link
          href={`/today/session/${session.sessionId}`}
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <SessionSummaryRow
            sessionType={session.sessionType}
            sessionName={session.sessionName}
            timing={session.timing}
            gym={session.gym}
            summary={session.summary}
          />
        </Link>
      </CardContent>
      {session.sessionType === "lifting" ? (
        <CardFooter className="px-4 pb-4 pt-0">
          <StartWorkoutButton sessionId={session.sessionId} />
        </CardFooter>
      ) : null}
    </Card>
  );
}
