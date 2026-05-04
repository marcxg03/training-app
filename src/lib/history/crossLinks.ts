export function exerciseProgressHref(exerciseId: string): string {
  return `/history/exercises/${exerciseId}`;
}

export function sessionDetailHref(completionId: string): string {
  return `/history/sessions/${completionId}`;
}

export function allSessionsHref(): string {
  return "/history/sessions";
}
