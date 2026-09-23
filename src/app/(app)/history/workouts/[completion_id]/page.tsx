import type { JSX } from "react";

import { HistoryBackLink } from "@/app/(app)/history/_components/HistoryBackLink";
import { SessionStateBadge } from "@/app/(app)/history/_components/SessionStateBadge";
import { getCompletedSession } from "@/lib/history/queries";
import type {
  CompletedSessionGroup,
  CompletedSessionSet,
} from "@/lib/history/projections";
import { kgToLbs } from "@/lib/units";

type SessionDetailPageProps = {
  params: Promise<{
    completion_id: string;
  }>;
};

const headerDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) {
    return null;
  }

  const totalMinutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const paddedSeconds = String(remainingSeconds).padStart(2, "0");

  return `${totalMinutes}:${paddedSeconds}`;
}

function formatSetValue(set: CompletedSessionSet): string {
  if (set.weight_kg === null) {
    return `BW×${set.reps}`;
  }

  return `${Math.round(kgToLbs(set.weight_kg))}×${set.reps}`;
}

function formatVolume(volumeKg: number): string {
  return `${Math.round(kgToLbs(volumeKg)).toLocaleString("en-US")} lbs`;
}

function SetSequence({ group }: { group: CompletedSessionGroup }): JSX.Element {
  return (
    <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
      {group.sets.map((set, index) => (
        <span key={set.set_log_id}>
          {index > 0 ? <span className="text-faint"> · </span> : null}
          <span>{formatSetValue(set)}</span>
          {set.is_to_failure ? <span className="text-warning"> F</span> : null}
          {set.is_pr ? (
            <span
              className={
                set.pr_type === "in_range_rep" ? "text-success" : "text-accent"
              }
            >
              {" "}
              PR
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex-1 rounded-[var(--radius)] border border-border bg-card p-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

export default async function SessionDetailPage({
  params,
}: SessionDetailPageProps): Promise<JSX.Element> {
  const { completion_id: completionId } = await params;
  const session = await getCompletedSession(completionId);

  if (session === null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <header className="flex items-center gap-3">
          <HistoryBackLink
            href="/progress?view=history"
            label="Back to all workouts"
          />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Session
          </h1>
        </header>
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          We couldn&apos;t find this session.
        </div>
      </div>
    );
  }

  const duration = formatDuration(session.duration_seconds);
  const subline = [
    headerDateFormatter.format(new Date(session.started_at)),
    duration,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header className="flex items-center gap-3">
        <HistoryBackLink
          href="/history/workouts"
          label="Back to all workouts"
        />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            {session.workout_name}
          </h1>
          <p className="font-mono text-[9px] uppercase tabular-nums tracking-[0.12em] text-faint">
            {subline}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <SessionStateBadge state={session.state} />
        {session.pr_count > 0 ? (
          <span className="inline-flex items-center rounded-md bg-accent/15 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-accent">
            {session.pr_count} PR
          </span>
        ) : null}
        <span className="inline-flex items-center rounded-md border border-border px-2 py-1 font-mono text-[9px] font-semibold uppercase tabular-nums tracking-[0.1em] text-subtle">
          {session.blocks_completed_count}/{session.blocks_total_count} blocks
        </span>
      </div>

      <div className="flex gap-2.5">
        <StatTile
          label="Volume"
          value={formatVolume(session.total_volume_kg)}
        />
        <StatTile label="Sets" value={String(session.set_count)} />
        <StatTile label="PRs" value={String(session.pr_count)} />
      </div>

      {session.groups.length > 0 ? (
        <section className="flex flex-col gap-3">
          {session.groups.map((group, index) => (
            <div key={`${group.block_id}:${group.exercise_id}`}>
              <h2 className="eyebrow">
                Block {index + 1} · {group.block_name} · {group.exercise_name}
              </h2>
              <div className="mt-2 rounded-[var(--radius)] border border-border bg-card px-3.5 py-3">
                <SetSequence group={group} />
              </div>
            </div>
          ))}
        </section>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          No sets were logged in this session.
        </div>
      )}
    </div>
  );
}
