import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import type { Enums } from "@/lib/supabase/types";
import { SessionDetailPanel } from "@/components/plan/SessionDetailPanel";
import { StartWorkoutButton } from "@/components/today/StartWorkoutButton";
import {
  getTodayDayOfWeek,
  parseDayOfWeek,
} from "@/lib/methodology/today";
import { createClient } from "@/lib/supabase/server";

type TodayWorkoutDetailPageProps = {
  params: Promise<{
    workout_id: string;
  }>;
  searchParams: Promise<{ day?: string }>;
};

type WorkoutDetail = {
  workoutId: string;
  workoutType: Enums<"session_type_enum">;
  sessionName: string;
  timing: Enums<"timing_enum">;
  gym: string | null;
  description: string | null;
  cardioDistance: string | null;
  cardioTargetZone: Enums<"cardio_target_zone_enum"> | null;
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

async function getTodayWorkoutDetail(
  workoutId: string,
  dayOfWeek: Enums<"day_of_week_enum">,
) {
  const supabase = await createClient();
  const { data: schedule, error: scheduleError } = await supabase
    .from("daily_schedules")
    .select("schedule_id, training_plans!inner(is_active)")
    .eq("day_of_week", dayOfWeek)
    .eq("training_plans.is_active", true)
    .maybeSingle();

  if (scheduleError) {
    throw new Error(
      `Failed to load today's schedule: ${scheduleError.message}`,
    );
  }

  if (!schedule) {
    return null;
  }

  const { data: workout, error: workoutError } = await supabase
    .from("workouts")
    .select(
      "workout_id, workout_type, workout_name, timing, gym, description, cardio_distance, cardio_target_zone",
    )
    .eq("schedule_id", schedule.schedule_id)
    .eq("workout_id", workoutId)
    .maybeSingle();

  if (workoutError) {
    throw new Error(`Failed to load today's workout: ${workoutError.message}`);
  }

  if (!workout) {
    return null;
  }

  const { data: workoutBlocks, error: workoutBlocksError } = await supabase
    .from("workout_blocks")
    .select(
      `
        display_order,
        blocks!inner (
          block_id,
          block_name,
          block_type
        )
      `,
    )
    .eq("workout_id", workoutId)
    .order("display_order");

  if (workoutBlocksError) {
    throw new Error(
      `Failed to load workout blocks: ${workoutBlocksError.message}`,
    );
  }

  const liftingBlocks = workoutBlocks
    .flatMap((row) =>
      (Array.isArray(row.blocks) ? row.blocks : [row.blocks]).flatMap(
        (block) =>
          block && block.block_type
            ? [
                {
                  blockId: block.block_id,
                  blockName: block.block_name,
                  blockType: block.block_type,
                  displayOrder: row.display_order,
                },
              ]
            : [],
      ),
    )
    .sort((left, right) => left.displayOrder - right.displayOrder);
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
    WorkoutDetail["blocks"][number]["exercises"]
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

  return {
    workoutId: workout.workout_id,
    workoutType: workout.workout_type,
    sessionName: workout.workout_name,
    timing: workout.timing,
    gym: workout.gym,
    description: workout.description,
    cardioDistance: workout.cardio_distance,
    cardioTargetZone: workout.cardio_target_zone,
    blocks: liftingBlocks.map((block) => ({
      blockId: block.blockId,
      blockName: block.blockName,
      blockType: block.blockType,
      exercises: exercisesByBlockId.get(block.blockId) ?? [],
    })),
  };
}

export default async function TodayWorkoutDetailPage({
  params,
  searchParams,
}: TodayWorkoutDetailPageProps) {
  const { workout_id: workoutId } = await params;
  const { day: dayParam } = await searchParams;
  const actualDay = getTodayDayOfWeek();
  const selectedDay = parseDayOfWeek(dayParam) ?? actualDay;
  const isToday = selectedDay === actualDay;
  const workout = await getTodayWorkoutDetail(workoutId, selectedDay);

  if (!workout) {
    redirect(isToday ? "/today" : `/today?day=${selectedDay}`);
  }

  const backHref = isToday ? "/today" : `/today?day=${selectedDay}`;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          aria-label="Back to today"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card-alt text-subtle transition-colors hover:border-accent/50 hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="truncate text-sm font-semibold text-foreground">
          {workout.sessionName}
        </span>
        <span className="h-9 w-9" aria-hidden="true" />
      </div>
      <SessionDetailPanel session={workout} />
      {workout.workoutType === "lifting" && isToday ? (
        <StartWorkoutButton workoutId={workout.workoutId} />
      ) : null}
    </div>
  );
}
