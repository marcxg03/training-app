import type { JSX } from "react";

import { AllWorkoutsRow } from "@/app/(app)/history/_components/AllWorkoutsRow";
import { HistoryBackLink } from "@/app/(app)/history/_components/HistoryBackLink";
import { getAllWorkouts } from "@/lib/history/queries";

export default async function AllWorkoutsPage(): Promise<JSX.Element> {
  const rows = await getAllWorkouts();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header className="flex items-center gap-3">
        <HistoryBackLink href="/history" label="Back to PR timeline" />
        <div>
          <p className="eyebrow">History</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            All workouts
          </h1>
        </div>
      </header>

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <AllWorkoutsRow key={row.completion_id} row={row} />
          ))}
        </ul>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          No completed sessions yet.
        </div>
      )}
    </div>
  );
}
