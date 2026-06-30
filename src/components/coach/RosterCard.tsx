import Link from "next/link";
import { Hourglass } from "lucide-react";

import { AdherenceBar } from "@/components/coach/AdherenceBar";
import { ClientAvatar } from "@/components/coach/ClientAvatar";
import { ClientStatusBadge } from "@/components/coach/ClientStatusBadge";
import { cn } from "@/lib/utils/cn";
import type { CoachClient } from "@/lib/coach/types";

type RosterCardProps = {
  client: CoachClient;
};

/** A single client row on the roster. Invited clients render a non-clickable
 * pending tile; active clients link into their workspace. */
export function RosterCard({ client }: RosterCardProps) {
  const lastActiveLabel = client.lastActiveLabel;

  if (client.status === "invited") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background p-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-card-alt text-faint">
            <Hourglass className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-subtle">
              {client.name}
            </p>
            <p className="eyebrow mt-0.5 tracking-[0.08em] text-faint">
              {lastActiveLabel}
            </p>
          </div>
          <ClientStatusBadge client={client} />
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/coach/clients/${client.id}`}
      className={cn(
        "block rounded-xl border bg-card p-3.5 transition-colors hover:border-accent/60",
        client.needsAttention ? "border-warning/35" : "border-border",
      )}
    >
      <div className="flex items-center gap-3">
        <ClientAvatar initials={client.avatarInitials} />
        <div className="flex-1">
          <p className="text-[15px] font-semibold text-foreground">
            {client.name}
          </p>
          <p
            className={cn(
              "eyebrow mt-0.5 tracking-[0.08em]",
              client.needsAttention ? "text-warning" : "text-faint",
            )}
          >
            Last active {lastActiveLabel}
          </p>
        </div>
        <ClientStatusBadge client={client} />
      </div>
      <div className="mt-3">
        <AdherenceBar
          pct={client.adherencePct}
          label={`${client.sessionsCompleted}/${client.sessionsAssigned} wk`}
          behind={client.needsAttention}
        />
      </div>
    </Link>
  );
}
