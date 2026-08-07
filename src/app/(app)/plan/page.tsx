import { Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getHighLevelMuscleGroups } from "@/lib/methodology/muscle-groups";
import type { Enums, Tables } from "@/lib/supabase/types";
import { DayCard, type DayCardSession } from "@/components/plan/DayCard";
import { PlanControls } from "@/app/(app)/plan/_components/PlanControls";
import { getBankExercisesByBlockId } from "@/lib/blocks/bank";
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

function sortWorkouts(left: Tables<"workouts">, right: Tables<"workouts">) {
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

function formatCardioSummary(workout: Tables<"workouts">) {
  const parts = [
    workout.cardio_distance,
    workout.cardio_target_zone?.replace(/_/g, " "),
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return workout.description ?? "Cardio workout.";
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
  const { data: workouts, error: workoutsError } = scheduleIds.length
    ? await supabase.from("workouts").select("*").in("schedule_id", scheduleIds)
    : { data: [], error: null };

  if (workoutsError) {
    throw new Error(`Failed to load workouts: ${workoutsError.message}`);
  }

  const workoutIds = (workouts ?? []).map((workout) => workout.workout_id);
  const { data: workoutBlocks, error: workoutBlocksError } = workoutIds.length
    ? await supabase
        .from("workout_blocks")
        .select("workout_id, block_id")
        .in("workout_id", workoutIds)
    : { data: [], error: null };

  if (workoutBlocksError) {
    throw new Error(
      `Failed to load workout blocks: ${workoutBlocksError.message}`,
    );
  }

  const blockIds = (workoutBlocks ?? []).map((row) => row.block_id);
  // Follows shared banks (migration 024) so the week's muscle-group summary
  // counts what each slot actually prescribes.
  const bankByBlockId = await getBankExercisesByBlockId(blockIds);

  const exercisesById = new Map(
    [...bankByBlockId.values()]
      .flat()
      .map((exercise) => [exercise.exercise_id, exercise] as const),
  );

  const blockIdsByWorkoutId = new Map<string, string[]>();

  for (const row of workoutBlocks ?? []) {
    const list = blockIdsByWorkoutId.get(row.workout_id) ?? [];
    list.push(row.block_id);
    blockIdsByWorkoutId.set(row.workout_id, list);
  }

  const exerciseIdsByBlockId = new Map(
    [...bankByBlockId].map(
      ([blockId, exercises]) =>
        [blockId, exercises.map((exercise) => exercise.exercise_id)] as const,
    ),
  );

  const workoutsByScheduleId = new Map<string, Tables<"workouts">[]>();

  for (const workout of workouts ?? []) {
    const list = workoutsByScheduleId.get(workout.schedule_id) ?? [];
    list.push(workout);
    workoutsByScheduleId.set(workout.schedule_id, list);
  }

  return {
    planId: plan.plan_id,
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

      const sortedWorkouts = [
        ...(workoutsByScheduleId.get(schedule.schedule_id) ?? []),
      ].sort(sortWorkouts);

      const cardSessions = sortedWorkouts.map<DayCardSession>((workout) => {
        if (workout.workout_type !== "lifting") {
          return {
            workoutType: workout.workout_type,
            sessionName: workout.workout_name,
            timing: workout.timing,
            gym: workout.gym,
            summary:
              workout.workout_type === "cardio"
                ? formatCardioSummary(workout)
                : (workout.description ?? "Recovery workout."),
          };
        }

        const workoutBlockIds =
          blockIdsByWorkoutId.get(workout.workout_id) ?? [];
        const focusGroups = new Set<string>();

        for (const blockId of workoutBlockIds) {
          const blockExerciseIds = exerciseIdsByBlockId.get(blockId) ?? [];

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
          workoutType: "lifting",
          sessionName: workout.workout_name,
          timing: workout.timing,
          gym: workout.gym,
          summary: `${workoutBlockIds.length} blocks${
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

async function getPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_plans")
    .select("plan_id, name")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load plans: ${error.message}`);
  }

  return data ?? [];
}

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [plans, weeklyPlan] = await Promise.all([getPlans(), getWeeklyPlan()]);

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Active plan</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-foreground">
            {weeklyPlan?.planName ?? "Plan"}
          </h1>
        </div>
        {weeklyPlan ? (
          <Link
            href="/plan/edit"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-accent transition-colors hover:border-accent/60"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
        ) : null}
      </div>

      <PlanControls
        plans={plans}
        activePlanId={weeklyPlan?.planId ?? null}
        userId={user.id}
      />

      {weeklyPlan ? (
        <div className="space-y-4">
          <p className="eyebrow">This week</p>
          <div className="space-y-[9px]">
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
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {plans.length === 0
            ? "Create your first plan to get started."
            : "Select a plan above to view its week."}
        </div>
      )}
    </div>
  );
}
