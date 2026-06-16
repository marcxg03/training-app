# SLICE_8_NUTRITION.md

> Slice 8 — Nutrition tab (4A Dashboard + 4B Log Meal) + Targets editor (5D, subset)
> Phase 4 — feature slice, schema-light (NO new migration — `nutrition_targets`
> and `meal_entries` already exist from migration 005, RLS from 008).
> Solo-built (Claude Code as drafter + reviewer-subagent cross-check), per the
> 2026-06-16 decision to complete the app without the Codex web loop.

## 1. Goal

Promote the Nutrition tab from a 3-line stub to a working surface: an
auto-contextual daily dashboard (4A) showing today's day-type meal framework
and four macro progress bars (calories / protein / carbs / fat) against the
user's target ranges, a Log Meal flow (4B) with auto-derived calories, and a
Nutrition Targets editor (5D) with a macro-to-calorie consistency check and
goal-mode default seeding. Reuses the Slice 7b form-library standard
(react-hook-form + zod + shadcn) and writes directly via the supabase browser
client (no Server Actions, no Slice 5 sync queue). Goal Mode selector (5E) and
the Today-dashboard macro mirror are deferred to their owning slices.

## 2. Schema (existing — no migration)

- `nutrition_targets` (005): one row per user (UNIQUE user_id). `cal_min/max`,
  `protein_min_g/max_g`, `carbs_min_g/max_g`, `fat_min_g/max_g` (all integer,
  NOT NULL), `updated_at` (trigger). CHECK `<min> < <max>` on all four pairs —
  **strict less-than**; the editor must enforce min < max.
- `meal_entries` (005): `meal_id`, `user_id`, `date`, `meal_type` (free text),
  `protein_g`/`carbs_g`/`fat_g`/`calories` (numeric, NOT NULL; CHECK macros
  >= 0), `note` (nullable), `logged_at`. Indexed `(user_id, date)`.
  Append-only **via UI** (no edit/delete affordance in this slice; the DB
  permits corrections but the UI does not expose them).

## 3. Contracts

### Methodology (pure — `src/lib/methodology/nutrition.ts`, no React/Supabase)

- `macroCalories(protein, carbs, fat): number` — `round(4P + 4C + 9F)`.
- `MACRO_KCAL = { protein: 4, carbs: 4, fat: 9 }`.
- `rangeStatus(value, min, max): "under" | "in" | "over"`.
- `goalModeDefaultTargets(goalMode): NutritionTargetValues` — sensible default
  ranges per cut / maintain / lean_bulk (used to seed the editor when no row
  exists; macro ranges chosen so their derived calories bracket the cal range).
- `caloriesConsistency(targets): { derivedMin, derivedMax, consistent, message }`
  — derives the calorie range implied by the macro ranges and flags when the
  entered cal range diverges beyond a tolerance (±10%). Informative, not a hard
  block (the only hard rule is the DB's min < max).
- `dayTypeFramework(dayType, goalMode): { title, guidance, emphasis }` — short
  contextual guidance keyed off today's day type (`rest` | `lifting` |
  `cardio`) and goal mode.

### Data layer (`src/lib/nutrition/`)

- `projections.ts`: `NutritionTargets`, `MealEntry`, `MacroTotals`,
  `MacroBar` (key, label, total, min, max, status, unit), `NutritionDayType`.
- `queries.ts` (server client): `getNutritionTargets()`,
  `getMealsForDate(date)`, `getTodayDayType()` (reuses
  `getTodayDayOfWeek` + active-plan `daily_schedules`/`workouts`).
- `mutations.ts` (browser client, `{ ok }` discriminated result, friendly
  error translation): `logMeal(supabase, userId, input)` (INSERT),
  `upsertTargets(supabase, userId, input)` (UPSERT on user_id).
- `schemas.ts`: `mealSchema` (meal_type required ≤60, protein/carbs/fat ≥0
  numeric, note ≤500), `targetsSchema` (eight ints ≥0 with min < max refines
  on each pair). Types via `z.infer`.

### Routes / components

- `/nutrition` (4A, Server Component): fetch targets + today's meals + day
  type. Renders `DayTypeFrameworkCard`, four `MacroProgressBar`s (or a
  "Set targets" prompt if no targets), today's `MealList` + totals, and a
  `LogMealButton` (opens `LogMealSheet`). Empty state when no meals.
- `LogMealSheet` (4B, client, RHF+zod): meal_type, protein/carbs/fat, live
  auto-derived calories preview, optional note → `logMeal` → `router.refresh()`.
- `/nutrition/targets` (5D, Server Component shell) → `TargetsForm` (client,
  full-page, RHF+zod): eight fields, live consistency check, goal-mode default
  seeding when empty → `upsertTargets` → redirect back to `/nutrition`.
- `MacroProgressBar`, `DayTypeFrameworkCard`, `MealList`, `LogMealButton`,
  `LogMealSheet`, `TargetsForm` under `src/app/(app)/nutrition/_components/`.

## 4. Acceptance criteria

1. `/nutrition` renders the day-type framework card contextual to today.
2. With targets set, four progress bars show total vs range with under/in/over
   status conveyed by **both** color and a text/icon label (accessibility).
3. With no targets, the dashboard shows a "Set your targets" prompt linking to
   `/nutrition/targets` instead of bars.
4. Log Meal: free-form meal type + P/C/F; calories auto-derived live
   (4P+4C+9F) and persisted; save inserts a `meal_entries` row and the
   dashboard totals/bars update.
5. Targets editor enforces min < max on every pair (matches DB CHECK), shows
   the macro-to-calorie consistency check, seeds goal-mode defaults when empty,
   and upserts the single per-user row.
6. All writes use the browser client; no Server Actions; no sync queue. 23505
   /23514/42501 → friendly inline errors.
7. Module boundaries: `methodology/nutrition.ts` pure; `lib/nutrition/` no
   React; components own presentation; pages fetch.
8. `pnpm typecheck` / `lint` / `format:check` / `build` clean. No console
   errors. No new dependencies. No migration.

## 5. Out of scope

- Goal Mode selector + 5E.1 recommendation flow (Settings slice).
- Mirroring the macro bars onto the Today dashboard (Today slice; component
  built reusably so it can be adopted later).
- Meal edit/delete UI (append-only via UI).
- Per-meal-slot planning beyond the day-type guidance card.
- Body-fat / weight trend / photo tracking.
