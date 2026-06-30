import type { Enums } from "@/lib/supabase/types";
import { TodayHeader } from "@/components/today/TodayHeader";
import { TodayWeekStrip } from "@/components/today/TodayWeekStrip";
import { TodayFuelCard } from "@/components/today/TodayFuelCard";
import {
  TodaySessionList,
  type TodaySessionListItem,
} from "@/components/today/TodaySessionList";
import { RestDayEmpty } from "@/components/today/RestDayEmpty";
import {
  dayOfWeekLabel,
  getTodayDayOfWeek,
  parseDayOfWeek,
} from "@/lib/methodology/today";
import {
  getMealsForDate,
  getNutritionTargets,
  getTodayDateString,
} from "@/lib/nutrition/queries";
import { buildMacroBars, sumMealTotals } from "@/lib/nutrition/summary";
import { createClient } from "@/lib/supabase/server";

const timingOrder: Record<Enums<"timing_enum">, number> = {
  am: 0,
  anytime: 1,
  pm: 2,
};

type TodayWorkoutRow = {
  workout_id: string;
  workout_type: Enums<"session_type_enum">;
  workout_name: string;
  timing: Enums<"timing_enum">;
  gym: string | null;
  description: string | null;
  cardio_distance: string | null;
  cardio_target_zone: Enums<"cardio_target_zone_enum"> | null;
  display_order: number;
};

type WorkoutPresetRow = {
  workout_id: string;
  preset_activity_id: string | null;
  preset_activity_type: "cardio" | "recovery" | null;
};

function formatCardioZone(zone: Enums<"cardio_target_zone_enum"> | null) {
  if (!zone) {
    return null;
  }

  return zone
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function sortWorkouts(left: TodayWorkoutRow, right: TodayWorkoutRow) {
  const timingDelta = timingOrder[left.timing] - timingOrder[right.timing];

  if (timingDelta !== 0) {
    return timingDelta;
  }

  return left.display_order - right.display_order;
}

function buildWorkoutSummary(
  workout: TodayWorkoutRow,
  presetLabel: string | null,
) {
  if (workout.workout_type === "cardio") {
    const parts = [
      presetLabel,
      workout.cardio_distance,
      formatCardioZone(workout.cardio_target_zone),
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" · ");
    }

    return workout.description ?? "Cardio workout.";
  }

  if (workout.workout_type === "recovery") {
    return presetLabel ?? workout.description ?? "Recovery workout.";
  }

  return (
    workout.description ??
    "Open workout detail to view blocks and exercise bank."
  );
}

