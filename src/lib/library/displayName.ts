import type {
  CardioActivity,
  LiftingExerciseInBlock,
} from "@/lib/library/projections";

const cardioFormatLabels: Record<CardioActivity["cardio_format"], string> = {
  speed_run: "Speed Run",
  endurance_run: "Endurance Run",
  basketball: "Basketball",
};

const cardioZoneLabels: Record<CardioActivity["cardio_target_zone"], string> = {
  sprint: "Sprint",
  zone_2: "Zone 2",
  anaerobic: "Anaerobic",
  game_pace: "Game Pace",
};

export function formatExerciseCount(exerciseCount: number) {
  return `${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}`;
}

export function formatCardioFormatLabel(
  format: CardioActivity["cardio_format"],
) {
  return cardioFormatLabels[format];
}

export function formatCardioZoneLabel(
  zone: CardioActivity["cardio_target_zone"],
) {
  return cardioZoneLabels[zone];
}

export function formatCardioSummary(activity: CardioActivity) {
  return [
    activity.cardio_distance,
    formatCardioZoneLabel(activity.cardio_target_zone),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function formatRepRange(exercise: LiftingExerciseInBlock) {
  return `${exercise.prescribed_min}\u2013${exercise.prescribed_max} reps`;
}

export function formatMuscleGroups(muscleGroups: string[]) {
  return muscleGroups
    .map((group) => group.replace(/_/g, " "))
    .map((group) =>
      group.replace(/\b\w/g, (character) => character.toUpperCase()),
    )
    .join(" · ");
}
