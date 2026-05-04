const currentYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const priorYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatSessionDisplayName(
  sessionName: string,
  startedAt: Date | string,
): string {
  const date = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const formatter =
    date.getFullYear() === new Date().getFullYear()
      ? currentYearFormatter
      : priorYearFormatter;

  return `${sessionName} · ${formatter.format(date)}`;
}
