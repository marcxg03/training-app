import Link from "next/link";
import { notFound } from "next/navigation";

import type { Enums, Tables } from "@/lib/supabase/types";
import { SessionDetailPanel } from "@/components/plan/SessionDetailPanel";
import { createClient } from "@/lib/supabase/server";

type PlanDayPageProps = {
  params: Promise<{
    day: string;
  }>;
};

type SessionDetail = {
  sessionId: string;
  sessionType: Enums<"session_type_enum">;
  sessionName: string;
  timing: Enums<"timing_enum">;
  gym: string | null;
  description: string | null;
  cardioDistance: string | null;
  cardioTargetZone: Enums<"cardio_target_zone_enum"> | null;
  displayOrder: number;
  blocks: Array<{
    blockId: string;
    blockName: string;
    blockType: Enums<"block_type_enum">;
    displayOrder: number;
    exercises: Array<{
      exerciseId: string;
      name: string;
      notes: string;
      muscleGroups: string[];
    }>;
  }>;
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

const dayOrder: Enums<"day_of_week_enum">[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

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

async function getDayPlan(day: Enums<"day_of_week_enum">) {
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

  const { data: schedule, error: scheduleError } = await supabase
    .from("daily_schedules")
    .select("schedule_id, day_of_week, is_rest_day")
    .eq("plan_id", plan.plan_id)
    .eq("day_of_week", day)
    .maybeSingle();

  if (scheduleError) {
    throw new Error(`Failed to load daily schedule: ${scheduleError.message}`);
  }

  if (!schedule) {
    return null;
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("*")
    .eq("schedule_id", schedule.schedule_id);

  if (sessionsError) {
    throw new Error(`Failed to load sessions: ${sessionsError.message}`);
  }

  const sortedSessions = [...sessions].sort(sortSessions);
  const liftingSessions = sortedSessions.filter(
    (session) => session.session_type === "lifting",
  );
  const liftingSessionIds = liftingSessions.map(
    (session) => session.session_id,
  );

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

  const exercisesById = new Map(
    (exercises ?? []).map((exercise) => [exercise.exercise_id, exercise]),
  );
  const blockExercisesByBlockId = new Map<
    string,
    Tables<"block_exercises">[]
  >();

  for (const row of blockExercises ?? []) {
    const list = blockExercisesByBlockId.get(row.block_id) ?? [];
    list.push(row);
    blockExercisesByBlockId.set(row.block_id, list);
  }

  const blocksBySessionId = new Map<string, SessionDetail["blocks"]>();

  for (const block of blocks ?? []) {
    const linkedExercises = (blockExercisesByBlockId.get(block.block_id) ?? [])
      .map((row) => exercisesById.get(row.exercise_id))
      .filter((exercise): exercise is Tables<"exercises"> => Boolean(exercise))
      .map((exercise) => ({
        exerciseId: exercise.exercise_id,
        name: exercise.name,
        notes: exercise.notes,
        muscleGroups: exercise.muscle_groups,
      }));
    const list = blocksBySessionId.get(block.session_id) ?? [];

    list.push({
      blockId: block.block_id,
      blockName: block.block_name,
      blockType: block.block_type,
      displayOrder: block.display_order,
      exercises: linkedExercises,
    });
    blocksBySessionId.set(block.session_id, list);
  }

  const sessionDetails: SessionDetail[] = sortedSessions.map((session) => ({
    sessionId: session.session_id,
    sessionType: session.session_type,
    sessionName: session.session_name,
    timing: session.timing,
    gym: session.gym,
    description: session.description,
    cardioDistance: session.cardio_distance,
    cardioTargetZone: session.cardio_target_zone,
    displayOrder: session.display_order,
    blocks:
      blocksBySessionId
        .get(session.session_id)
        ?.sort((left, right) => left.displayOrder - right.displayOrder) ?? [],
  }));

  return {
    dayLabel: dayLabels[day],
    isRestDay: schedule.is_rest_day,
    sessions: sessionDetails,
  };
}

export default async function PlanDayPage({ params }: PlanDayPageProps) {
  const { day } = await params;

  if (!dayOrder.includes(day as Enums<"day_of_week_enum">)) {
    notFound();
  }

  const parsedDay = day as Enums<"day_of_week_enum">;
  const dayPlan = await getDayPlan(parsedDay);

  if (!dayPlan) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/plan"
          className="text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          Back to week
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Plan Detail
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {dayPlan.dayLabel}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {dayPlan.isRestDay
              ? "Rest day with optional recovery work."
              : "All sessions are read-only here, including cardio and recovery."}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {dayPlan.sessions.map((session) => (
          <SessionDetailPanel key={session.sessionId} session={session} />
        ))}
      </div>
    </div>
  );
}
