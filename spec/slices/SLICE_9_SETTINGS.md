# SLICE_9_SETTINGS.md

> Slice 9 — Settings menu (5A) + Profile (5E) + Goal Mode Recommendation (5E.1)
> Phase 4 — feature slice, schema-light (NO new migration — `profiles` already
> has display_name / bodyweight_kg / height_cm / goal_mode from migration 001).
> Solo-built (Claude Code drafter + reviewer-subagent cross-check).

## 1. Goal

Turn the Settings stub into a real hub and close the nutrition goal-mode loop.
Adds: a Settings menu (5A) linking to the app's editing surfaces + sign-out; a
Profile editor (5E) for display name, bodyweight (kg), height (cm), and goal
mode; and the Goal Mode Recommendation flow (5E.1) — when goal mode changes,
show the current target ranges beside the recommended defaults for the new
mode with per-field "apply" toggles, applying only the toggled fields to
`nutrition_targets` and leaving the rest at their current values. Reuses the
Slice 8 `goalModeDefaultTargets` + `upsertTargets` and the Slice 7b form
library. Browser-client writes; no Server Actions; no Slice 5 queue.

## 2. Schema (existing — no migration)

- `profiles` (001): `user_id` PK, `display_name` (text, null), `bodyweight_kg`
  (numeric, null), `height_cm` (numeric, null), `goal_mode`
  (goal_mode_enum: cut | maintain | lean_bulk), timestamps. RLS:
  SELECT/INSERT/UPDATE own (migration 007).
- `nutrition_targets` (005): reused via Slice 8 helpers.

## 3. Contracts

### Methodology (pure — extend `src/lib/methodology/nutrition.ts`)

- `applyTargetToggles(current, recommended, toggles): NutritionTargetValues` —
  for each of the eight fields, returns `toggles[field] ? recommended[field] :
  current[field]`. Pure merge for the 5E.1 apply step.
- `TARGET_FIELD_GROUPS` already implied by Slice 8; the recommendation UI
  compares calorie + protein + carbs + fat ranges.

### Data layer (`src/lib/settings/`)

- `projections.ts`: `Profile` (display_name, bodyweight_kg, height_cm,
  goal_mode).
- `queries.ts` (server): `getProfile()`.
- `mutations.ts` (browser): `updateProfile(supabase, userId, input)` (UPSERT on
  user_id so a missing row self-heals; friendly error translation).
- `schemas.ts`: `profileSchema` — display_name (trim, ≤80, optional→""),
  bodyweight_kg / height_cm (positive number or null), goal_mode (enum). Types
  via `z.infer`.

### Routes / components

- `/settings` (5A, Server Component): rewrite the stub into a menu — rows
  linking to Profile, Nutrition targets (`/nutrition/targets`), Exercise
  library (`/library/exercises`) + the existing Sign out. Plan Editor row
  omitted until that slice ships.
- `/settings/profile` (5E, Server Component shell): fetch profile + current
  nutrition targets → `ProfileForm`.
- `ProfileForm` (client, RHF + zod): the four fields; on submit calls
  `updateProfile`. If `goal_mode` changed from its loaded value, opens
  `GoalModeRecommendationSheet` after the profile save succeeds (does not
  navigate away until that flow is resolved/closed).
- `GoalModeRecommendationSheet` (client): per macro/calorie row, shows
  "current min–max" vs "recommended min–max" (from
  `goalModeDefaultTargets(newMode)`) with an "Apply" Checkbox (default on when
  the values differ). Confirm → `upsertTargets(applyTargetToggles(...))` →
  `router.refresh()`; close → leave targets untouched. If the user has no
  targets yet, "current" is shown as "—" and applying seeds the recommended
  value.
- Components under `src/app/(app)/settings/_components/`.

## 4. Acceptance criteria

1. `/settings` shows a menu with working links to Profile, Nutrition targets,
   Exercise library, and a Sign out control.
2. `/settings/profile` pre-fills the four fields; bodyweight/height accept a
   positive number or empty (null); display name optional.
3. Saving the profile with no goal-mode change updates `profiles` and returns
   to the menu (or shows a saved state) without the recommendation flow.
4. Changing goal mode + saving opens the recommendation sheet showing current
   vs recommended ranges with per-field apply toggles.
5. Confirming applies only the toggled fields to `nutrition_targets` (others
   keep current values); past meal logs are untouched.
6. All writes use the browser client; friendly errors on 23514/42501/23505.
7. Module boundaries: merge/defaults in methodology (pure); `lib/settings/` no
   React; pages fetch; components present.
8. `pnpm typecheck` / `lint` / `format:check` / `build` clean. No console
   errors. No new dependencies. No migration.

## 5. Out of scope

- Plan Editor (5B) — separate slice.
- kg/lbs display toggle (FUTURE_WORK) — bodyweight shown/stored in kg.
- Bodyweight history / trend (single editable field only, per MASTER_SPEC).
- PWA configuration (Slice 10).
