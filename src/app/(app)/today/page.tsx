import type { QueryData } from "@supabase/supabase-js";

import type { Enums } from "@/lib/supabase/types";
import { TodayHeader } from "@/components/today/TodayHeader";
import {
  TodaySessionList,
  type TodaySessionListItem,
} from "@/components/today/TodaySessionList";
import { RestDayEmpty } from "@/components/today/RestDayEmpty";
import { getTodayDayOfWeek } from "@/lib/methodology/today";
import { createClient } from "@/lib/supabase/server";

const timingOrder: Record<Enums<"timing_enum">, number> = {
  am: 0,
  anytime: 1,
  pm: 2,
};

type TodaySessionRow = {
  session_id: string;
  session_type: Enums<"session_type_enum">;
  session_name: string;
  timing: Enums<"timing_enum">;
  gym: string | null;
  description: string | null;
  cardio_distance: string | null;
  cardio_target_zone: Enums<"cardio_target_zone_enum"> | null;
  display_order: number;
};

function sortSessions(left: TodaySessionRow, right: TodaySessionRow) {
  const timingDelta = timingOrder[left.timing] - timingOrder[right.timing];

  if (timingDelta !== 0) {
    return timingDelta;
  }

  return left.display_order - right.display_order;
}

function formatCardioZone(zone: Enums<"cardio_target_zone_enum"> | null) {
  if (!zone) {
    return null;
  }

  return zone
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildSessionSummary(session: TodaySessionRow) {
  if (session.session_type === "cardio") {
    const parts = [
      session.cardio_distance,
      formatCardioZone(session.cardio_target_zone),
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" · ");
    }

    return session.description ?? "Cardio session.";
  }

  if (session.session_type === "recovery") {
    return session.description ?? "Recovery session.";
  }

  return (
    session.description ??
    "Open session detail to view blocks and exercise bank."
  );
}

async function getTodaySessions(dayOfWeek: Enums<"day_of_week_enum">) {
  const supabase = await createClient();
  const query = supabase
    .from("daily_schedules")
    .select(
      `
        schedule_id,
        day_of_week,
        is_rest_day,
        sessions (
          session_id,
          session_type,
          session_name,
          timing,
          gym,
          description,
          cardio_distance,
          cardio_target_zone,
          display_order
        ),
        training_plans!inner (
          plan_id,
          is_active
        )
      `,
    )
    .eq("day_of_week", dayOfWeek)
    .eq("training_plans.is_active", true)
    .maybeSingle();

  type TodayScheduleRecord = QueryData<typeof query>;

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load today's schedule: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const schedule: TodayScheduleRecord = data;
  const sessions = (schedule.sessions ?? [])
    .map<TodaySessionRow>((session) => ({
      session_id: session.session_id,
      session_type: session.session_type,
      session_name: session.session_name,
      timing: session.timing,
      gym: session.gym,
      description: session.description,
      cardio_distance: session.cardio_distance,
      cardio_target_zone: session.cardio_target_zone,
      display_order: session.display_order,
    }))
    .sort(sortSessions);

  return {
    isRestDay: schedule.is_rest_day,
    sessions: sessions.map<TodaySessionListItem>((session) => ({
      sessionId: session.session_id,
      sessionType: session.session_type,
      sessionName: session.session_name,
      timing: session.timing,
      gym: session.gym,
      displayOrder: session.display_order,
      summary: buildSessionSummary(session),
    })),
  };
}

export default async function TodayPage() {
  const today = new Date();
  const dayOfWeek = getTodayDayOfWeek(today);
  const todaySchedule = await getTodaySessions(dayOfWeek);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <TodayHeader dayOfWeek={dayOfWeek} date={today} />
      {todaySchedule && todaySchedule.sessions.length > 0 ? (
        <TodaySessionList sessions={todaySchedule.sessions} />
      ) : (
        <RestDayEmpty />
      )}
    </div>
  );
}