async function getPresetActivityNames(presets: WorkoutPresetRow[]) {
  const supabase = await createClient();
  const cardioIds = presets
    .filter(
      (
        preset,
      ): preset is WorkoutPresetRow & {
        preset_activity_id: string;
        preset_activity_type: "cardio";
      } =>
        preset.preset_activity_id !== null &&
        preset.preset_activity_type === "cardio",
    )
    .map((preset) => preset.preset_activity_id);
  const recoveryIds = presets
    .filter(
      (
        preset,
      ): preset is WorkoutPresetRow & {
        preset_activity_id: string;
        preset_activity_type: "recovery";
      } =>
        preset.preset_activity_id !== null &&
        preset.preset_activity_type === "recovery",
    )
    .map((preset) => preset.preset_activity_id);

  const [
    { data: cardioActivities, error: cardioError },
    { data: recoveryActivities, error: recoveryError },
  ] = await Promise.all([
    cardioIds.length
      ? supabase
          .from("cardio_activities")
          .select("activity_id, name")
          .in("activity_id", cardioIds)
      : Promise.resolve({ data: [], error: null }),
    recoveryIds.length
      ? supabase
          .from("recovery_activities")
          .select("activity_id, name")
          .in("activity_id", recoveryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (cardioError) {
    throw new Error(
      `Failed to load cardio presets for today: ${cardioError.message}`,
    );
  }

  if (recoveryError) {
    throw new Error(
      `Failed to load recovery presets for today: ${recoveryError.message}`,
    );
  }

  return new Map(
    [...cardioActivities, ...recoveryActivities].map((activity) => [
      activity.activity_id,
      activity.name,
    ]),
  );
}

async function getTodaySessions(dayOfWeek: Enums<"day_of_week_enum">) {
  const supabase = await createClient();
  const { data: schedule, error: scheduleError } = await supabase
    .from("daily_schedules")
    .select("schedule_id, is_rest_day, training_plans!inner(is_active)")
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

  const { data: workouts, error: workoutsError } = await supabase
    .from("workouts")
    .select(
      "workout_id, workout_type, workout_name, timing, gym, description, cardio_distance, cardio_target_zone, display_order",
    )
    .eq("schedule_id", schedule.schedule_id);

  if (workoutsError) {
    throw new Error(
      `Failed to load today's workouts: ${workoutsError.message}`,
    );
  }

  const sortedWorkouts = [...workouts].sort(sortWorkouts);
  const workoutIds = sortedWorkouts.map((workout) => workout.workout_id);
  const { data: presets, error: presetsError } = workoutIds.length
    ? await supabase
        .from("workout_blocks")
        .select("workout_id, preset_activity_id, preset_activity_type")
        .in("workout_id", workoutIds)
        .not("preset_activity_id", "is", null)
    : { data: [], error: null };

  if (presetsError) {
    throw new Error(
      `Failed to load workout presets for today: ${presetsError.message}`,
    );
  }

  const presetNames = await getPresetActivityNames(presets ?? []);
  const presetByWorkoutId = new Map(
    (presets ?? []).map((preset) => [
      preset.workout_id,
      preset.preset_activity_id
        ? (presetNames.get(preset.preset_activity_id) ?? null)
        : null,
    ]),
  );

  return {
    isRestDay: schedule.is_rest_day,
    sessions: sortedWorkouts.map<TodaySessionListItem>((workout) => ({
      workoutId: workout.workout_id,
      workoutType: workout.workout_type,
      workoutName: workout.workout_name,
      timing: workout.timing,
      gym: workout.gym,
      displayOrder: workout.display_order,
      summary: buildWorkoutSummary(
        workout,
        presetByWorkoutId.get(workout.workout_id) ?? null,
      ),
    })),
  };
}

type TodayPageProps = {
  searchParams: Promise<{ day?: string }>;
};

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const today = new Date();
  const actualDay = getTodayDayOfWeek(today);
  const { day: dayParam } = await searchParams;
  const selectedDay = parseDayOfWeek(dayParam) ?? actualDay;
  const isToday = selectedDay === actualDay;

  // Nutrition tracking is anchored to the real calendar date, so only fetch and
  // show fuel on today's view; other days are a read-only plan preview.
  const [selectedSchedule, targets, meals] = await Promise.all([
    getTodaySessions(selectedDay),
    isToday ? getNutritionTargets() : Promise.resolve(null),
    isToday ? getMealsForDate(getTodayDateString()) : Promise.resolve([]),
  ]);

  const hasSessions = Boolean(
    selectedSchedule && selectedSchedule.sessions.length > 0,
  );
  const fuelBars = isToday
    ? buildMacroBars(targets, sumMealTotals(meals))
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <TodayHeader dayOfWeek={selectedDay} date={today} isToday={isToday} />
      <TodayWeekStrip selectedDay={selectedDay} actualDay={actualDay} />
      {hasSessions && selectedSchedule ? (
        <TodaySessionList
          sessions={selectedSchedule.sessions}
          day={selectedDay}
          readOnly={!isToday}
          heading={
            isToday
              ? "Today's sessions"
              : `${dayOfWeekLabel(selectedDay)} sessions`
          }
        />
      ) : (
        <RestDayEmpty />
      )}
      {fuelBars ? <TodayFuelCard bars={fuelBars} /> : null}
    </div>
  );
}
