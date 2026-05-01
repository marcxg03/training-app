"use client";

import { useState } from "react";

import { QueuePanel } from "@/components/log/QueuePanel";
import { useQueueState } from "@/lib/sync/useQueueState";

type QueueIndicatorProps = {
  userId: string;
};

export function QueueIndicator({ userId }: QueueIndicatorProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { drainState, pendingCount } = useQueueState(userId);

  const dotClassName = drainState.inProgress
    ? "bg-[#9b7fd4] animate-queue-pulse"
    : pendingCount > 0
      ? "bg-amber-500"
      : "bg-zinc-500";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={
          drainState.inProgress
            ? "Sync queue is draining"
            : pendingCount > 0
              ? `${pendingCount} queued writes pending`
              : "All queued writes synced"
        }
        onClick={() => setIsPanelOpen((current) => !current)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/80 transition hover:border-accent/50 hover:bg-background"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dotClassName}`} />
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

      <style jsx>{`
        @keyframes queue-pulse {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }

        .animate-queue-pulse {
          animation: queue-pulse 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
