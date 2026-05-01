import { handlers, runPrDetectionForSetLog } from "@/lib/sync/handlers";
import {
  dequeue,
  emitQueueChange,
  isKnownQueueKind,
  loadQueue,
  updateAttempt,
  type QueueRow,
} from "@/lib/sync/queue";

type DrainState = {
  inProgress: boolean;
  lastDrainAt: string | null;
};

type DrainResult =
  | {
      skipped: true;
    }
  | {
      failed: number;
      skipped: false;
      succeeded: number;
    };

const drainState: DrainState = {
  inProgress: false,
  lastDrainAt: null,
};

export function getDrainState() {
  return { ...drainState };
}

export async function drainQueue(userId: string): Promise<DrainResult> {
  if (drainState.inProgress) {
    return { skipped: true };
  }

  drainState.inProgress = true;
  emitQueueChange(userId);

  let failed = 0;
  let succeeded = 0;

  try {
    const rows = loadQueue(userId);

    for (const row of rows) {
      if (!isKnownQueueKind(row.kind)) {
        console.warn("Unknown queue row kind", row.kind);
        failed += 1;
        continue;
      }

      const handler = handlers[row.kind];

      if (!handler) {
        console.warn("Missing queue handler", row.kind);
        failed += 1;
        continue;
      }

      const knownRow = row as QueueRow;

      try {
        const result = await handler(knownRow as never);

        if (result.ok) {
          dequeue(userId, knownRow.id);

          if (knownRow.kind === "set_log_insert") {
            await runPrDetectionForSetLog(knownRow.payload);
          }

          succeeded += 1;
          continue;
        }

        updateAttempt(userId, knownRow.id, result.errorMessage ?? null);

        if (!result.retryable) {
          console.warn(
            "Non-retryable queued write failed",
            knownRow.kind,
            result.errorMessage,
          );
        }

        failed += 1;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unexpected sync failure.";

        updateAttempt(userId, knownRow.id, errorMessage);
        failed += 1;
      }
    }
  } finally {
    drainState.inProgress = false;
    drainState.lastDrainAt = new Date().toISOString();
    emitQueueChange(userId);
  }

  return {
    skipped: false,
    succeeded,
    failed,
  };
}
