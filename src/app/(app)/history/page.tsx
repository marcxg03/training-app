import type { JSX } from "react";

import { HistoryHeaderLink } from "@/app/(app)/history/_components/HistoryHeaderLink";
import { PRTimelineRow } from "@/app/(app)/history/_components/PRTimelineRow";
import { PRTimelineShowAllToggle } from "@/app/(app)/history/_components/PRTimelineShowAllToggle";
import { getPRTimeline } from "@/lib/history/queries";
import type { PRTimelineRow as PRTimelineRowData } from "@/lib/history/projections";

type PRTimelinePageProps = {
  searchParams: Promise<{
    showAll?: string;
  }>;
};

const dateHeadingFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function groupRowsByDay(
  rows: PRTimelineRowData[],
): { key: string; label: string; rows: PRTimelineRowData[] }[] {
  const groups: { key: string; label: string; rows: PRTimelineRowData[] }[] =
    [];
  const indexByKey = new Map<string, number>();

  for (const row of rows) {
    const key = row.achieved_at.slice(0, 10);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        label: dateHeadingFormatter
          .format(new Date(row.achieved_at))
          .toUpperCase(),
        rows: [row],
      });
    } else {
      groups[existingIndex].rows.push(row);
    }
  }

  return groups;
}

export default async function PRTimelinePage({
  searchParams,
}: PRTimelinePageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const showAll = params.showAll === "1";
  const rows = await getPRTimeline({ showAll });
  const groups = groupRowsByDay(rows);
  const emptyCopy = showAll
    ? "No PRs yet."
    : "No PRs in the last 90 days. Tap All time to see your full history, or All workouts to browse past sessions.";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Personal records</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Progress
          </h1>
        </div>
        <HistoryHeaderLink />
      </header>

      <PRTimelineShowAllToggle showAll={showAll} />

      {groups.length > 0 ? (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <h2 className="eyebrow mt-2">{group.label}</h2>
              <ul className="flex flex-col gap-2">
                {group.rows.map((row) => (
                  <PRTimelineRow key={row.pr_id} row={row} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          {emptyCopy}
        </div>
      )}
    </div>
  );
}
