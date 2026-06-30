"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { drainQueue } from "@/lib/sync/drain";
import {
  isKnownQueueKind,
  type QueueRow,
  type StoredQueueRow,
} from "@/lib/sync/queue";
import { useQueueState } from "@/lib/sync/useQueueState";

type QueuePanelProps = {
  onClose: () => void;
  userId: string;
};

function formatRelativeTime(isoString: string) {
  const diffMs = new Date(isoString).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (Math.abs(diffMinutes) < 1) {
    return "just now";
  }

  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat("en-US", { numeric: "auto" }).format(
      diffMinutes,
      "minute",
    );
  }

  const diffHours = Math.round(diffMinutes / 60);

  return new Intl.RelativeTimeFormat("en-US", { numeric: "auto" }).format(
    diffHours,
    "hour",
  );
}

function describeQueueRow(row: StoredQueueRow) {
  if (!isKnownQueueKind(row.kind)) {
    return "Unknown queued write";
  }

  const knownRow = row as QueueRow;

  switch (knownRow.kind) {
    case "set_log_insert":
      return `Set ${knownRow.payload.set_index} saved`;
    case "workout_completion_start":
      return "Workout started";
    case "workout_completion_block_complete":
      return "Block marked done";
    case "workout_completion_end":
      return knownRow.payload.was_ended_early
        ? "Workout ended early"
        : "Workout completed";
    default:
      return "Queued write";
  }
}

export function QueuePanel({ onClose, userId }: QueuePanelProps) {
  const { drainState, pendingCount, rows } = useQueueState(userId);

  return (
    <div
      className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="eyebrow">Sync Queue</p>
          <p className="text-sm font-medium text-foreground">
            {drainState.inProgress
              ? `Syncing ${pendingCount}...`
              : pendingCount > 0
                ? `${pendingCount} pending`
                : drainState.lastDrainAt
                  ? `All synced - last sync ${formatRelativeTime(drainState.lastDrainAt)}`
                  : "All synced"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          Close
        </button>
      </div>

      {pendingCount > 0 ? (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-border bg-card-alt px-3 py-2"
            >
              <p className="text-sm text-foreground">{describeQueueRow(row)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.attempts > 0
                  ? `Retried ${row.attempts}x`
                  : "Waiting to retry"}
                {row.last_error ? ` - ${row.last_error}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className={cn("mt-4 w-full", drainState.inProgress ? "opacity-60" : "")}
        disabled={drainState.inProgress}
        onClick={() => {
          void drainQueue(userId);
        }}
      >
        {drainState.inProgress ? "Retrying..." : "Retry now"}
      </Button>
    </div>
  );
}
