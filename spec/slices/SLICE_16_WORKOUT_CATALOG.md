# SLICE_16_WORKOUT_CATALOG.md

> Slice 16 — reusable Workouts catalog (Library tab). Solo-built.
> Migration 019. First half of the Workouts-tier plan (Slice 17 wires plans).

## Goal

Add the missing middle tier of the hierarchy (Exercises → Blocks → **Workouts** →
Plans): a reusable, owner-scoped workout composed of lifting blocks, edited in a
new **Library → Workouts** tab. This is the single source of truth for a
workout's contents; Slice 17 lets plans select these workouts onto days.

## Schema (migration 019)

- `workout_defs` (workout_def_id, owner_user_id, name, workout_type default
  'lifting', timestamps, UNIQUE(owner_user_id, name)) + `set_updated_at` trigger.
- `workout_def_blocks` (workout_def_id, block_id → blocks, display_order,
  PK(workout_def_id, block_id)).
- RLS: own via owner_user_id on workout_defs; via def-ownership EXISTS on
  workout_def_blocks (mirrors migration 016). All four CRUD policies.

## Contracts

- `library/projections.ts`: `WorkoutDefSummary` (+ block_count), `WorkoutDefDetail`
  (+ ordered `BlockInWorkoutDef[]`).
- `library/queries.ts`: `getWorkoutDefs()`, `getWorkoutDefDetail(id)` (mirror
  getLiftingBlocks / getBlockDetail; exercise counts per block for the summary
  line).
- `library/schemas.ts`: `workoutDefSchema` (name unique-async via `nameConflicts`
  + `workout_defs` case in `uniqueness.ts`; `blocks: [{block_id, display_order}]`).
- `library/mutations.ts`: `createWorkoutDef`, `updateWorkoutDef` (via
  `replaceWorkoutDefBlocks`, the workout analog of `replaceBlockBank`). Extends
  `LibraryItemKind`/`getDeletionImpact`/`deleteLibraryItem`/`DELETE_CONFIG` with
  kind `"workout"` (clean delete this slice; the scheduled-reference guard is
  added in Slice 17 once `workouts.workout_def_id` exists).
- UI: 5th `LibraryTabs` entry (grid-cols-5); `BlockPicker` (cmdk over lifting
  blocks, parallel to `ExercisePicker`); `BlockComposition` (ordered list +
  `MoveButton` up/down + remove, parallel to `BankComposition`); `WorkoutDefForm`
  (parallel to `BlockForm`); `AddWorkoutButton`, `WorkoutListCard`; routes
  `library/workouts/{,/new,/[id],/[id]/edit}`. Reuses `MoveButton`,
  `useDiscardChangesGuard`, `DeleteLibraryItemButton`.

## Acceptance criteria

1. Library shows a 5th "Workouts" tab; empty state + Add workout.
2. Create a workout: name it, pick lifting blocks from a searchable list
   (already-added blocks excluded), reorder with arrows, save → lands on detail.
3. Detail shows the blocks in saved order with type + exercise count; Edit +
   Delete present.
4. Edit (add/remove/reorder blocks, rename) persists; duplicate names rejected.
5. Delete removes the workout (clean — no references yet) and returns to the list.
6. typecheck/lint/format/build clean; no console errors.

## Out of scope (Slice 17)

- Plans referencing workouts (`workouts.workout_def_id`), the /plan/edit weekly
  assigner, delete plans, and the live-resolution + log-time snapshot.
- Cardio/recovery workout composition (schema carries `workout_type` for later).
