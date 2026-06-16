# SLICE_13_MEAL_RANGES.md

> Slice 13 — Macro/calorie ranges on meals + edit/delete logged meals.
> Solo-built. Migration 018.

## Goal

Log and display calories/macros as ranges (an estimate), and let logged meals
be edited or deleted. Ranges pair naturally with the AI photo estimator
(Slice 14), whose output is inherently a range.

## Schema (migration 018)

`meal_entries` gains `protein_min_g/max_g`, `carbs_min_g/max_g`,
`fat_min_g/max_g`, `cal_min/cal_max` (numeric). Existing single columns
(`protein_g`/`carbs_g`/`fat_g`/`calories`) are backfilled (min=max=value), then
made nullable and deprecated (kept for history, no longer written). CHECK
`max >= min AND min >= 0` per pair (min==max allowed = exact entry). RLS already
allows SELECT/INSERT/UPDATE/DELETE own (008).

## Contracts

- `methodology/nutrition.ts`: `rangeStatusForRange(valueMin, valueMax,
  targetMin, targetMax)` — "in" when the logged range overlaps the target band;
  "under"/"over" only when wholly below/above.
- `nutrition/schemas.ts`: `mealSchema` is six range fields + `meal_type` +
  `note`, with `max >= min` refines per macro.
- `nutrition/mutations.ts`: `logMeal` / `updateMeal` go through `toMealRow`,
  deriving `cal_min = macroCalories(mins)`, `cal_max = macroCalories(maxes)`;
  `deleteMeal`.
- `LogMealSheet`: create + edit; an **exact/range toggle** — exact mode shows
  one input per macro (writes min=max); range mode shows Low/High. Leaving
  range mode collapses each max→min (WYSIWYG). Live calorie-range preview.
- `MealsSection` (client): the meals list with per-row edit (pencil) + delete
  (trash, confirm dialog) and the Log meal button.
- `MacroProgressBar`: renders the logged range as a band — solid fill to the
  lower bound, lighter band to the upper, with the target-min marker.
- `page.tsx`: totals summed as ranges; bars via `rangeStatusForRange`.

## Acceptance criteria

1. Log a meal exactly (one number per macro) or as ranges (Low/High); calories
   derive as a range (or single when exact).
2. Dashboard sums to a total range and shows a band per macro vs the target.
3. Edit a logged meal (prefilled; range meals open in range mode); delete with
   confirmation.
4. Migration backfills existing meals to exact (min=max); no row violates the
   new CHECK; new range-only inserts don't trip the old single-column CHECK.
5. typecheck/lint/format/build clean; no console errors.

## Out of scope

- AI photo estimate (Slice 14) — will prefill this form in range mode.
- Mirroring the macro band onto the Today dashboard (FUTURE_WORK).
