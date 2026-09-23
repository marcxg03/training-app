import type { JSX } from "react";

import { SessionRow } from "@/components/shared/SessionRow";
import { workoutDetailHref } from "@/lib/history/crossLinks";
import type { RecentTimelineItem } from "@/lib/progress/overview";
import type { AllWorkoutsRow, PRTimelineRow } from "@/lib/history/projections";
import { formatWeight } from "@/lib/units";

// Relative "Today" / "Yesterday" / weekday / short-date label, in the app tz.
function relativeLabel(
  iso: string,
  todayKey: string,
  timeZone: string,
): string {
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

  if (dayKey === todayKey) {
    return "Today";
  }

  const dayMs = 86_400_000;
  const diffDays = Math.round(
    (Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${dayKey}T00:00:00Z`)) /
      dayMs,
  );
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(new Date(iso));
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function prValue(row: PRTimelineRow): string {
  return row.is_bodyweight
    ? `BW × ${row.reps}`
    : `${formatWeight(row.weight_kg)} × ${row.reps}`;
}

function prLabel(row: PRTimelineRow): string {
  return row.pr_type === "in_range_rep" ? "rep PR" : "weight PR";
}

function sessionName(row: AllWorkoutsRow): string {
  const idx = row.workout_display_name.lastIndexOf(" · ");
  return idx === -1
    ? row.workout_display_name
    : row.workout_display_name.slice(0, idx);
}

function sessionSubtitle(row: AllWorkoutsRow): string {
  const blocks = `${row.blocks_completed_count} blocks`;
  return row.pr_count > 0 ? `${blocks} · ${row.pr_count} PR` : blocks;
}

export function RecentTimeline({
  items,
  todayKey,
  timeZone,
}: {
  items: RecentTimelineItem[];
  todayKey: string;
  timeZone: string;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow mt-2">Recent</h2>
      {items.length > 0 ? (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((item) =>
            item.kind === "pr" ? (
              <SessionRow
                key={`pr:${item.pr.pr_id}`}
                icon="▲"
                iconVariant="accent"
                title={item.pr.exercise_name}
                subtitle={`${prValue(item.pr)} — ${prLabel(item.pr)}`}
                trailing={
                  <span className="text-[11px] uppercase tracking-wider text-faint">
                    {relativeLabel(item.iso, todayKey, timeZone)}
                  </span>
                }
                href={workoutDetailHref(item.pr.completion_id)}
              />
            ) : (
              <SessionRow
                key={`session:${item.session.completion_id}`}
                icon="✓"
                iconVariant="badge"
                title={sessionName(item.session)}
                subtitle={sessionSubtitle(item.session)}
                trailing={
                  <span className="text-[11px] uppercase tracking-wider text-faint">
                    {relativeLabel(item.iso, todayKey, timeZone)}
                  </span>
                }
                href={workoutDetailHref(item.session.completion_id)}
              />
            ),
          )}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          Log a workout and your recent PRs and sessions will appear here.
        </div>
      )}
    </section>
  );
}
