import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";

import { AdherenceBarChart } from "@/components/coach/AdherenceBarChart";
import { CoachPageHeader } from "@/components/coach/CoachPageHeader";
import { StatTile } from "@/components/coach/StatTile";
import { cn } from "@/lib/utils/cn";
import { getClient, getClientProgress } from "@/lib/coach/mock";

type ClientReviewPageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function ClientReviewPage({
  params,
}: ClientReviewPageProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    notFound();
  }

  const progress = getClientProgress(clientId);
  const firstName = client.name.split(" ")[0];
  const peakSessions = Math.max(
    client.sessionsAssigned,
    ...progress.adherenceSeries.map((point) => point.value),
  );

  return (
    <div className="space-y-5">
      <CoachPageHeader
        title={`${firstName} · Progress`}
        backHref={`/coach/clients/${clientId}`}
        backLabel="Back to client"
      />

      <div className="space-y-2.5">
        <p className="eyebrow tracking-[0.16em] text-subtle">
          Adherence · last 8 weeks
        </p>
        <div className="rounded-[14px] border border-border bg-card p-4">
          <AdherenceBarChart
            points={progress.adherenceSeries}
            max={peakSessions}
          />
          <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.06em] text-faint">
            <span>Sessions / wk</span>
            <span
              className={progress.trendingUp ? "text-success" : "text-warning"}
            >
              {progress.trendingUp ? "↑ Trending up" : "↓ Trending down"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2.5">
        <StatTile
          label="Fuel adherence"
          value={`${progress.fuelAdherencePct}%`}
          tone={progress.fuelAdherencePct >= 80 ? "success" : "warning"}
        />
        <StatTile
          label="PRs · 30d"
          value={String(progress.recentPRCount)}
          tone="accent"
        />
      </div>

      <div className="space-y-2.5">
        <p className="eyebrow tracking-[0.16em] text-subtle">Recent PRs</p>
        {progress.recentPRs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
            No PRs in this window
          </div>
        ) : (
          <div className="space-y-1.5">
            {progress.recentPRs.map((pr) => (
              <div
                key={pr.id}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5"
              >
                <Trophy
                  className={cn(
                    "h-4 w-4",
                    pr.tone === "accent" ? "text-accent" : "text-success",
                  )}
                />
                <span className="flex-1 text-[13px] font-semibold text-foreground">
                  {pr.exerciseName}
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                  {pr.result}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
