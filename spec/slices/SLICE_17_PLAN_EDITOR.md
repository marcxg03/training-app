# SLICE_17_PLAN_EDITOR.md

> Slice 17 — Plan editor (assign reusable workouts to days) + delete plans.
> Solo-built. Migration 020. Second half of the Workouts-tier plan (Slice 16
> built the catalog).

## Goal

Let plans be built by selecting reusable workouts (Slice 16's `workout_defs`)
onto days of the week, in a dedicated weekly editor, and let plans be deleted.
Completes the hierarchy: Exercises → Blocks → Workouts → **Plans**.

## Propagation model — "materialize on save" (user-chosen)

A scheduled workout that came from the catalog carries `workouts.workout_def_id`.
On **plan save**, each catalog-linked workout's blocks are copied from the
definition into its `workout_blocks` snapshot — **re-synced** every save for
unlogged workouts (so definition edits propagate when you re-save the plan), and
**frozen** (skipped) once the workout has logged history. This keeps the entire
logging/history model and all six block-read paths (Today, day view, logger,
history, plan week, today-workout) **unchanged** — they still read
`workout_blocks`. (The alternative, instant read-time resolution, was declined to
avoid touching the append-only logging core.)

## Schema (migration 020)

`workouts` gains `workout_def_id uuid NULL REFERENCES workout_defs ON DELETE SET
NULL` + index. Ad-hoc per-day workouts (from the day editor) leave it NULL and
behave exactly as before.

## Contracts

- `plan/plan-mutations.ts`: `deletePlan` — refuses the only plan; if the deleted
  plan was active, activates the most-recent remaining one.
- `plan/queries.ts`: `getPlanEditData(planId)` — all 7 days + their workouts
  (with def link + `has_history`) + the workout catalog.
- `plan/mutations.ts`: `savePlan(days)` — per day: history-guard removals, set
  rest flag, delete removed, upsert rows (renormalized order). For catalog rows:
  re-sync name from the def and `materializeBlocks` (copy `workout_def_blocks` →
  `workout_blocks`) unless `has_history`. New rows insert with the def's name +
  type (`'lifting'`, so the cardio CHECK holds), `timing:'anytime'`, `gym:null`.
- `library/mutations.ts`: `getDeletionImpact("workout", …)` now warns when the def
  is scheduled (`workouts.workout_def_id`); deletion SET-NULLs those rows (they
  keep their last materialized blocks).
- UI: `/plan/edit` page + `PlanEditForm` (plain-state weekly editor: per-day
  rest toggle + ordered workout list with `MoveButton` reorder + remove
  [disabled when `has_history`] + `WorkoutPicker` over the catalog). "Edit plan"
  link on the plan page; "Delete" control in `PlanControls`.

## Acceptance criteria

1. Plan page has an "Edit plan" button → `/plan/edit` (weekly, all 7 days).
2. Assigning a catalog workout to a day and saving makes it appear on the plan
   week / Today / day view with the definition's blocks (materialized).
3. Editing the definition and re-saving the plan propagates to unlogged
   scheduled days; a logged session's snapshot stays frozen.
4. Delete a plan (auto-activates another if it was active); the only plan can't
   be deleted.
5. Deleting a scheduled workout from the catalog warns and unlinks (SET NULL),
   leaving the day's last blocks intact.
6. typecheck/lint/format/build clean; no console errors.

## Out of scope

- Instant live read-time resolution (deliberately not built — see model above).
- Per-assignment timing/gym in the weekly editor (defaults `anytime`/none; refine
  in the per-day editor, which is kept).
- Cardio/recovery workout composition (catalog is lifting-only — Slice 16 scope).
