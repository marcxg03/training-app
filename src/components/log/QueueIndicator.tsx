"use client";

import { useState } from "react";
import { Check, RefreshCw } from "lucide-react";

import { QueuePanel } from "@/components/log/QueuePanel";
import { cn } from "@/lib/utils/cn";
import { useQueueState } from "@/lib/sync/useQueueState";

type QueueIndicatorProps = {
  userId: string;
};

export function QueueIndicator({ userId }: QueueIndicatorProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { drainState, pendingCount } = useQueueState(userId);

  const isSyncing = drainState.inProgress;
  const isPending = !isSyncing && pendingCount > 0;
  const isSynced = !isSyncing && pendingCount === 0;

  const label = isSyncing
    ? "Syncing"
    : isPending
      ? `${pendingCount} pending`
      : "Synced";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={
          isSyncing
            ? "Sync queue is draining"
            : isPending
              ? `${pendingCount} queued writes pending`
              : "All queued writes synced"
        }
        onClick={() => setIsPanelOpen((current) => !current)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition",
          isSynced
            ? "border-success/40 text-success"
            : "border-warning/40 text-warning",
        )}
      >
        {isSynced ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <RefreshCw
            className={cn("h-3.5 w-3.5", isSyncing ? "animate-synpulse" : "")}
          />
        )}
        <span>{label}</span>
      </button>

      {isPanelOpen ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsPanelOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2">
            <QueuePanel userId={userId} onClose={() => setIsPanelOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  );
}
