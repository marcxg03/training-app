# SLICE_10_PLAN_EDITOR.md

> Slice 10 — Plan Editor (5B), non-destructive v1
> Phase 4 — feature slice, schema-light (NO migration). Solo-built (Claude Code
> drafter + reviewer-subagent cross-check).

## 1. Goal

Let Marcus restructure a training day in-app instead of editing markdown:
toggle rest day, rename/re-time/re-gym the day's workouts, reorder them, add a
new lifting session, and remove a session — with schedule validation on save
(hard rules block; soft rules warn with an explicit "Save anyway" override).

## 2. Two data-integrity guardrails (why v1 is deliberately scoped)

`workouts` is referenced directly by logged history and constrained by a CHECK:

- **History cascade:** `set_logs.workout_id` and `workout_completions.workout_id`
  → `workouts(workout_id) ON DELETE CASCADE`. Deleting a schedule workout would
  silently delete its logged sets (which feed PR detection). → **Plan Editor is
  non-destructive: a workout with any logged history cannot be removed** (UI
  disables it; the mutation re-checks and refuses).
- **Cardio CHECK** (migration 002): `workout_type='cardio'` ⇔ `cardio_format
  NOT NULL`. Changing a workout's type could violate it. → **v1 does not edit
  `workout_type`**; field edits preserve type + cardio fields, and newly added
  workouts are `lifting` (cardio_format null) so the CHECK always holds.

No migration is needed; these are scoping choices, not schema changes.

## 3. Scope

### In

- Route `/plan/[day]/edit` (Edit button added to `/plan/[day]`).
- Rest-day toggle (`daily_schedules.is_rest_day`).
- Per existing workout: edit `workout_name`, `timing` (am/anytime/pm), `gym`;
  reorder (↑/↓ → `display_order`); remove (only if no history).
- Add a new **lifting** workout (name/timing/gym; type fixed lifting).
- Validation on save:
  - **Hard (blocks):** the week must keep ≥ 1 rest day.
  - **Soft (warn + override):** cardio scheduled before lifting on the same day.
  - Save button becomes "Save anyway — overriding N warning(s)" when soft
    warnings exist; hard errors disable save entirely.

### Out (documented in FUTURE_WORK)

- Editing blocks within a workout (`workout_blocks` wiring / block order) and
  adding cardio/recovery workouts (need cardio fields + polymorphic preset
  wiring).
- The remaining methodology validation rules (48h muscle-group recovery,
  push/pull weekly balance, sauna limits, yoga+sauna same day, compound 24h,
  recovery timing on two-session days) — they need a muscle-group / recovery-
  activity analysis engine.

## 4. Contracts

### Methodology (pure — `src/lib/methodology/plan-schedule.ts`)

- `type EditableWorkout = { workout_type; timing; display_order }`.
- `daySoftWarnings(workouts): string[]` — emits the cardio-before-lifting
  warning when a cardio workout sorts before a lifting workout (timing then
  display_order).
- `weekRestDayError(editedDayIsRest, otherDaysHaveRest): string | null` — the
  ≥1-rest-day hard rule.
- `validateSchedule(input): { hardErrors: string[]; softWarnings: string[] }`.

### Data layer (`src/lib/plan/`)

- `projections.ts`: `EditableWorkoutRow` (workout_id|null, name, type, timing,
  gym, display_order, hasHistory), `DayEditData`.
- `queries.ts` (server): `getDayEditData(day)` — active plan → schedule (id,
  is_rest_day) → workouts; per workout a `hasHistory` flag (count set_logs +
  workout_completions); plus the other six days' `is_rest_day` for the week
  rule.
- `mutations.ts` (browser): `saveDay(supabase, input)` — diff-based, NOT
  delete-then-insert: update is_rest_day; UPDATE existing workouts
  (name/timing/gym/display_order); INSERT new lifting workouts; DELETE removed
  workouts only after re-checking they have no history. Friendly errors.
- `schemas.ts`: `daySchema` (is_rest_day boolean; workouts array with
  name ≤60 required, timing enum, gym ≤60 optional).

### UI (`src/app/(app)/plan/[day]/_components/` + route)

- `/plan/[day]/edit/page.tsx` (server shell) → `DayEditForm`.
- `DayEditForm` (client, RHF + zod + useFieldArray): rest-day switch, workout
  rows (`WorkoutEditRow`: name/timing/gym inputs + ↑/↓ + remove[guarded]),
  "Add lifting session", live validation panel, save / save-anyway, discard
  guard. On save → `saveDay` → redirect to `/plan/[day]`.
- Edit button on `/plan/[day]`.

## 5. Acceptance criteria

1. `/plan/[day]` has an Edit button → `/plan/[day]/edit` pre-filled.
2. Rest-day toggle, workout field edits, reorder, add-lifting, and
   remove-if-no-history all work and persist.
3. A workout with logged history shows a disabled remove with an explanatory
   label; the mutation refuses to delete it even if forced.
4. Removing the last rest day (week-wide) blocks save with a hard error.
5. A cardio-before-lifting day produces a soft warning and the
   "Save anyway — overriding N warning(s)" button; overriding saves.
6. `workout_type` is never changed; new workouts are lifting; the cardio CHECK
   is never violated. No migration.
7. Module boundaries: validation pure; `lib/plan/` no React; browser-client
   writes. typecheck/lint/format/build clean; no console errors.
