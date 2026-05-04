import type { JSX } from "react";

import { HistoryHeaderLink } from "@/app/(app)/history/_components/HistoryHeaderLink";
import { PRTimelineRow } from "@/app/(app)/history/_components/PRTimelineRow";
import { PRTimelineShowAllToggle } from "@/app/(app)/history/_components/PRTimelineShowAllToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPRTimeline } from "@/lib/history/queries";

type PRTimelinePageProps = {
  searchParams: Promise<{
    showAll?: string;
  }>;
};

export default async function PRTimelinePage({
  searchParams,
}: PRTimelinePageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const showAll = params.showAll === "1";
  const rows = await getPRTimeline({ showAll });
  const emptyCopy = showAll
    ? "No PRs yet."
    : "No PRs in the last 90 days. Tap Show all to see your full history, or All Workouts to browse past sessions.";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            History
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            PR Timeline
          </h1>
        </div>
        <HistoryHeaderLink />
      </div>

      <Card className="bg-card/80">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl tracking-tight text-foreground">
            Recent PRs
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {showAll ? "Full PR history." : "Last 90 days."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length > 0 ? (
            <ul className="space-y-3">
              {rows.map((row) => (
                <PRTimelineRow key={row.pr_id} row={row} />
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 px-4 py-6 text-sm leading-6 text-muted-foreground">
              {emptyCopy}
            </div>
          )}

          <PRTimelineShowAllToggle showAll={showAll} />
        </CardContent>
      </Card>
    </div>
  );
}
