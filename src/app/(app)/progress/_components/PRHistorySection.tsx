import type { JSX } from "react";

import { PRSpotlightCard } from "@/app/(app)/progress/_components/PRSpotlightCard";
import type { PRSpotlight } from "@/lib/analytics/pr-history";

// The OVERVIEW featured slot: one exercise's PR pair, no controls (T2-E).
// Replaced the deleted E1rmSection (T2-B) — same slot, honest data.
//
// Overview is the glance, so it gets the single most-PR'd lift and nothing to
// operate. The selectable, browse-any-exercise version of this lives in
// PRHistoryBrowser and belongs to the Trends segment. Do not add a control
// here: Marcus's complaint in T2-E was an endless scroll of charts on Trends,
// and the fix was to give ONE surface the browsing job, not both.
//
// `spotlights` stays an array so the caller keeps deciding what is featured
// (today: `spotlights.slice(0, 1)`), and the empty state still has a home when
// nothing has been logged yet.
export function PRHistorySection({
  spotlights,
}: {
  spotlights: PRSpotlight[];
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow mt-2">Strength · PR history</h2>
      {spotlights.length > 0 ? (
        <div className="flex flex-col gap-4">
          {spotlights.map((spotlight) => (
            <PRSpotlightCard
              key={spotlight.exercise_id}
              spotlight={spotlight}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          No PRs logged yet. Hit a heavier set or more reps in your prescribed
          range and they will chart here.
        </div>
      )}
    </section>
  );
}
