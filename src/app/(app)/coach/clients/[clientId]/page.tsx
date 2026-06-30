import { notFound } from "next/navigation";
import {
  ClipboardList,
  LineChart,
  Lock,
  MessageSquare,
  UtensilsCrossed,
} from "lucide-react";

import { ClientAvatar } from "@/components/coach/ClientAvatar";
import { CoachActionRow } from "@/components/coach/CoachActionRow";
import { CoachPageHeader } from "@/components/coach/CoachPageHeader";
import { StatTile } from "@/components/coach/StatTile";
import {
  getClient,
  getClientNotes,
  getClientProgress,
  getClientTargets,
} from "@/lib/coach/queries";
import { clientStatusLine } from "@/lib/coach/labels";

type ClientDetailPageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { clientId } = await params;
  const client = await getClient(clientId);

  if (!client) {
    notFound();
  }

  const [progress, targets, notes] = await Promise.all([
    getClientProgress(clientId),
    getClientTargets(clientId),
    getClientNotes(clientId),
  ]);
  const noteCount = notes.length;

  const base = `/coach/clients/${clientId}`;
  const firstName = client.name.split(" ")[0];

  return (
    <div className="space-y-5">
      <CoachPageHeader
        title="Client"
        backHref="/coach"
        backLabel="Back to roster"
      />

      <div className="flex items-center gap-3.5">
        <ClientAvatar initials={client.avatarInitials} size="lg" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {client.name}
          </h2>
          <p className="eyebrow mt-0.5 tracking-[0.08em] text-faint">
            {clientStatusLine(client)}
          </p>
        </div>
      </div>

      <div className="flex gap-2.5">
        <StatTile
          label="Adherence"
          value={`${client.sessionsCompleted}/${client.sessionsAssigned}`}
          tone={client.needsAttention ? "warning" : "success"}
        />
        <StatTile
          label="PRs · 30d"
          value={String(progress.recentPRCount)}
          tone="accent"
        />
        <StatTile
          label="Fuel"
          value={`${progress.fuelAdherencePct}%`}
          tone={progress.fuelAdherencePct >= 80 ? "success" : "warning"}
        />
      </div>

      <div className="space-y-2.5">
        <p className="eyebrow tracking-[0.16em] text-subtle">Coach actions</p>
        <div className="space-y-2">
          <CoachActionRow
            href={`${base}/assign`}
            icon={ClipboardList}
            label="Assign training"
            caption={client.assignedPlanName?.toUpperCase()}
          />
          <CoachActionRow
            href={`${base}/targets`}
            icon={UtensilsCrossed}
            label="Nutrition targets"
            caption={`${targets.calMin.toLocaleString()}–${targets.calMax.toLocaleString()} KCAL`}
          />
          <CoachActionRow
            href={`${base}/review`}
            icon={LineChart}
            label="Review progress"
          />
          <CoachActionRow
            href={`${base}/notes`}
            icon={MessageSquare}
            label="Coach notes"
            badge={noteCount}
          />
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3">
        <Lock className="h-4 w-4 flex-none text-faint" />
        <p className="font-mono text-[10px] leading-snug tracking-[0.04em] text-faint">
          {firstName.toUpperCase()} OWNS THIS DATA · YOU CAN VIEW &amp; ASSIGN,
          NOT EDIT THEIR LOGS
        </p>
      </div>
    </div>
  );
}
