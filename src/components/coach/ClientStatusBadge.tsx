import { Flag, Trophy } from "lucide-react";

import type { CoachClient } from "@/lib/coach/types";

type ClientStatusBadgeProps = {
  client: CoachClient;
};

/** At-a-glance status pill: behind, recent-PR, or pending. Returns null when a
 * client is simply on-track with no headline (matches the design). */
export function ClientStatusBadge({ client }: ClientStatusBadgeProps) {
  if (client.status === "invited") {
    return (
      <span className="rounded-md border border-border px-2 py-1 font-mono text-[8.5px] font-semibold uppercase tracking-[0.06em] text-subtle">
        Pending
      </span>
    );
  }

  if (client.needsAttention) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-1 font-mono text-[8.5px] font-semibold uppercase tracking-[0.06em] text-warning">
        <Flag className="h-3 w-3" />
        Behind
      </span>
    );
  }

  if (client.recentPRCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-1 font-mono text-[8.5px] font-semibold uppercase tracking-[0.06em] text-accent">
        <Trophy className="h-3 w-3" />
        {client.recentPRCount} PR
      </span>
    );
  }

  return null;
}
