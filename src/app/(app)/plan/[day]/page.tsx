import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { Enums } from "@/lib/supabase/types";
import { SessionDetailPanel } from "@/components/plan/SessionDetailPanel";
import { getPresetActivityNames } from "@/lib/plan/preset-activities";
import {
  getBankExercisesByBlockId,
  toSessionDetailExercises,
} from "@/lib/blocks/bank";
import { createClient } from "@/lib/supabase/server";

type PlanDayPageProps = {
  params: Promise<{
    day: string;
  }>;
};

type SessionDetail = {
  workoutId: string;
  workoutType: Enums<"session_type_enum">;
  sessionName: string;
  timing: Enums<"timing_enum">;
  gym: string | null;
  description: string | null;
  cardioDistance: string | null;
  cardioTargetZone: Enums<"cardio_target_zone_enum"> | null;
  /** Name of the preset cardio/recovery activity attached to this session. */
  activityName: string | null;
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
  // Cardio/recovery sessions carry their content as a preset activity on the
  // junction row rather than as lifting blocks (which is why the block_type
  // filter above drops them). Resolve those names so the panel can show what
  // the session actually is instead of "No extra details".
  const presetNames = await getPresetActivityNames(workoutBlocks ?? []);
  const activityNameByWorkoutId = new Map<string, string>();

  for (const row of workoutBlocks ?? []) {
    if (!row.preset_activity_id) {
      continue;
    }
    const name = presetNames.get(row.preset_activity_id);
    if (name && !activityNameByWorkoutId.has(row.workout_id)) {
      activityNameByWorkoutId.set(row.workout_id, name);
    }
  }

  const blockIds = liftingBlocks.map((block) => block.blockId);
  // Follows shared banks (migration 024).
  const exercisesByBlockId = await getBankExercisesByBlockId(blockIds);

  const blocksByWorkoutId = new Map<string, SessionDetail["blocks"]>();

  for (const block of liftingBlocks) {
    const list = blocksByWorkoutId.get(block.workoutId) ?? [];

    list.push({
      blockId: block.blockId,
      blockName: block.blockName,
      blockType: block.blockType,
      exercises: toSessionDetailExercises(
        exercisesByBlockId.get(block.blockId) ?? [],
      ),
    });
    blocksByWorkoutId.set(block.workoutId, list);
  }

  const sessionDetails: SessionDetail[] = sortedWorkouts.map((workout) => ({
    workoutId: workout.workout_id,
    workoutType: workout.workout_type,
    sessionName: workout.workout_name,
    timing: workout.timing,
    gym: workout.gym,
    description: workout.description,
    cardioDistance: workout.cardio_distance,
    cardioTargetZone: workout.cardio_target_zone,
    activityName: activityNameByWorkoutId.get(workout.workout_id) ?? null,
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
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/plan"
          aria-label="Back to week"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card-alt text-subtle transition-colors hover:border-accent/40 hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-sm font-semibold text-foreground">
          {dayPlan.dayLabel}
        </h1>
        <Link
          href={`/plan/${day}/edit`}
          className="hidden items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent transition-colors hover:text-accent/80 md:inline-flex"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Link>
      </div>

      {dayPlan.isRestDay && dayPlan.sessions.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border px-[18px] py-5 text-sm text-faint">
          Rest day with optional recovery work.
        </div>
      ) : null}

      <div className="space-y-4">
        {dayPlan.sessions.map((session) => (
          <SessionDetailPanel key={session.workoutId} session={session} />
        ))}
      </div>
    </div>
  );
}
