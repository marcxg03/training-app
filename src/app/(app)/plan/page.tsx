import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getHighLevelMuscleGroups } from "@/lib/methodology/muscle-groups";
import type { Enums, Tables } from "@/lib/supabase/types";
import type { DayCardSession } from "@/components/plan/DayCard";
import { PlanSelector } from "@/app/(app)/plan/_components/PlanSelector";
import { PLAN_DOT_COLOR, dayDotKind } from "@/lib/plan/plan-dots";
import { getBankExercisesByBlockId } from "@/lib/blocks/bank";
import { getAppDayOfWeek } from "@/lib/time/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";

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

const shortDayLabels: Record<Enums<"day_of_week_enum">, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
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

/** Collapse a day's sessions into a single row view-model (name + sub-line). */
function buildDayRow(day: { isRestDay: boolean; sessions: DayCardSession[] }): {
  name: string;
  sub: string;
} {
  if (day.sessions.length === 0) {
    return {
      name: day.isRestDay ? "Rest day" : "Open day",
      sub: day.isRestDay ? "Complete rest" : "Nothing scheduled",
    };
  }

  // The headline session mirrors Today's focal card: the lift, else the first.
  const focalIndex = day.sessions.findIndex(
    (session) => session.workoutType === "lifting",
  );
  const focal = focalIndex >= 0 ? day.sessions[focalIndex] : day.sessions[0];
  const others = day.sessions.filter((session) => session !== focal);
  const sub =
    others.length > 0
      ? others.map((session) => session.sessionName).join(" · ")
      : focal.summary;

  return { name: focal.sessionName, sub };
}

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [plans, weeklyPlan, actualDay] = await Promise.all([
    getPlans(),
    getWeeklyPlan(),
    getAppDayOfWeek(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
          Active plan
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">
          {weeklyPlan?.planName ?? "Plan"}
        </h1>
      </div>

      {/* selector — switch/load the active plan (viewer action; no authoring) */}
      <PlanSelector
        plans={plans}
        activePlanId={weeklyPlan?.planId ?? null}
        userId={user.id}
      />

      {/* the week */}
      {weeklyPlan ? (
        <div className="flex flex-col gap-2">
          {weeklyPlan.days.map((day) => {
            const isToday = day.dayOfWeek === actualDay;
            const kind = dayDotKind({
              isRestDay: day.isRestDay,
              sessionTypes: day.sessions.map((session) => session.workoutType),
            });
            const { name, sub } = buildDayRow(day);
            // A day is openable only if it has a schedule row: getDayPlan
            // returns null (→ 404) for a scheduleless day. A rest day always
            // has a schedule, and any day with sessions has one; the residual
            // "Open day / Nothing scheduled" row (no rest flag, no sessions) is
            // the scheduleless case, so it is shown but not navigable.
            const openable = day.isRestDay || day.sessions.length > 0;

            const rowClassName = cn(
              "flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5",
              openable && "transition-colors hover:border-accent/60",
              isToday ? "border-accent" : "border-border",
            );

            const rowContent = (
              <>
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    PLAN_DOT_COLOR[kind],
                  )}
                  aria-hidden="true"
                />
                <div className="flex w-10 shrink-0 flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                    {shortDayLabels[day.dayOfWeek]}
                  </span>
                  <span className="sr-only">{day.dayLabel}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {name}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {sub}
                  </span>
                </div>
                {isToday ? (
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                    Today
                  </span>
                ) : null}
                {openable ? (
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-faint"
                    aria-hidden="true"
                  />
                ) : null}
              </>
            );

            return openable ? (
              <Link
                key={day.dayOfWeek}
                href={`/plan/${day.dayOfWeek}`}
                className={rowClassName}
              >
                {rowContent}
              </Link>
            ) : (
              <div key={day.dayOfWeek} className={rowClassName}>
                {rowContent}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {plans.length === 0
            ? "No plan yet. Build your first plan on the desktop app."
            : "Load a plan above to view its week."}
        </div>
      )}

      {/* boundary note: switch/load here, build on desktop (D18) */}
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-[11px] text-muted-foreground">
        <span className="text-faint" aria-hidden="true">
          ✎
        </span>
        Switch or load any plan here. Building &amp; editing lives on the
        desktop app.
      </div>
    </div>
  );
}
