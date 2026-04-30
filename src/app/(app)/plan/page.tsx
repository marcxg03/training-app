import { getHighLevelMuscleGroups } from "@/lib/methodology/muscle-groups";
import type { Enums, Tables } from "@/lib/supabase/types";
import { DayCard, type DayCardSession } from "@/components/plan/DayCard";
import { createClient } from "@/lib/supabase/server";

const dayOrder: Enums<"day_of_week_enum">[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

const dayLabels: Record<Enums<"day_of_week_enum">, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const timingOrder: Record<Enums<"timing_enum">, number> = {
  am: 0,
  anytime: 1,
  pm: 2,
};

function sortSessions(left: Tables<"sessions">, right: Tables<"sessions">) {
  const timingDelta = timingOrder[left.timing] - timingOrder[right.timing];

  if (timingDelta !== 0) {
    return timingDelta;
  }

  return left.display_order - right.display_order;
}

function formatMuscleLabel(group: string) {
  return group
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildCardioSummary(session: Tables<"sessions">) {
  const parts = [
    session.cardio_distance,
    session.cardio_target_zone?.replace(/_/g, " "),
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return session.description ?? "Cardio session.";
}

async function getWeeklyPlan() {
  const supabase = await createClient();
  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("plan_id, name")
    .eq("is_active", true)
    .maybeSingle();

  if (planError) {
    throw new Error(`Failed to load active plan: ${planError.message}`);
  }

  if (!plan) {
    return null;
  }

  const { data: schedules, error: schedulesError } = await supabase
    .from("daily_schedules")
    .select("*")
    .eq("plan_id", plan.plan_id);

  if (schedulesError) {
    throw new Error(`Failed to load schedules: ${schedulesError.message}`);
  }

  const scheduleIds = schedules.map((schedule) => schedule.schedule_id);
  const { data: sessions, error: sessionsError } = scheduleIds.length
    ? await supabase.from("sessions").select("*").in("schedule_id", scheduleIds)
    : { data: [], error: null };

  if (sessionsError) {
    throw new Error(`Failed to load sessions: ${sessionsError.message}`);
  }

  const liftingSessionIds = (sessions ?? [])
    .filter((session) => session.session_type === "lifting")
    .map((session) => session.session_id);
  const { data: blocks, error: blocksError } = liftingSessionIds.length
    ? await supabase
        .from("blocks")
        .select("*")
        .in("session_id", liftingSessionIds)
        .order("display_order")
    : { data: [], error: null };

  if (blocksError) {
    throw new Error(`Failed to load blocks: ${blocksError.message}`);
  }

  const blockIds = (blocks ?? []).map((block) => block.block_id);
  const { data: blockExercises, error: blockExercisesError } = blockIds.length
    ? await supabase
        .from("block_exercises")
        .select("*")
        .in("block_id", blockIds)
        .order("display_order")
    : { data: [], error: null };

  if (blockExercisesError) {
    throw new Error(
      `Failed to load block exercise rows: ${blockExercisesError.message}`,
    );
  }

  const exerciseIds = (blockExercises ?? []).map((row) => row.exercise_id);
  const { data: exercises, error: exercisesError } = exerciseIds.length
    ? await supabase
        .from("exercises")
        .select("*")
        .in("exercise_id", exerciseIds)
    : { data: [], error: null };

  if (exercisesError) {
    throw new Error(`Failed to load exercises: ${exercisesError.message}`);
  }

  const blocksBySessionId = new Map<string, Tables<"blocks">[]>();

  for (const block of blocks ?? []) {
    const list = blocksBySessionId.get(block.session_id) ?? [];
    list.push(block);
    blocksBySessionId.set(block.session_id, list);
  }

  const exercisesById = new Map(
    (exercises ?? []).map((exercise) => [exercise.exercise_id, exercise]),
  );
  const exerciseIdsByBlockId = new Map<string, string[]>();

  for (const row of blockExercises ?? []) {
    const list = exerciseIdsByBlockId.get(row.block_id) ?? [];
    list.push(row.exercise_id);
    exerciseIdsByBlockId.set(row.block_id, list);
  }

  const sessionsByScheduleId = new Map<string, Tables<"sessions">[]>();

  for (const session of sessions ?? []) {
    const list = sessionsByScheduleId.get(session.schedule_id) ?? [];
    list.push(session);
    sessionsByScheduleId.set(session.schedule_id, list);
  }

  return {
    planName: plan.name,
    days: dayOrder.map((dayOfWeek) => {
      const schedule = schedules.find(
        (entry) => entry.day_of_week === dayOfWeek,
      );

      if (!schedule) {
        return {
          dayOfWeek,
          dayLabel: dayLabels[dayOfWeek],
          isRestDay: false,
          sessions: [] satisfies DayCardSession[],
        };
      }

      const sortedSessions = [
        ...(sessionsByScheduleId.get(schedule.schedule_id) ?? []),
      ].sort(sortSessions);

      const cardSessions = sortedSessions.map<DayCardSession>((session) => {
        if (session.session_type !== "lifting") {
          return {
            sessionType: session.session_type,
            sessionName: session.session_name,
            timing: session.timing,
            gym: session.gym,
            summary:
              session.session_type === "cardio"
                ? buildCardioSummary(session)
                : (session.description ?? "Recovery session."),
          };
        }

        const sessionBlocks = blocksBySessionId.get(session.session_id) ?? [];
        const focusGroups = new Set<string>();

        for (const block of sessionBlocks) {
          const blockExerciseIds =
            exerciseIdsByBlockId.get(block.block_id) ?? [];

          for (const exerciseId of blockExerciseIds) {
            const exercise = exercisesById.get(exerciseId);

            if (!exercise) {
              continue;
            }

            for (const group of getHighLevelMuscleGroups(
              exercise.muscle_groups,
            )) {
              focusGroups.add(formatMuscleLabel(group));
            }
          }
        }

        return {
          sessionType: "lifting",
          sessionName: session.session_name,
          timing: session.timing,
          gym: session.gym,
          summary: `${sessionBlocks.length} blocks${
            focusGroups.size > 0 ? ` · ${[...focusGroups].join(" / ")}` : ""
          }`,
        };
      });

      return {
        dayOfWeek,
        dayLabel: dayLabels[dayOfWeek],
        isRestDay: schedule.is_rest_day,
        sessions: cardSessions,
      };
    }),
  };
}

export default async function PlanPage() {
  const weeklyPlan = await getWeeklyPlan();

  if (!weeklyPlan) {
    return (
      <div className="mx-auto max-w-3xl rounded-[1.5rem] border border-border bg-card/80 p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Training Plan
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Seed the plan data first to load the weekly schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Plan Tab
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
          {weeklyPlan.planName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Seven day cards, read-only, with every session in week order.
        </p>
      </div>

      <div className="space-y-4">
        {weeklyPlan.days.map((day) => (
          <DayCard
            key={day.dayOfWeek}
            dayOfWeek={day.dayOfWeek}
            dayLabel={day.dayLabel}
            isRestDay={day.isRestDay}
            sessions={day.sessions}
          />
        ))}
      </div>
    </div>
  );
}
