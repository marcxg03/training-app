import Link from "next/link";
import { notFound } from "next/navigation";

import type { Enums } from "@/lib/supabase/types";
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

function sortWorkouts(
  left: {
    timing: Enums<"timing_enum">;
    display_order: number;
  },
  right: {
    timing: Enums<"timing_enum">;
    display_order: number;
  },
) {
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

  const { data: workouts, error: workoutsError } = await supabase
    .from("workouts")
    .select("*")
    .eq("schedule_id", schedule.schedule_id);

  if (workoutsError) {
    throw new Error(`Failed to load workouts: ${workoutsError.message}`);
  }

  const sortedWorkouts = [...workouts].sort(sortWorkouts);
  const workoutIds = sortedWorkouts.map((workout) => workout.workout_id);
  const { data: workoutBlocks, error: workoutBlocksError } = workoutIds.length
    ? await supabase
        .from("workout_blocks")
        .select(
          `
            workout_id,
            display_order,
            preset_activity_id,
            preset_activity_type,
            blocks!inner (
              block_id,
              block_name,
              block_type
            )
          `,
        )
        .in("workout_id", workoutIds)
        .order("display_order")
    : { data: [], error: null };

  if (workoutBlocksError) {
    throw new Error(
      `Failed to load workout blocks: ${workoutBlocksError.message}`,
    );
  }

  const liftingBlocks = (workoutBlocks ?? []).flatMap((row) =>
    (Array.isArray(row.blocks) ? row.blocks : [row.blocks]).flatMap((block) =>
      block && block.block_type
        ? [
            {
              workoutId: row.workout_id,
              blockId: block.block_id,
              blockName: block.block_name,
              blockType: block.block_type,
              displayOrder: row.display_order,
            },
          ]
        : [],
    ),
  );
  const blockIds = liftingBlocks.map((block) => block.blockId);
  const { data: liftingItems, error: liftingItemsError } = blockIds.length
    ? await supabase
        .from("block_lifting_items")
        .select(
          `
            block_id,
            display_order,
            exercises!inner (
              exercise_id,
              name,
              notes,
              muscle_groups
            )
          `,
        )
        .in("block_id", blockIds)
        .order("display_order")
    : { data: [], error: null };

  if (liftingItemsError) {
    throw new Error(
      `Failed to load lifting bank items: ${liftingItemsError.message}`,
    );
  }

  const exercisesByBlockId = new Map<
    string,
    SessionDetail["blocks"][number]["exercises"]
  >();

  for (const item of liftingItems ?? []) {
    const list = exercisesByBlockId.get(item.block_id) ?? [];
    const exerciseRows = Array.isArray(item.exercises)
      ? item.exercises
      : [item.exercises];

    for (const exercise of exerciseRows) {
      if (!exercise) {
        continue;
      }

      list.push({
        exerciseId: exercise.exercise_id,
        name: exercise.name,
        notes: exercise.notes,
        muscleGroups: exercise.muscle_groups,
      });
    }

    exercisesByBlockId.set(item.block_id, list);
  }

  const blocksByWorkoutId = new Map<string, SessionDetail["blocks"]>();

  for (const block of liftingBlocks) {
    const list = blocksByWorkoutId.get(block.workoutId) ?? [];

    list.push({
      blockId: block.blockId,
      blockName: block.blockName,
      blockType: block.blockType,
      exercises: exercisesByBlockId.get(block.blockId) ?? [],
    });
    blocksByWorkoutId.set(block.workoutId, list);
  }

  const sessionDetails: SessionDetail[] = sortedWorkouts.map((workout) => ({
    sessionId: workout.workout_id,
    sessionType: workout.workout_type,
    sessionName: workout.workout_name,
    timing: workout.timing,
    gym: workout.gym,
    description: workout.description,
    cardioDistance: workout.cardio_distance,
    cardioTargetZone: workout.cardio_target_zone,
    displayOrder: workout.display_order,
    blocks: blocksByWorkoutId.get(workout.workout_id) ?? [],
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
              : "All workouts are read-only here, including cardio and recovery."}
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
