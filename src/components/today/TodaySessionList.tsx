import type { Enums } from "@/lib/supabase/types";
import { TodaySessionCard } from "@/components/today/TodaySessionCard";

export type TodaySessionListItem = {
  sessionId: string;
  sessionType: Enums<"session_type_enum">;
  sessionName: string;
  timing: Enums<"timing_enum">;
  gym: string | null;
  displayOrder: number;
  summary: string;
};

type TodaySessionListProps = {
  sessions: TodaySessionListItem[];
};

const timingOrder: Record<Enums<"timing_enum">, number> = {
  am: 0,
  anytime: 1,
  pm: 2,
};

function sortSessions(left: TodaySessionListItem, right: TodaySessionListItem) {
  const timingDelta = timingOrder[left.timing] - timingOrder[right.timing];

  if (timingDelta !== 0) {
    return timingDelta;
  }

  return left.displayOrder - right.displayOrder;
}

export function TodaySessionList({ sessions }: TodaySessionListProps) {
  const sortedSessions = [...sessions].sort(sortSessions);

  return (
    <div className="space-y-4">
      {sortedSessions.map((session) => (
        <TodaySessionCard key={session.sessionId} session={session} />
      ))}
    </div>
  );
}
