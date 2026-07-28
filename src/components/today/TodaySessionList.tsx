import type { Enums } from "@/lib/supabase/types";
import { TodaySessionCard } from "@/components/today/TodaySessionCard";

export type TodaySessionListItem = {
  workoutId: string;
  workoutType: Enums<"session_type_enum">;
  workoutName: string;
  timing: Enums<"timing_enum">;
  gym: string | null;
  displayOrder: number;
  /** True when a lifting workout has a finished completion logged today. */
  completed: boolean;
  summary: string;
};

type TodaySessionListProps = {
  sessions: TodaySessionListItem[];
  /** The day these sessions belong to (carried into detail/back links). */
  day: Enums<"day_of_week_enum">;
  /** When true, hide logging entry points — viewing a non-current day. */
  readOnly?: boolean;
  /** Section heading; defaults to today's wording. */
  heading?: string;
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

export function TodaySessionList({
  sessions,
  day,
  readOnly = false,
  heading = "Today's sessions",
}: TodaySessionListProps) {
  const sortedSessions = [...sessions].sort(sortSessions);

  return (
    <div className="space-y-3">
      <p className="eyebrow">{heading}</p>
      {sortedSessions.map((session) => (
        <TodaySessionCard
          key={session.workoutId}
          session={session}
          day={day}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
