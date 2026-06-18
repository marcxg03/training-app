export function blockDetailHref(blockId: string): string {
  return `/library/lifting/blocks/${blockId}`;
}

export function blockEditHref(blockId: string): string {
  return `/library/lifting/blocks/${blockId}/edit`;
}

export function blockCreateHref(): string {
  return "/library/lifting/blocks/new";
}

export function exerciseDetailHref(exerciseId: string): string {
  return `/library/exercises/${exerciseId}`;
}

export function liftingHref(): string {
  return "/library/lifting";
}

export function exercisesHref(): string {
  return "/library/exercises";
}

export function cardioHref(): string {
  return "/library/cardio";
}

export function recoveryHref(): string {
  return "/library/recovery";
}

export function workoutsHref(): string {
  return "/library/workouts";
}

export function workoutDetailHref(workoutDefId: string): string {
  return `/library/workouts/${workoutDefId}`;
}

export function workoutEditHref(workoutDefId: string): string {
  return `/library/workouts/${workoutDefId}/edit`;
}

export function workoutCreateHref(): string {
  return "/library/workouts/new";
}
