"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { PRSpotlightCard } from "@/app/(app)/progress/_components/PRSpotlightCard";
import type { PRSpotlight } from "@/lib/analytics/pr-history";

/**
 * Progress → Trends · PR history, ONE exercise at a time (T2-E).
 *
 * Marcus, after using the app: *"maybe we can do a selector to select which
 * exercise to surface and only surface one — so you can select which exercise
 * and see trends."* Trends used to render the top four exercises as four cards
 * of two charts each: eight canvases, an endless scroll, and nothing scannable.
 * Now the segment shows one exercise's pair and a control to change which.
 *
 * SERVER-FIRST, like every other Progress segment. The page (a server
 * component) builds EVERY selectable exercise's chart model with
 * `buildPRSpotlights` and hands them all down as props; this component only
 * decides which one is on screen. Switching exercises re-renders, it never
 * refetches — there is no loading state because there is nothing to load.
 *
 * WHY A NATIVE `<select>` AND NOT THE SHARED SegmentedControl. The segmented
 * control is a row of equal-width pills; it is right for three fixed segments
 * (Overview / Trends / History) and wrong the moment the option list is data
 * — a dozen exercise names would either overflow 390px or compress to
 * unreadable slivers. A native select costs one tap, opens the OS's own
 * full-height picker (which is the best one-handed list a phone has), cannot
 * overflow its box at any width, and is keyboard- and screen-reader-correct
 * for free. Styled to the tokens, matching the timezone select in Settings.
 *
 * WHY EXACTLY ONE CARD IS MOUNTED. The sibling ProgressSegments keeps all three
 * segments in the DOM and toggles a `flex`/`hidden` CLASS (never the `hidden`
 * ATTRIBUTE, which `.flex` overrides — that bug shipped once). Here there is
 * nothing to preserve across a switch: the card is pure props, so rendering
 * only the selected one is both lighter and immune to that whole class of bug.
 * A hidden chart cannot be mistaken for a visible one if it was never rendered.
 */
export function PRHistoryBrowser({
  spotlights,
}: {
  spotlights: PRSpotlight[];
}) {
  // Defaults to spotlights[0] — buildPRSpotlights ranks by PR count, so the
  // segment opens on his most-active lift without him choosing anything.
  const [selectedId, setSelectedId] = useState<string>(
    spotlights[0]?.exercise_id ?? "",
  );

  // Never trust the state to still name a row: props can change under it (a new
  // PR reorders the ranking on the next server render).
  const selected =
    spotlights.find((spotlight) => spotlight.exercise_id === selectedId) ??
    spotlights[0] ??
    null;

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow mt-2">Strength · PR history</h2>

      {selected === null ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-6 text-sm leading-6 text-muted-foreground">
          No PRs logged yet. Hit a heavier set or more reps in your prescribed
          range and they will chart here.
        </div>
      ) : (
        <>
          <p className="text-sm leading-6 text-muted-foreground">
            Weight and rep PRs for one exercise at a time — each on its own
            chart. Pick a lift, or tap its charts to open its full history and
            recent sets.
          </p>

          <div className="relative">
            <label htmlFor="pr-history-exercise" className="sr-only">
              Exercise to chart
            </label>
            <select
              id="pr-history-exercise"
              value={selected.exercise_id}
              onChange={(event) => setSelectedId(event.target.value)}
              aria-label="Exercise to chart"
              className="h-11 w-full appearance-none truncate rounded-xl border border-border bg-input pl-3.5 pr-10 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {spotlights.map((spotlight) => (
                <option
                  key={spotlight.exercise_id}
                  value={spotlight.exercise_id}
                >
                  {spotlight.exercise_name} — {spotlight.pr_count} PR
                  {spotlight.pr_count === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            />
          </div>

          <PRSpotlightCard
            // Keyed by exercise so a switch remounts the charts rather than
            // morphing one exercise's line into another's.
            key={selected.exercise_id}
            spotlight={selected}
          />
        </>
      )}
    </section>
  );
}
