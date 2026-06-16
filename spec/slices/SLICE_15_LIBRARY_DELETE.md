# SLICE_15_LIBRARY_DELETE.md

> Slice 15 — Delete library items (lifting blocks, exercises, cardio &
> recovery activities). Solo-built. No migration (RLS delete_own already
> exists from 014/016).

## Goal

Add a Delete affordance to the four Library surfaces that already have Edit
(from Slice 7b): lifting blocks, exercises, cardio activities, recovery
activities. **Non-destructive** — deletion is refused when it would erase logged
history; allowed (with a warning) when the item is only referenced by the
catalog/schedule.

## The cascade landmine

The FKs from history tables onto blocks/exercises are `ON DELETE CASCADE`
(`set_logs.block_id`, `set_logs.exercise_id`, `pr_history.exercise_id`), so the
DB would **silently destroy** history rather than block the delete.
`activity_completions.activity_id` is a polymorphic uuid with **no FK**, so
cardio/recovery history wouldn't cascade — it would orphan. Likewise
`workout_completions.completed_block_ids` (uuid[]) and
`workout_blocks.preset_activity_id` have no FK. Therefore the application guard
in `getDeletionImpact` is the only protection, and it **fails safe**: any count
error refuses the delete.

## Contracts

- `library/mutations.ts`:
  - `getDeletionImpact(supabase, kind, id) → { blocked, reason?, warning? }`.
    - exercise → blocked if `set_logs` or `pr_history` reference it; else warn if
      in N `block_lifting_items` banks.
    - block → blocked if `set_logs` reference it OR it appears in any
      `workout_completions.completed_block_ids`; else warn if in N
      `workout_blocks` (scheduled).
    - cardio/recovery → blocked if `activity_completions` rows exist for
      (activity_id, activity_type=kind); else warn about the block bank and any
      `workout_blocks` preset references.
  - `deleteLibraryItem(supabase, kind, id)` — re-runs the guard (no trust in the
    dialog's stale impact), then deletes by id. Friendly RLS/error messages.
- `DeleteLibraryItemButton` (client): trash icon → confirm Dialog. Fetches impact
  on open (loading state). Blocked → shows the reason, hides Delete. Allowed →
  shows the warning (if any), confirms. On success: `redirectTo` (block detail →
  lifting list) or `router.refresh()` (list rows).
- Wired into `ExerciseListCard`, `CardioActivityCard`, `RecoveryActivityCard`,
  and the block detail page (`lifting/blocks/[block_id]/page.tsx`).

## Acceptance criteria

1. Each of the four surfaces shows a Delete control next to Edit.
2. Deleting an item with **no** logged history succeeds and the list refreshes
   (block delete returns to the lifting list); a catalog/schedule reference
   surfaces as a warning, not a block.
3. Deleting an item **with** logged history is refused with a clear reason and no
   data is touched (verified by code + guard; the guard fails safe on any count
   error).
4. typecheck / lint / format / build clean; no console errors.

## Out of scope

- Bulk delete; undo/restore.
- A DB-level RESTRICT/trigger guard (the app guard is the mechanism; a tiny
  TOCTOU window is accepted for this single-user app — see KNOWN_ISSUES).
- Deleting the Cardio/Recovery container blocks (only their activities).
