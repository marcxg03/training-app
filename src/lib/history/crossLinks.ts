export function exerciseProgressHref(exerciseId: string): string {
  return `/history/exercises/${exerciseId}`;
}

export function workoutDetailHref(completionId: string): string {
  return `/history/workouts/${completionId}`;
}

export function allWorkoutsHref(): string {
  return "/history/workouts";
}
