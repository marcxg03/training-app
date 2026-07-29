# Build Plan — Trends & Analytics (graphs)

**Date:** 2026-07-28 · **Branch:** redesign/instrument · **Mode:** brownfield

## Spec (agreed with Marcus)

Add a dedicated **/trends** analytics page (new 6th bottom-nav tab) with four graph
trackers, all rendered with the existing hand-rolled SVG chart approach (no chart
library):

1. **e1RM strength progression** — per-exercise estimated 1RM (Epley:
   `weight_kg * (1 + reps/30)`), best-of-day, displayed lbs. Upgrades the
   existing per-exercise history chart and shows top exercises on /trends.
2. **Weekly volume by muscle group** — sets/week and tonnage (Σ weight×reps)
   from `set_logs` × `exercises.muscle_groups`, last 8 weeks.
3. **Nutrition 30-day trend** — daily calories + protein as min–max bands from
   `meal_entries` vs the `nutrition_targets` zone.
4. **Bodyweight trend** — NEW `bodyweight_logs` table (migration 021, per-user
   RLS matching migration 010 pattern), one-tap quick-log on /trends (input lbs,
   stored kg), trend line; keeps `profiles.bodyweight_kg` in sync as "current".

**Non-goals:** no chart library; no changes to logging flows (set logger,
LogMealSheet); no PR-detection changes; no consistency heatmap / cardio load
(deferred to FUTURE_WORK).

**Conventions honored:** RSC pages → `src/lib/<domain>/queries.ts` (reads) +
`mutations.ts` (server actions) + pure `projections.ts`; kg stored / lbs
displayed via `src/lib/units`; shadcn New York + semantic tokens; mobile-first;
zod + react-hook-form; per-user RLS.

**Definition of done (whole build):** /trends loads with all four sections
populated from real logged data; bodyweight quick-log persists and re-renders;
exercise history page shows e1RM; `pnpm typecheck` + `pnpm lint` green;
UI verified via Playwright screenshots (mobile 390px + desktop) on all touched
pages; migration file ready + apply instructions flagged (NOT auto-applied).

**Top risks:** timezone/day-bucketing consistency with existing `en-CA` date
convention; muscle-group double-counting (an exercise with 2 groups counts its
sets toward both — acceptable, standard practice, but must be deliberate);
sparse-data rendering (weeks with no data must not interpolate misleadingly).

## Slices

### Slice 0 — Scaffold
- `/trends` route (RSC page shell with four empty section cards), 6th nav tab
  (TrendingUp icon, label "Trends"), `src/lib/analytics/` skeleton
  (queries/projections), chart-component variants file stub.
- **Done:** page renders behind auth with placeholder sections; nav highlights.
- **Verify:** typecheck/lint; Playwright screenshot mobile+desktop.

### Slice 1 — e1RM progression
- `epleyE1rm()` in analytics projections; best-e1RM-per-day series per exercise;
  history exercise page chart switches to e1RM (label "lbs e1rm"); /trends shows
  e1RM sparklines for top 4 exercises by recent volume.
- **Done:** chart values match hand-computed Epley on sample data.
- **Verify:** tsx script asserting projection outputs on fixture data; Playwright.

### Slice 2 — Weekly volume by muscle group
- Weekly bucketing (ISO weeks, last 8), sets/week + tonnage per muscle group;
  grouped bar chart variant of the SVG component; muscle-group selector or
  stacked list of small multiples (decide in-slice, mobile-first).
- **Done:** totals match a SQL cross-check on real data.
- **Verify:** tsx fixture test + SQL spot-check + Playwright.

### Slice 3 — Nutrition 30-day trend
- `getMealsForDateRange()` query; daily min–max band series for calories +
  protein; band-chart SVG variant; target zone drawn as reference band.
- **Done:** today's chart endpoint value equals the Fuel page's today totals.
- **Verify:** tsx fixture test (range summing incl. legacy single-value rows) +
  Playwright.

### Slice 4 — Bodyweight trend
- Migration `021_bodyweight_logs.sql` (+RLS); quick-log server action (upsert
  per date, also updates `profiles.bodyweight_kg`); one-tap log UI on /trends;
  trend line chart. Migration applied via `supabase db push` or dashboard SQL —
  **flag to Marcus, do not auto-apply**.
- **Done:** log → persists → chart updates → profile current value syncs.
- **Verify:** local flow driven end-to-end with Playwright after migration
  applied; typecheck/lint.

### Final pass
Whole-build verification + final /roast-code + FUTURE_WORK.md.
