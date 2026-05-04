# SLICE_7A_LIBRARY_READ.md

> Slice 7a of 10 (split from Slice 7 in Phase 0 — Slice 7b covers edit/add/delete affordances)
> Phase 4 — feature slice with major schema change
> Spec source: this slice doc plus MASTER_SPEC §13 + ARCHITECTURE §17 (both new — drafted as Phase 1 follow-up writes after this slice spec lands)
> Phase 0 decisions: blocks promoted to global with `block_category` discriminator (Path α); workouts table rename; sub-tab IA (Shape A); URL-segment routing per sub-tab; drill-into-block-detail (Pattern α); name-based dedupe + wiki edits to enforce uniqueness; activity_completions schema-only in 7a; cardio + recovery blocks user-specific.

## 1. Goal

Promote `blocks` to a global per-user catalog (decoupled from workouts), rename `sessions`→`workouts` with cascade renames across all dependent FKs and column references, add `cardio_activities` + `recovery_activities` + `activity_completions` catalog tables, and ship a read-only Library tab as the 6th bottom-nav surface with three sub-tabs (Lifting / Cardio / Recovery), URL-segment routing, and drill-into-block-detail rendering. Wiki rewrite + seed parser update reshape Marcus's existing plan into the new schema before the post-migration re-seed. Slice 7b adds the edit/add/delete affordances on top of this read-only foundation.

## 2. Acceptance Criteria

### Schema and migrations

1. New migration `013_workouts_rename_and_blocks_global.sql` applies cleanly. Migration opens with a Step 0 test-data wipe: `DELETE FROM pr_history WHERE set_log_id IS NOT NULL; DELETE FROM set_logs; DELETE FROM session_completions; DELETE FROM block_exercises; DELETE FROM blocks;` — wipes Slices 4-6 verification data so the subsequent rename + UNIQUE-constraint steps run against empty/small tables. Slice 2's 3 seeded historical PRs (set_log_id IS NULL) are preserved; `daily_schedules`, `training_plans`, `exercises`, `profiles` are preserved. After Step 0: renames `sessions`→`workouts` (with cascade column renames `session_id`→`workout_id`, `session_name`→`workout_name`, `session_type`→`workout_type`); renames `session_completions`→`workout_completions` (cascade rename `session_id`→`workout_id`); updates `set_logs.session_id`→`set_logs.workout_id`. Promotes `blocks` to global: drops `blocks.session_id` (after migration 014 backfills `workout_blocks` from the still-empty blocks table); adds `blocks.owner_user_id uuid NOT NULL`, `blocks.block_category block_category_enum NOT NULL`, makes `blocks.block_type` nullable, adds CHECK constraint `blocks_lifting_has_type` (lifting → block_type required; cardio/recovery → block_type NULL). Adds `UNIQUE (owner_user_id, block_name)` — commits cleanly because Step 0 emptied the table. Renames `block_exercises`→`block_lifting_items`.
2. New migration `014_workout_blocks_junction.sql` applies cleanly. Creates `workout_blocks` (workout_id, block_id, display_order, preset_activity_id nullable, preset_activity_type text nullable CHECK in cardio/recovery). PK is `(workout_id, block_id, display_order)`.
3. New migration `015_cardio_recovery_catalogs.sql` applies cleanly. Creates `cardio_activities`, `recovery_activities`, `block_cardio_items`, `block_recovery_items`, `activity_completions` per Section 4 schema. Indexes per Section 4.
4. New migration `016_extended_rls_for_library.sql` applies cleanly. RLS enabled with SELECT/INSERT/UPDATE/DELETE policies (4-policy pattern) on `cardio_activities`, `recovery_activities`, `block_cardio_items`, `block_recovery_items`, `activity_completions`, `workout_blocks`. Existing tables (`blocks`, `workouts`, `workout_completions`, `set_logs`, `block_lifting_items`, `pr_history`) retain their RLS shape across the rename.
5. Migration immutability: zero edits to migrations 001-012. All schema work in 013-016.
6. `pr_history` partial unique index `idx_pr_history_set_log_pr_type_unique` (from migration 009) survives the rename; the index continues to live on `pr_history (set_log_id, pr_type) WHERE set_log_id IS NOT NULL`.
7. Generated TS types in `src/lib/supabase/types.ts` reflect the full new schema after `supabase gen types typescript --linked`.

### Wiki and seed

8. Wiki edits applied in `current-plan.md` BEFORE the post-migration re-seed runs:
   - One of the two "Mid Chest" block instances renamed to "Bench Press Focus" (the bench-press-focused day variant)
   - Second "Lateral Raise" block in Push renamed to "Shoulder Burnout"
   - Recovery: "Hot Yoga or Sauna" replaced with explicit per-day recovery activity choice (e.g., Saturday → "Hot Yoga", Sunday → "Sauna" or whatever Marcus's actual cadence is — Phase 0 wiki-rewrite step nails the per-day mapping)
   - Any other same-name block occurrences across workouts are intentional reuses (e.g., `Vertical Pull` in Monday Upper + Friday Pull, `Calves` in Tuesday Lower Compound + Saturday Lower ATG). The seed parser deduplicates by `(owner_user_id, block_name)` into a single global catalog row, with `workout_blocks` wiring the same `block_id` into multiple workouts. These reuses are NOT renamed — they are the catalog model working as designed (per §4 seed step 7 and AC #34).
9. After wiki edits + re-seed, every existing block has a unique `(owner_user_id, block_name)`. The migration's pre-rename UNIQUE index on the new `blocks` table commits without violation.
10. Seed parser (`supabase/seed/seed-from-wiki.ts` + `supabase/seed/lib/methodology-rules.ts`) updated to write into the new schema:
    - Workouts (formerly sessions) inserted via the renamed columns
    - Lifting blocks inserted as global rows (one per `(owner_user_id, block_name)`); `workout_blocks` rows wire workouts → blocks
    - For lifting blocks: `block_lifting_items` populated as before (FK to existing `exercises` table)
    - Marcus's user gets exactly one cardio block and one recovery block (default names "Cardio" and "Recovery")
    - Cardio activities populated into `cardio_activities` (one row per distinct cardio session in the wiki — Speed Run, Endurance Run, Basketball)
    - Recovery activities populated into `recovery_activities` (one row per distinct recovery activity per the wiki rewrite — Hot Yoga, Sauna)
    - `block_cardio_items` wires cardio block → all cardio activities; `block_recovery_items` wires recovery block → all recovery activities
    - `workout_blocks.preset_activity_id` populated for cardio + recovery workouts (Monday Speed Run workout has preset_activity_id = the Speed Run row in cardio_activities; preset_activity_type = 'cardio')
    - `workout_blocks.preset_activity_id` is NULL for lifting workouts (Logger picks at workout time)
11. Re-running the seed script with the same wiki content is idempotent — no duplicate rows, no errors. The script reports `Inserted 0, Updated 0, Deleted 0, Unchanged N` on a clean second run.

### Library tab — bottom nav

12. `BottomTabBar` updated: 6 tabs in order **Today / Plan / Library / History / Nutrition / Settings**.
13. Bottom-nav tab labels resized from current 11px to 10px to fit 6 tabs at 375px viewport without truncation.
14. Library tab icon: `Library` from lucide-react (the book-shelf icon).
15. Bottom-nav active-tab match still uses `startsWith` so descendant routes (`/library/lifting/blocks/[id]`) keep Library highlighted.

### Library tab — sub-tabs and routing

16. Navigating to `/library` (authenticated) redirects to `/library/lifting` (default sub-tab).
17. `/library/lifting`, `/library/cardio`, `/library/recovery` render their respective sub-tabs as Server Components. Each route fetches only its own data.
18. `LibraryTabs` Client Component renders the sub-tab navigation strip; active sub-tab derived from `usePathname()` (no client state). Tapping a sub-tab navigates via `next/link` to its URL.
19. Library tab is the only sub-tab navigation in the app at this slice's commit; uses shadcn `Tabs` primitive (`pnpm dlx shadcn add tabs`).

### Library — Lifting sub-tab

20. `/library/lifting` renders all of the current user's lifting blocks (`blocks WHERE owner_user_id = auth.uid() AND block_category = 'lifting'`), ordered by `block_name ASC`.
21. Each lifting block renders as a `BlockListCard`: shows block name, block_type badge (failure / mobility / corrective), and an exercise count caption ("8 exercises").
22. Tapping a block card navigates to `/library/lifting/blocks/[block_id]` (block detail route).
23. Empty state if user has zero lifting blocks: `"No lifting blocks yet."` (Slice 7b adds the create-new affordance.)

### Library — Cardio sub-tab

24. `/library/cardio` renders the current user's single cardio block always-expanded inline. No drill-in. Header shows the block name (default "Cardio").
25. Block contents render as a list of cardio activity rows (`CardioActivityCard`) — each shows activity name, format badge (`speed_run` / `endurance_run` / `basketball` / etc.), distance (if set), and target zone.
26. Empty state if cardio block has zero activities: `"No cardio activities yet."` (7b adds create-new.)
27. If user has no cardio block at all (defensive — should not occur post-seed, but handle gracefully): empty state `"Cardio block not configured."` with no further interaction.

### Library — Recovery sub-tab

28. `/library/recovery` renders the current user's single recovery block always-expanded inline. No drill-in. Header shows the block name (default "Recovery").
29. Block contents render as a list of recovery activity rows (`RecoveryActivityCard`) — each shows activity name + description (if set).
30. Empty state if recovery block has zero activities: `"No recovery activities yet."` (7b adds create-new.)

### Library — Block detail (lifting only)

31. `/library/lifting/blocks/[block_id]` renders block detail as a Server Component for the requested block. Validates block exists, belongs to current user (RLS handles), is `block_category = 'lifting'` (redirect to `/library/lifting` otherwise).
32. Block detail page header shows block name + block_type badge.
33. Block detail body shows the bank of exercises in `display_order` from `block_lifting_items` JOIN `exercises`. Each exercise renders with name, prescribed range (e.g., "6–8 reps"), muscle-group caption, bodyweight tag (if `is_bodyweight = true`), and per-exercise notes (if any).
34. Block detail page has a "Back to library" link in the top-left, mirroring Plan tab's pattern.
35. Library is fully read-only — no edit/add/delete affordances anywhere on `/library/*` routes. (7b adds them.)

### Cross-link contract extension

36. New shared component `src/components/shared/BlockLink.tsx` — Server Component wrapping `next/link` with `href` from a new `blockDetailHref(blockId)` helper added to `src/lib/library/crossLinks.ts`. Pattern matches Slice 6.1's `ExerciseLink` and `SessionLink`.
37. Lifting block list rows use `BlockLink` (not direct `next/link`) for navigating to block detail. Same contract enforcement as F6 cross-links from Slice 6.1.

### Regression — existing surfaces still render correctly post-rename

38. **Today tab** still renders correctly: today's workouts (formerly sessions) render with workout_name (formerly session_name), Start Workout buttons still navigate to `/log/[workout_id]` (formerly `/log/[session_id]`).
39. **Plan tab** still renders correctly: Screen 2A's day cards show workouts in chronological order, Screen 2B's session detail uses `workout_id` URL param.
40. **History tab** still renders correctly: PR Timeline + All Sessions list — `getPRTimeline` and `getAllSessions` queries updated to reference `workouts` / `workout_completions` / `workout_id` instead of `sessions` / `session_completions` / `session_id`. Display name still works.
41. **Logger** still renders correctly: `/log/[workout_id]` route loads, validates workout, set_logs INSERT writes to `set_logs.workout_id` column (renamed). Resume logic still works.
42. **Logger PR detection** still works: pr_history INSERT references the renamed columns; partial unique index from migration 009 still gates duplicates.
43. **Sync layer queue handlers** still work: `set_log_insert` handler writes to renamed `workout_id` column; `session_completion_*` queue kinds renamed to `workout_completion_*` in the discriminated union (queue_localstorage migration handled by version bump or graceful handling of in-flight rows from before the rename).

### Slice 7a NOT-IN-SCOPE

44. NO edit/add/delete affordances on Library — read-only browse only.
45. NO form library adoption (RHF + zod). Slice 7b makes the call once edit forms exist.
46. NO completion logging UI for cardio/recovery activities. `activity_completions` table is schema-only; UI defers to Slice 8.5 / 9.
47. NO Recharts. Slice 6.2 still owns it.
48. NO bank-edit on lifting block detail page. Read-only browse of the bank only.
49. NO MASTER_SPEC §13 / ARCHITECTURE §17 commits in this slice. Phase 1 follow-up writes after this slice spec lands.

### Pre-existing KI verification carry-forward

50. **🟡 S4-M1 (in-flight save lost on tab close)** verification: deliberate tab-close-mid-save test run during Slice 7a's pre-test setup (5 minutes, before any new work). If verified → close in 7a's post-slice sequence. If not verified → small surgical fix scoped into 7a.
51. **Slice 6.1 empty-state e2e verification** (closes Slice 6.1 FUTURE_WORK entry): performed during Slice 7a's fresh-account dry-run of the Library tab IA.

### Code quality gates

52. `pnpm lint`, `pnpm typecheck`, `pnpm format:check` all clean against post-migration codebase.
53. `pnpm seed` re-run idempotency holds (clean second run reports zero changes).
54. Generated `src/lib/supabase/types.ts` regenerated against migrations 013-016.

## 3. Files to Create or Modify

### New SQL migrations

- `supabase/migrations/013_workouts_rename_and_blocks_global.sql` — opens with a test-data-wipe block (Slices 4-6 verification data) before the rename and UNIQUE-constraint steps; see §4 migration 013 for the explicit ordering
- `supabase/migrations/014_workout_blocks_junction.sql`
- `supabase/migrations/015_cardio_recovery_catalogs.sql`
- `supabase/migrations/016_extended_rls_for_library.sql`

### Wiki edits (Marcus owns; gitignored content; pre-test setup)

- `supabase/seed/wiki/current-plan.md` — block-name uniqueness edits + recovery split per Section 2 AC #8

### Modified seed

- `supabase/seed/seed-from-wiki.ts` — full rewrite of the upsert flow for the new schema
- `supabase/seed/lib/methodology-rules.ts` — `parsePlanFromWiki`, `parseRunningSessions`, `parseRecoveryActivities` updated; new helpers `parseLiftingBlocksGlobal`, `parseCardioActivities`, `parseRecoveryActivitiesCatalog`
- `supabase/seed/lib/types.ts` — TS types for parsed structures updated to new shape (global blocks, activity catalogs, workout_blocks junctions, preset_activity_id mapping)

### New routes — Library tab

- `src/app/(app)/library/page.tsx` — redirect to `/library/lifting`
- `src/app/(app)/library/lifting/page.tsx` — Lifting sub-tab (Server Component, block list)
- `src/app/(app)/library/lifting/blocks/[block_id]/page.tsx` — Block detail route
- `src/app/(app)/library/cardio/page.tsx` — Cardio sub-tab (Server Component, single-block expanded)
- `src/app/(app)/library/recovery/page.tsx` — Recovery sub-tab (Server Component, single-block expanded)
- `src/app/(app)/library/_components/LibraryTabs.tsx` — Client Component, sub-tab navigation strip (shadcn Tabs)
- `src/app/(app)/library/_components/BlockListCard.tsx` — Server, lifting block list item (uses BlockLink)
- `src/app/(app)/library/_components/BlockDetailHeader.tsx` — Server, block detail page header
- `src/app/(app)/library/_components/ExerciseListItem.tsx` — Server, lifting bank exercise row
- `src/app/(app)/library/_components/CardioActivityCard.tsx` — Server, cardio activity row
- `src/app/(app)/library/_components/RecoveryActivityCard.tsx` — Server, recovery activity row
- `src/app/(app)/library/_components/BlockTypeBadge.tsx` — Server, badge for failure/mobility/corrective
- `src/app/(app)/library/_components/CardioFormatBadge.tsx` — Server, badge for cardio_format
- `src/app/(app)/library/_components/EmptyState.tsx` — Server, shared empty state for the three sub-tabs

### New shared cross-link component

- `src/components/shared/BlockLink.tsx` — Server, F6-pattern wrapper for `next/link` to `/library/lifting/blocks/[id]`

### New data layer

- `src/lib/library/queries.ts` — `getLiftingBlocks(userId)`, `getBlockDetail(blockId)`, `getCardioBlock(userId)`, `getRecoveryBlock(userId)`, `getCardioActivities(blockId)`, `getRecoveryActivities(blockId)`. Server-side only. RLS handles user_id filtering.
- `src/lib/library/projections.ts` — TS types: `LiftingBlockSummary`, `LiftingBlockDetail`, `CardioBlockWithActivities`, `RecoveryBlockWithActivities`, `CardioActivity`, `RecoveryActivity`, `LiftingExerciseInBlock`
- `src/lib/library/crossLinks.ts` — `blockDetailHref(blockId)`, `liftingHref()`, `cardioHref()`, `recoveryHref()`
- `src/lib/library/displayName.ts` — utility helpers (e.g., format cardio distance + zone into one caption line)

### New shadcn primitive

- `src/components/ui/tabs.tsx` — installed via `pnpm dlx shadcn add tabs`

### Modified — bottom nav

- `src/components/layout/BottomTabBar.tsx` — add Library tab, reorder to Today / Plan / Library / History / Nutrition / Settings, shrink labels to 10px

### Modified — Today tab (rename adaptation only, no behavior change)

- `src/app/(app)/today/page.tsx` — query references `workouts` instead of `sessions`
- `src/app/(app)/today/session/[session_id]/page.tsx` — RENAMED to `src/app/(app)/today/workout/[workout_id]/page.tsx`; query updated
- `src/components/today/*.tsx` — all references to `session` / `session_id` / `session_name` updated to `workout` / `workout_id` / `workout_name`
- `src/components/today/StartWorkoutButton.tsx` — link target updates from `/log/[session_id]` to `/log/[workout_id]`
- `src/lib/methodology/today.ts` — type imports updated (no behavior change)

### Modified — Plan tab (rename adaptation only)

- `src/app/(app)/plan/page.tsx` — query references `workouts`
- `src/app/(app)/plan/[day]/page.tsx` — query references `workouts` + `workout_blocks` JOIN for block lookup
- `src/components/plan/*.tsx` — references updated to `workout_*` columns
- Plan tab now reads blocks via `workout_blocks` junction rather than `blocks.session_id`. The Day Detail rendering for lifting workouts JOINs `workout_blocks → blocks → block_lifting_items → exercises`. Cardio/recovery workouts JOIN to `cardio_activities` / `recovery_activities` via `workout_blocks.preset_activity_id`.

### Modified — Logger (rename adaptation only)

- `src/app/(app)/log/[session_id]/page.tsx` — RENAMED to `src/app/(app)/log/[workout_id]/page.tsx`; query references `workouts` + `workout_completions`
- `src/components/log/LoggerShell.tsx` — `workout_id` instead of `session_id`; `workout_completions` instead of `session_completions`
- `src/components/log/SetEntryForm.tsx` — `set_logs.workout_id` instead of `set_logs.session_id`; `block_id` lookup now goes through `workout_blocks` junction (a workout's current block is determined by `workout_blocks.display_order` + `workout_completions.completed_block_ids`)
- `src/components/log/SessionSummary.tsx` — RENAME to `WorkoutSummary.tsx`; query updated
- `src/components/log/EndSessionDialog.tsx` — RENAME to `EndWorkoutDialog.tsx`; column references updated

### Modified — History tab (rename adaptation only)

- `src/lib/history/queries.ts` — `getPRTimeline` and `getAllSessions` updated for renamed columns. `getAllSessions` renamed to `getAllWorkouts`. Hybrid query subquery references `workout_completions.workout_id`. Display name format unchanged.
- `src/lib/history/projections.ts` — `AllSessionsRow` renamed to `AllWorkoutsRow`; field names updated (e.g., `session_display_name` → `workout_display_name`).
- `src/lib/history/displayName.ts` — `formatSessionDisplayName` renamed to `formatWorkoutDisplayName`. Logic unchanged.
- `src/lib/history/crossLinks.ts` — `sessionDetailHref` renamed to `workoutDetailHref`. URL pattern updates from `/history/sessions/[id]` to `/history/workouts/[id]`.
- `src/app/(app)/history/page.tsx` — query reference updates
- `src/app/(app)/history/sessions/page.tsx` — RENAMED to `src/app/(app)/history/workouts/page.tsx`. AllWorkoutsRow component rendering updated.
- `src/app/(app)/history/sessions/[completion_id]/page.tsx` — RENAMED to `src/app/(app)/history/workouts/[completion_id]/page.tsx`. Placeholder copy unchanged ("Coming soon — Slice 6.2").
- `src/app/(app)/history/_components/AllSessionsRow.tsx` — RENAMED to `AllWorkoutsRow.tsx`. State derivation logic preserved.
- `src/app/(app)/history/_components/HistoryHeaderLink.tsx` — `allSessionsHref()` renamed to `allWorkoutsHref()`.
- `src/components/shared/SessionLink.tsx` — RENAMED to `WorkoutLink.tsx`. Internal href reference updated.

### Modified — Sync layer (rename adaptation only)

- `src/lib/sync/queue.ts` — `QueueRowKind` discriminated union: `'session_completion_start'` → `'workout_completion_start'`, etc. Localstorage key namespace stays `training-app:queue:<user_id>:<row_id>` (unchanged).
- `src/lib/sync/handlers.ts` — handler keys updated; per-kind handler bodies updated to write to renamed columns.
- `src/components/log/QueuePanel.tsx` — human-readable labels updated ("Session started" → "Workout started", etc.)
- Note: any in-flight queue rows from before the rename (in localStorage) need graceful handling. Use a one-time queue-version bump on mount: detect rows with old `kind` values, rewrite them to new `kind` values without losing the underlying payload. Best-effort — the queue is typically small (single-digit rows) and would drain within minutes of the user signing back in.

### Modified — auth and signOut

- `src/lib/auth/signOut.ts` — confirmation dialog copy updated ("unsynced sets" wording stays; queue inspection logic unchanged because key namespace didn't change)

### Modified — types

- `src/lib/supabase/types.ts` — regenerated via `supabase gen types typescript --linked` after migrations 013-016 apply

### Modified — spec docs (Phase 1 follow-up writes)

- `spec/MASTER_SPEC.md` — new §13 (Tab — Library) drafted in chat first, written after Marcus approval
- `spec/ARCHITECTURE.md` — new §17 (Tab — Library, Slice 7a) drafted in chat first, written after Marcus approval

### Files NOT touched (allowlist enforcement)

- Any `pr_history` migration file (pr_history schema unchanged in 7a)
- Any RLS file beyond migration 016
- `package.json` / `pnpm-lock.yaml` — only the shadcn Tabs install adds a transitive dep; one lockfile change
- Any methodology helper that doesn't reference renamed columns

## 4. Component / Function Contracts

### Migration 013 — workouts rename and blocks promotion

> **Data-wipe rationale.** Slices 4-6 testing accumulated ~4-7 PR rows + ~10-15 set_logs + 2-3 session_completions + dependent block rows that pre-date the global-blocks-catalog model. The current `blocks` table holds 24+ rows including 9 cross-session same-name pairs (intentional reuses per the catalog model, but data-shape duplicates under the new `UNIQUE (owner_user_id, block_name)` constraint). Migrating these in place would require collapse-with-FK-repoint logic (~20 SQL lines per duplicate group) for transient test data. Cleaner path: wipe the test-only tables before the rename, run migrations on empty/small data, then re-seed from the edited wiki to populate the new schema correctly. The 3 Slice-2-seeded historical PRs (Bench 235, OHP 185, Deadlift 435 — `set_log_id IS NULL`) are preserved by the `WHERE set_log_id IS NOT NULL` predicate. `daily_schedules`, `training_plans`, `exercises`, and `profiles` are preserved across the wipe.

```sql
-- ============================================================
-- Step 0 — Test-data wipe (Slices 4-6 verification data only)
--
-- Wipes test-only rows that pre-date the global-blocks model.
-- Preserves Slice 2's 3 seeded historical PRs (set_log_id IS NULL),
-- daily_schedules, training_plans, exercises, profiles.
-- The seed re-runs from edited wiki after migrations 013-016 apply
-- and repopulates blocks (deduplicated globally), block_lifting_items,
-- workout_blocks, and the new cardio/recovery catalogs.
-- ============================================================
DELETE FROM pr_history WHERE set_log_id IS NOT NULL;
DELETE FROM set_logs;
DELETE FROM session_completions;
DELETE FROM block_exercises;
DELETE FROM blocks;
-- sessions table preserved (gets renamed → workouts below)

-- ============================================================
-- Step 1 — Rename sessions → workouts cascade
-- ============================================================
ALTER TABLE sessions RENAME TO workouts;
ALTER TABLE workouts RENAME COLUMN session_id TO workout_id;
ALTER TABLE workouts RENAME COLUMN session_name TO workout_name;
ALTER TABLE workouts RENAME COLUMN session_type TO workout_type;

-- Rename session_completions → workout_completions cascade
ALTER TABLE session_completions RENAME TO workout_completions;
ALTER TABLE workout_completions RENAME COLUMN session_id TO workout_id;

-- set_logs FK column rename
ALTER TABLE set_logs RENAME COLUMN session_id TO workout_id;

-- New enum
CREATE TYPE block_category_enum AS ENUM ('lifting', 'cardio', 'recovery');

-- Block_exercises rename for naming consistency with new sibling tables
ALTER TABLE block_exercises RENAME TO block_lifting_items;

-- Promote blocks to global
ALTER TABLE blocks ADD COLUMN owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE blocks ADD COLUMN block_category block_category_enum;

-- Backfill: every existing block gets owner_user_id and block_category from its parent workout
UPDATE blocks b
SET
  owner_user_id = w.user_id_from_plan,
  block_category = CASE
    WHEN w.workout_type = 'lifting' THEN 'lifting'::block_category_enum
    WHEN w.workout_type = 'cardio'  THEN 'cardio'::block_category_enum
    WHEN w.workout_type = 'recovery' THEN 'recovery'::block_category_enum
  END
FROM (
  SELECT w.workout_id, w.workout_type, p.user_id AS user_id_from_plan
  FROM workouts w
  JOIN daily_schedules d ON d.schedule_id = w.schedule_id
  JOIN training_plans p ON p.plan_id = d.plan_id
) w
WHERE b.session_id = w.workout_id;

-- Set NOT NULL constraints after backfill
ALTER TABLE blocks ALTER COLUMN owner_user_id SET NOT NULL;
ALTER TABLE blocks ALTER COLUMN block_category SET NOT NULL;

-- Make block_type nullable for cardio/recovery
ALTER TABLE blocks ALTER COLUMN block_type DROP NOT NULL;
ALTER TABLE blocks ADD CONSTRAINT blocks_lifting_has_type
  CHECK (
    (block_category = 'lifting' AND block_type IS NOT NULL)
    OR (block_category != 'lifting' AND block_type IS NULL)
  );

-- Drop session_id from blocks (workout_blocks junction in migration 014 takes its place)
-- This DROP happens AFTER 014 backfills the junction, see 014 prelude.
-- Migration 013 ENDS here; 014 does the junction backfill + DROP COLUMN.

-- Unique block name per owner
CREATE UNIQUE INDEX idx_blocks_owner_name ON blocks (owner_user_id, block_name);

-- Indexes on renamed columns (preserve existing index names where possible)
-- (existing indexes auto-rename via column rename; add new ones if needed)
CREATE INDEX idx_blocks_owner_category ON blocks (owner_user_id, block_category);
```

### Migration 014 — workout_blocks junction

```sql
-- Junction table
CREATE TABLE workout_blocks (
  workout_id uuid NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES blocks(block_id) ON DELETE CASCADE,
  display_order integer NOT NULL,
  preset_activity_id uuid,
  preset_activity_type text CHECK (preset_activity_type IN ('cardio', 'recovery')),
  PRIMARY KEY (workout_id, block_id, display_order),
  CHECK (
    (preset_activity_id IS NULL AND preset_activity_type IS NULL)
    OR (preset_activity_id IS NOT NULL AND preset_activity_type IS NOT NULL)
  )
);
CREATE INDEX idx_workout_blocks_workout_order ON workout_blocks (workout_id, display_order);
CREATE INDEX idx_workout_blocks_block ON workout_blocks (block_id);

-- Backfill from existing blocks.session_id (set by Slice 2 seed)
INSERT INTO workout_blocks (workout_id, block_id, display_order, preset_activity_id, preset_activity_type)
SELECT
  b.session_id AS workout_id,         -- session_id was NOT renamed yet in blocks table; only on workouts
  b.block_id,
  b.display_order,
  NULL,                                -- preset_activity_id populated later by re-seed
  NULL
FROM blocks b
WHERE b.session_id IS NOT NULL;

-- Now drop the obsolete column
ALTER TABLE blocks DROP COLUMN session_id;
```

### Migration 015 — cardio + recovery catalogs and activity_completions

```sql
-- Cardio activities catalog (per user)
CREATE TABLE cardio_activities (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  cardio_format cardio_format_enum NOT NULL,
  cardio_distance text,
  cardio_target_zone cardio_target_zone_enum NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name)
);
CREATE INDEX idx_cardio_activities_owner ON cardio_activities (owner_user_id);
CREATE TRIGGER cardio_activities_set_updated_at
  BEFORE UPDATE ON cardio_activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Recovery activities catalog (per user)
CREATE TABLE recovery_activities (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name)
);
CREATE INDEX idx_recovery_activities_owner ON recovery_activities (owner_user_id);
CREATE TRIGGER recovery_activities_set_updated_at
  BEFORE UPDATE ON recovery_activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Block → cardio_activities junction
CREATE TABLE block_cardio_items (
  block_id uuid NOT NULL REFERENCES blocks(block_id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES cardio_activities(activity_id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (block_id, activity_id)
);
CREATE INDEX idx_block_cardio_items_block ON block_cardio_items (block_id, display_order);

-- Block → recovery_activities junction
CREATE TABLE block_recovery_items (
  block_id uuid NOT NULL REFERENCES blocks(block_id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES recovery_activities(activity_id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (block_id, activity_id)
);
CREATE INDEX idx_block_recovery_items_block ON block_recovery_items (block_id, display_order);

-- Activity completions (schema only in 7a; UI in 8.5/9)
CREATE TABLE activity_completions (
  completion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
  activity_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('cardio', 'recovery')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  duration_minutes integer,
  perceived_intensity text,
  notes text
);
CREATE INDEX idx_activity_completions_user_workout ON activity_completions (user_id, workout_id);
CREATE INDEX idx_activity_completions_user_started ON activity_completions (user_id, started_at DESC);

-- Foreign-key polymorphism note: activity_id has no DB-level FK. Application enforces
-- that activity_id references cardio_activities when activity_type='cardio' and
-- recovery_activities when activity_type='recovery'.
```

### Migration 016 — RLS for new tables

Standard 4-policy pattern (`select_own`, `insert_own`, `update_own`, `delete_own`) for direct user-scoped tables. FK-chain policies for tables without direct `user_id` (block_cardio_items, block_recovery_items, workout_blocks). Pattern follows Slice 2 migration 008.

```sql
-- Enable RLS on all new tables
ALTER TABLE cardio_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_cardio_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_recovery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_blocks       ENABLE ROW LEVEL SECURITY;

-- Direct user-scoped tables: 4-policy pattern
-- (cardio_activities, recovery_activities, activity_completions follow the standard pattern)

-- FK-chain policies for tables without direct user_id
-- workout_blocks: gate via workouts.schedule → daily_schedules.plan → training_plans.user_id
CREATE POLICY "select_own" ON workout_blocks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workouts w
    JOIN daily_schedules d ON d.schedule_id = w.schedule_id
    JOIN training_plans p ON p.plan_id = d.plan_id
    WHERE w.workout_id = workout_blocks.workout_id AND p.user_id = auth.uid()
  )
);
-- (insert/update/delete same pattern)

-- block_cardio_items + block_recovery_items: gate via blocks.owner_user_id
CREATE POLICY "select_own" ON block_cardio_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM blocks b
    WHERE b.block_id = block_cardio_items.block_id AND b.owner_user_id = auth.uid()
  )
);
-- (insert/update/delete same pattern)
```

(Codex generates the verbose policy SQL following the established pattern from migration 008.)

### Library data layer

```typescript
// src/lib/library/projections.ts

export type LiftingBlockSummary = {
  block_id: string;
  block_name: string;
  block_type: 'failure' | 'mobility' | 'corrective';
  exercise_count: number;
};

export type LiftingExerciseInBlock = {
  exercise_id: string;
  name: string;
  prescribed_min: number;
  prescribed_max: number;
  muscle_groups: string[];
  is_bodyweight: boolean;
  notes: string;
  display_order: number;
};

export type LiftingBlockDetail = {
  block_id: string;
  block_name: string;
  block_type: 'failure' | 'mobility' | 'corrective';
  exercises: LiftingExerciseInBlock[];
};

export type CardioActivity = {
  activity_id: string;
  name: string;
  cardio_format: 'speed_run' | 'endurance_run' | 'basketball';
  cardio_distance: string | null;
  cardio_target_zone: 'sprint' | 'zone_2' | 'anaerobic' | 'game_pace';
  description: string | null;
};

export type CardioBlockWithActivities = {
  block_id: string;
  block_name: string;
  activities: CardioActivity[];
};

export type RecoveryActivity = {
  activity_id: string;
  name: string;
  description: string | null;
};

export type RecoveryBlockWithActivities = {
  block_id: string;
  block_name: string;
  activities: RecoveryActivity[];
};
```

```typescript
// src/lib/library/queries.ts

export async function getLiftingBlocks(): Promise<LiftingBlockSummary[]>;
// SELECT b.block_id, b.block_name, b.block_type, COUNT(bli.exercise_id) AS exercise_count
// FROM blocks b LEFT JOIN block_lifting_items bli ON bli.block_id = b.block_id
// WHERE b.block_category = 'lifting'
// GROUP BY b.block_id, b.block_name, b.block_type
// ORDER BY b.block_name ASC
// (RLS scopes to user automatically)

export async function getBlockDetail(blockId: string): Promise<LiftingBlockDetail | null>;
// SELECT b.*, bli.display_order, e.exercise_id, e.name, e.prescribed_min, e.prescribed_max,
//        e.muscle_groups, e.is_bodyweight, e.notes
// FROM blocks b
// JOIN block_lifting_items bli ON bli.block_id = b.block_id
// JOIN exercises e ON e.exercise_id = bli.exercise_id
// WHERE b.block_id = $1 AND b.block_category = 'lifting'
// ORDER BY bli.display_order ASC

export async function getCardioBlock(): Promise<CardioBlockWithActivities | null>;
// Single user has at most one cardio block. Query returns the block + all its activities.
// SELECT b.block_id, b.block_name, ca.activity_id, ca.name, ca.cardio_format,
//        ca.cardio_distance, ca.cardio_target_zone, ca.description, bci.display_order
// FROM blocks b
// LEFT JOIN block_cardio_items bci ON bci.block_id = b.block_id
// LEFT JOIN cardio_activities ca ON ca.activity_id = bci.activity_id
// WHERE b.block_category = 'cardio'
// ORDER BY bci.display_order ASC
// Returns null if no cardio block exists for user.

export async function getRecoveryBlock(): Promise<RecoveryBlockWithActivities | null>;
// Same shape as getCardioBlock for the recovery block.
```

```typescript
// src/lib/library/crossLinks.ts

export function blockDetailHref(blockId: string): string;
// Returns `/library/lifting/blocks/${blockId}`

export function liftingHref(): string;
// Returns `/library/lifting`

export function cardioHref(): string;
// Returns `/library/cardio`

export function recoveryHref(): string;
// Returns `/library/recovery`
```

### Cross-link component

```typescript
// src/components/shared/BlockLink.tsx

type BlockLinkProps = {
  blockId: string;
  children: React.ReactNode;
  className?: string;
};
// Server Component. Wraps children in <Link> with href from blockDetailHref(blockId).
// Pattern matches Slice 6.1's ExerciseLink and SessionLink/WorkoutLink.
```

### Library tab routes

```typescript
// src/app/(app)/library/page.tsx
// Server Component. redirect('/library/lifting').

// src/app/(app)/library/lifting/page.tsx
export default async function LiftingLibraryPage(): Promise<JSX.Element>;
// Server Component. Calls getLiftingBlocks(). Renders <LibraryTabs activeTab="lifting" /> +
// list of <BlockListCard /> (one per LiftingBlockSummary, ordered by block_name).
// Empty state per AC #23.

// src/app/(app)/library/lifting/blocks/[block_id]/page.tsx
export default async function BlockDetailPage(props: {
  params: Promise<{ block_id: string }>;
}): Promise<JSX.Element>;
// Server Component. Validates block_id via getBlockDetail; if null → redirect to /library/lifting.
// Renders <BlockDetailHeader /> + <ExerciseListItem /> per exercise, ordered by display_order.

// src/app/(app)/library/cardio/page.tsx
export default async function CardioLibraryPage(): Promise<JSX.Element>;
// Server Component. Calls getCardioBlock(). Renders <LibraryTabs activeTab="cardio" /> +
// inline-expanded cardio block (header + list of <CardioActivityCard /> per activity, ordered by display_order).
// Empty states per AC #26 and #27.

// src/app/(app)/library/recovery/page.tsx
export default async function RecoveryLibraryPage(): Promise<JSX.Element>;
// Server Component. Calls getRecoveryBlock(). Renders <LibraryTabs activeTab="recovery" /> +
// inline-expanded recovery block (header + list of <RecoveryActivityCard /> per activity).
// Empty state per AC #30.
```

### LibraryTabs (the only Client Component in this slice)

```typescript
// src/app/(app)/library/_components/LibraryTabs.tsx

"use client";

type LibraryTabsProps = {
  activeTab: 'lifting' | 'cardio' | 'recovery';
};
// Renders shadcn <Tabs value={activeTab}> with three <TabsTrigger>s, each wrapped in a
// next/link to its category route. Tapping a trigger navigates via the link, which causes
// the active route to change, which in turn re-renders this component with the new activeTab
// prop derived from the new pathname (server-side).
//
// IMPORTANT: this is the ONLY Client Component in Slice 7a. Reason for client: shadcn Tabs
// primitive has interactive states (focus management, ARIA, keyboard navigation). The trigger
// state itself is derived from the URL — there is no client useState for the active tab.
```

### Bottom-nav update

```typescript
// src/components/layout/BottomTabBar.tsx (modified)

const tabs = [
  { href: '/today',     label: 'Today',     icon: Home },
  { href: '/plan',      label: 'Plan',      icon: Calendar },
  { href: '/library',   label: 'Library',   icon: Library },
  { href: '/history',   label: 'History',   icon: BarChart3 },
  { href: '/nutrition', label: 'Nutrition', icon: Apple },
  { href: '/settings',  label: 'Settings',  icon: Settings },
];
// Tab label className: 'text-[10px]' (was 'text-xs' = 12px in shadcn default; we used 11px in
// Slice 1; now 10px to fit 6 tabs at 375px viewport).
// Touch target preserved at 44px minimum.
// Active-tab match: usePathname().startsWith(tab.href).
```

### Seed parser update — high-level flow

```typescript
// supabase/seed/seed-from-wiki.ts (modified main flow)

async function main() {
  // 1-5. Same as before: env vars, read wiki files, identify user_id, parse plan, validate.
  //
  // NEW STEPS for Slice 7a schema:
  //
  // 6. Parse the per-day workout assemblies. Each day has zero or more workouts; each workout
  //    has a name, timing, gym, description, and an ordered list of blocks. For lifting workouts,
  //    blocks reference the global block catalog by name. For cardio/recovery workouts, the
  //    workout has exactly one block reference (the user's cardio/recovery block) plus a
  //    preset_activity_id pointing at the chosen activity.
  //
  // 7. Build the global lifting blocks catalog: deduplicate by (user_id, block_name). Each
  //    unique lifting block becomes one row in `blocks` with block_category='lifting'.
  //
  // 8. Build the cardio activities catalog: parse all distinct cardio sessions in the wiki
  //    (Speed Run, Endurance Run, Basketball) into rows in `cardio_activities`.
  //
  // 9. Build the recovery activities catalog: parse all distinct recovery activities (Hot Yoga,
  //    Sauna, etc., per the post-rewrite wiki) into rows in `recovery_activities`.
  //
  // 10. Create the user's cardio block (one row, block_category='cardio', name='Cardio'); wire
  //     it to all cardio activities via block_cardio_items.
  //
  // 11. Create the user's recovery block (one row, block_category='recovery', name='Recovery');
  //     wire it to all recovery activities via block_recovery_items.
  //
  // 12. Upsert workouts (formerly sessions): for each day's workout assembly, insert/update the
  //     workouts row.
  //
  // 13. Upsert workout_blocks: for each workout, write the ordered list of (block_id,
  //     display_order, preset_activity_id, preset_activity_type) rows. Lifting workouts get
  //     preset_activity_id = NULL; cardio/recovery workouts get preset_activity_id set to the
  //     specific activity scheduled for that day.
  //
  // 14-15. Same as before: nutrition_targets, plan_templates (now with the new snapshot shape),
  //        pr_history idempotency.
  //
  // 16. Print summary.
}
```

### Other touch points (rename adaptation only)

Every existing component referencing renamed columns/tables gets a mechanical column-name update. No behavior change. Files listed in Section 3.

## 5. Edge Cases to Handle

1. **Migration 013 backfill of `blocks.owner_user_id`** — non-issue post-Step-0 wipe. The `blocks` table is empty after Step 0, so the `ALTER TABLE ... ADD COLUMN owner_user_id` followed by `UPDATE blocks SET owner_user_id = ... ` runs against zero rows. The subsequent `SET NOT NULL` is a metadata-only operation on the empty column. The seed re-run (post-migration) populates `blocks` with `owner_user_id` set explicitly to Marcus's user_id per the global-catalog model. Originally this AC tracked the FK-chain backfill on the pre-existing 24 rows; that concern is moot under Option A.

2. **Wiki edits not applied before re-seed** — if Marcus runs `pnpm seed` after the migrations apply but BEFORE editing the wiki to enforce block-name uniqueness, the seed will fail on the `UNIQUE (owner_user_id, block_name)` constraint when trying to insert two distinct "Mid Chest" blocks. Seed script should fail loudly with a clear error pointing at the duplicate block_name. Recovery: edit wiki, re-run seed.

3. **In-flight queue rows in localStorage from before the rename** — when a user reopens the app post-deploy, their queue may have rows with `kind: 'session_completion_start'` (the old name). The queue layer's mount-time logic detects rows with old `kind` values and rewrites them to the new equivalents. Best-effort; the queue is small. Failure mode: if rewrite fails, surface a toast "Some pending sets need re-syncing" and let the user manually retry.

4. **In-progress workout_completion at migration time** — a workout_completion row with `completed_at IS NULL` exists across the migration. The migration renames the table + columns transparently; the in-progress completion survives. Logger resume on the renamed `/log/[workout_id]` route works because the URL param parser was updated.

5. **pr_history rows referencing old set_log_id columns** — pr_history is unchanged in this slice; set_logs.session_id renamed to workout_id but pr_history.set_log_id FK is to set_logs.set_log_id (the PK column unchanged). No FK breakage.

6. **Cardio activity uniqueness collision in the wiki** — if Marcus's wiki has multiple cardio sessions with the same name (e.g., two "Speed Run" entries), the seed parser's `UNIQUE (owner_user_id, name)` constraint on `cardio_activities` would fail on insert. Seed script aborts with a descriptive error. Mitigations: (a) wiki rewrite step lists distinct cardio activity names; (b) seed parser deduplicates by name before insert.

7. **Workout with zero blocks** — possible for a freshly-created workout in the future; not present in current seed. Library tab doesn't render workouts directly, so no rendering edge case here. Plan tab + Today tab handle "workout with no scheduled blocks" defensively (existing behavior; preserved through the rename).

8. **Library Lifting empty** — user has zero lifting blocks. Empty-state copy per AC #23. Show all toggle / drill-in disabled.

9. **Library Cardio block exists but zero activities** — empty-state copy per AC #26.

10. **Library Recovery block exists but zero activities** — empty-state copy per AC #30.

11. **Cardio block missing entirely** — defensive case (should not occur post-seed); empty-state per AC #27. No retry affordance in 7a; future support could add "Initialize cardio block" button in 7b.

12. **Block detail route hit with an invalid block_id** (typo, expired link, RLS blocks the row) — getBlockDetail returns null; route redirects to /library/lifting. No error page.

13. **Block detail route hit with a block_id whose category is not 'lifting'** — getBlockDetail validates `block_category = 'lifting'`; cardio/recovery blocks redirect to their respective sub-tabs.

14. **Long block names overflow on lifting list cards at 375px** — truncate with ellipsis. Touch target preserved.

15. **Bottom-nav 6-tab layout on viewports below 360px** — extreme narrow case. Labels at 10px should still fit. If a user device falls below this, layout may compress slightly but remains functional. No special handling.

16. **`pnpm seed` rerun after a wiki edit that adds a new lifting block** — the new block gets inserted with a fresh block_id; the global catalog grows by one. Existing workouts' workout_blocks references are unaffected.

17. **Cross-tab rename consistency** — if a component file references `session_id` somewhere not caught by the rename, runtime will fail with "column session_id does not exist." Quality review pass MUST grep for any lingering `session_id` / `session_name` / `session_completion` references and rewrite. Same for `block_exercises` (renamed to `block_lifting_items`).

18. **Schema rename atomicity** — migrations 013-016 must apply in order; if 013 succeeds but 014 fails, blocks lacks both the old `session_id` reference and the new `workout_blocks` linkage. Migrations are atomic per file but not across files. Mitigation: pre-deploy verification on a staging DB before applying to production.

19. **Existing pr_history overlap heuristic** — Slice 6.1's findMatchingCompletion logic (most-recently-started qualifying completion). Renames `session_completions` → `workout_completions`, `session_id` → `workout_id`. Logic unchanged. Test 6.1's hybrid PR-count query still works.

20. **Activity_completions referenced by future code paths** — table exists in 7a as schema-only. No reads, no writes. RLS in place. Future slices add UI; 7a's tests verify the table exists and is queryable.

## 6. Test Cases

Manual end-to-end tests after Codex generation + Claude Code quality review. Mix of pre-test setup (wiki edits + tab-close-mid-save verification), schema verification, regression on existing surfaces, and Library tab flows.

### Pre-test setup

T0a. **Wiki edits applied.** Open `supabase/seed/wiki/current-plan.md`. Rename one of the two "Mid Chest" blocks to "Bench Press Focus." Rename the second "Lateral Raise" in Push to "Shoulder Burnout." Replace per-day "Hot Yoga or Sauna" with explicit per-day choice. Verify no other duplicate `(owner_user_id, block_name)` collisions exist via grep.

T0b. **🟡 S4-M1 verification (carry-forward).** Run dev server. Open Logger on a real session. Start a set. Close the browser tab during the save. Reopen the app. Resume the session. Verify the lost set replays from the queue. Pass → close S4-M1 in 7a's post-slice sequence. Fail → scope a surgical fix as Slice 7a addendum.

### Schema and migration tests

T1. **Migrations 013-016 apply cleanly.** Run `supabase db push`. No errors. All 4 new migration files marked applied in `supabase_migrations.schema_migrations`. Migration 013's Step 0 wipe runs first; verify in Supabase Studio that `pr_history` retains exactly 3 rows (Slice 2's seeded historical PRs with `set_log_id IS NULL`); `set_logs`, `session_completions`, `block_exercises`, `blocks` tables are all empty post-Step-0 (or post-rename for the empty originals); `daily_schedules`, `training_plans`, `exercises`, `profiles` are unchanged. Migration 013's `CREATE UNIQUE INDEX idx_blocks_owner_name` commits without violation because the table is empty at that point.

T2. **Generated types reflect new schema.** Run `pnpm exec supabase gen types typescript --linked > src/lib/supabase/types.ts`. Verify Database type contains `workouts`, `workout_completions`, `cardio_activities`, `recovery_activities`, `block_cardio_items`, `block_recovery_items`, `activity_completions`, `workout_blocks`. No reference to `sessions` or `block_exercises` types remains.

T3. **`pnpm seed` populates new schema.** Run after T0a wiki edits + migrations applied. Verify in Supabase Studio:
- 1 row in `training_plans`, 7 in `daily_schedules`, ~12 in `workouts` (renamed sessions), ~15-22 in `blocks` (deduplicated lifting + 1 cardio + 1 recovery)
- `workout_blocks` rows = sum across workouts of their block lists
- `cardio_activities` ≈ 3 rows (Speed Run, Endurance Run, Basketball)
- `recovery_activities` ≈ 2 rows (Hot Yoga, Sauna)
- `block_cardio_items` ≈ 3 rows; `block_recovery_items` ≈ 2 rows
- `block_lifting_items` (renamed) preserves the bank assignments per lifting block

T4. **Idempotency.** Re-run `pnpm seed`. Reports zero changes. No duplicates introduced.

T5. **Block-name uniqueness enforced.** Manually attempt `INSERT INTO blocks (...) VALUES (..., 'Mid Chest', ...)` for the same user. UNIQUE constraint rejects with 23505.

### Regression tests on existing surfaces

T6. **Today tab renders.** Sign in. Navigate to /today. Today's workouts (renamed) display correctly. Lifting workouts have Start Workout buttons that navigate to `/log/[workout_id]`. Cardio/recovery workouts render preset activity name from preset_activity_id (e.g., Monday AM shows "Speed Run" because preset_activity_id resolves to the Speed Run cardio_activities row).

T7. **Plan tab renders.** Navigate to /plan. Day cards render. Tap any day → /plan/[day]. Workout details show correctly (lifting workouts show their block list via `workout_blocks` JOIN; cardio/recovery workouts show their preset activity).

T8. **History tab renders.** Navigate to /history. PR Timeline rows render (Cable Lat Pulldown · Pull · May 1, ATG Split Squat · Lower ATG · May 2, etc.). Tap "All Sessions" header link → /history/workouts (renamed route). All Workouts list renders.

T9. **Logger renders.** Tap Start Workout on a today's lifting workout. /log/[workout_id] loads. Block-by-block walkthrough works. Set save inserts to `set_logs` with renamed `workout_id` column. PR detection still fires.

T10. **Nutrition + Settings tabs render unchanged.** Navigate to /nutrition and /settings; placeholders still render correctly.

### Bottom-nav tests

T11. **6-tab layout.** Inspect bottom nav. 6 tabs in order Today / Plan / Library / History / Nutrition / Settings. Tab labels at 10px. Touch targets 44px+ each. No truncation at 375px viewport. Library icon (`Library` from lucide-react) renders.

T12. **Active-tab match.** Navigate to /library/lifting/blocks/[some_block_id]. Library tab is highlighted in lilac. Navigate to /history. History tab highlights, Library de-highlights.

### Library — Lifting sub-tab tests

T13. **Lifting list renders.** Navigate to /library/lifting. Sub-tab strip shows three triggers (Lifting / Cardio / Recovery) with Lifting active. Block list shows ~15-22 lifting blocks ordered alphabetically by name. Each card: block name + block_type badge + exercise count caption.

T14. **Drill into block detail.** Tap any block card. Navigates to /library/lifting/blocks/[block_id]. Block detail page shows block name + type badge + exercise list with prescribed range, muscle group caption, bodyweight tag (if applicable), notes (if any). Order matches `display_order`.

T15. **Back to library.** Tap the back link. Returns to /library/lifting.

T16. **Block detail invalid id.** Navigate to /library/lifting/blocks/00000000-0000-0000-0000-000000000000 directly. Redirects to /library/lifting. No error page.

T17. **Block detail wrong category.** Navigate to /library/lifting/blocks/[cardio_block_id] directly (using the user's cardio block_id). Redirects to /library/lifting (block_category != 'lifting' check fires).

### Library — Cardio sub-tab tests

T18. **Cardio sub-tab renders.** Navigate to /library/cardio (or tap the Cardio sub-tab from /library/lifting). LibraryTabs shows Cardio active. Block name "Cardio" shows in the header. Activity list shows ~3 cardio activities (Speed Run, Endurance Run, Basketball) each with format badge, distance, target zone.

T19. **Cardio empty state.** SQL: `DELETE FROM block_cardio_items WHERE block_id = (SELECT block_id FROM blocks WHERE block_category = 'cardio' AND owner_user_id = '<marcus_user_id>')`. Reload /library/cardio. Empty state "No cardio activities yet." renders. (Restore via re-seed after the test.)

### Library — Recovery sub-tab tests

T20. **Recovery sub-tab renders.** Navigate to /library/recovery. LibraryTabs shows Recovery active. Block name "Recovery" shows in the header. Activity list shows ~2 recovery activities (Hot Yoga, Sauna) each with name + description.

T21. **Recovery empty state.** Similar to T19 with `block_recovery_items`.

### Library — sub-tab navigation

T22. **Sub-tab switch via tap.** From /library/lifting, tap Cardio sub-tab trigger. URL changes to /library/cardio. Cardio activities render.

T23. **Sub-tab switch via URL.** From /library/lifting, navigate the address bar to /library/recovery. Recovery sub-tab loads. LibraryTabs shows Recovery active.

T24. **Direct landing on /library.** Navigate to /library (no sub-segment). Redirects to /library/lifting.

### Cross-link contract enforcement

T25. **`grep` check.** Search for `next/link` imports under `src/app/(app)/library` and `src/components/shared/BlockLink.tsx`. Only allowed locations: BlockLink, LibraryTabs, future cross-link wrappers. No direct `next/link` in BlockListCard, ExerciseListItem, CardioActivityCard, RecoveryActivityCard, BlockDetailHeader.

T26. **Hardcoded path search.** Search for `/library/lifting/blocks/` outside `src/lib/library/crossLinks.ts` and BlockLink.tsx. Should return zero matches.

### Slice 6.1 empty-state e2e (carry-forward)

T27. **PR Timeline windowed-empty.** SQL: backdate the four populated PRs to 100 days ago (set achieved_at = now() - interval '100 days'). Reload /history. Empty state "No PRs in the last 90 days. Tap Show all..." renders. Show all toggle visible. Tap Show all → all 4 PRs render. Restore via re-seed after the test.

T28. **PR Timeline all-history empty.** SQL: temporarily delete all `pr_history` rows. Reload /history. "No PRs yet." renders. Tap Show all → still "No PRs yet." (with the alternate toggle label). Restore via re-seed.

T29. **All Sessions empty.** SQL: temporarily delete all `workout_completions` rows. Reload /history/workouts. "No completed sessions yet." renders. Restore via re-seed.

(Aggressive restoration via `pnpm seed` after each — the seed reseeds the 3 historical PRs but no logged sets/completions, so the user re-logs after the test.)

### Code quality gates

T30. **`pnpm lint`** ✓ on the post-rename codebase. No errors.

T31. **`pnpm typecheck`** ✓. No errors. Type imports updated for all renamed identifiers.

T32. **`pnpm format:check`** ✓.

T33. **`pnpm-lock.yaml`** committed. shadcn Tabs primitive added; lockfile reflects the new transitive dep.

## 7. Codex Generation Prompt (Phase 4A)

```
CONTEXT:
Slice 7a of training-app — Library tab read scaffold + major schema rename.
Stack: Next.js 15 App Router with React 19, TypeScript strict, Tailwind +
shadcn/ui, Supabase (existing instance with RLS enforced), pnpm + Node 20 LTS.
Substantial schema migration: 4 new migration files (013-016). Major rename
of sessions→workouts cascade-affecting many components/queries. Library tab
ships as 6th bottom-nav tab with three sub-tabs (Lifting / Cardio / Recovery)
URL-segment routed; read-only browse + drill-into-block-detail (lifting only).

The full spec is in spec/slices/SLICE_7A_LIBRARY_READ.md. The spec docs in
spec/ (PROJECT_BRIEF.md, MASTER_SPEC.md, ARCHITECTURE.md) are the project
constitution. AGENTS.md at the root contains the rules for this build.
CLAUDE.md governs the post-generation review pass. DECISIONS.md has the locked
project decisions. KNOWN_ISSUES.md tracks live KIs. Read all of these before
generating.

TASK:
Implement everything in Sections 3 and 4 of SLICE_7A_LIBRARY_READ.md:

1. Migrations 013-016 (workouts rename + blocks global, workout_blocks
   junction, cardio/recovery catalogs, RLS extensions).
2. Seed parser rewrite for new schema (supabase/seed/seed-from-wiki.ts +
   methodology-rules.ts + types.ts).
3. Library data layer (src/lib/library/queries.ts, projections.ts,
   crossLinks.ts, displayName.ts).
4. Library routes (/library, /library/lifting, /library/lifting/blocks/[id],
   /library/cardio, /library/recovery).
5. Library components (LibraryTabs, BlockListCard, BlockDetailHeader,
   ExerciseListItem, CardioActivityCard, RecoveryActivityCard, badges, EmptyState).
6. Cross-link component: src/components/shared/BlockLink.tsx.
7. shadcn Tabs primitive (pnpm dlx shadcn add tabs).
8. Bottom-nav update: BottomTabBar with 6 tabs in order Today / Plan / Library
   / History / Nutrition / Settings, labels at 10px.
9. Mechanical column-name updates across Today / Plan / History / Logger / Sync
   layer / auth signOut: every reference to session_id, session_name,
   session_type, session_completion, session_completions, block_exercises gets
   the corresponding rename.

CONSTRAINTS:

- Migration immutability: zero edits to migrations 001-012. New work in 013-016.
- Migration 013 MUST open with the Step 0 test-data wipe block (verbatim from §4) — `DELETE FROM pr_history WHERE set_log_id IS NOT NULL; DELETE FROM set_logs; DELETE FROM session_completions; DELETE FROM block_exercises; DELETE FROM blocks;` — BEFORE any ALTER TABLE / RENAME / CREATE statements. The `UNIQUE (owner_user_id, block_name)` constraint creation later in the migration depends on the table being empty at that point. Do NOT skip Step 0, do NOT reorder it after the schema-change steps, do NOT replace it with a "more thorough" wipe that touches `daily_schedules`, `training_plans`, `exercises`, or `profiles` — those tables are explicitly preserved.
- TypeScript strict mode. No any. No widening casts.
- Module boundaries: src/lib/library/ is pure (no React, no Supabase client
  imports beyond the server client); src/components/library/ is React-only;
  src/app/(app)/library/ is route-level data fetching.
- The shadcn Tabs primitive is the only new dep beyond what's already installed.
- 6 bottom-nav tabs at 10px label size; touch targets stay 44px+.
- Library is fully read-only — no edit/add/delete affordances anywhere.
- LibraryTabs is the only Client Component in the slice (driven by URL pathname,
  no useState). All other components Server.
- Cross-link contract: every navigation to /library/lifting/blocks/[id] goes
  through <BlockLink>; never direct <Link>. BlockLink may be used by future
  slices and other surfaces (Plan Editor in Slice 8 will use it).
- The wiki edits Marcus performs in supabase/seed/wiki/current-plan.md are
  NOT part of code generation. They're pre-test setup. Codex does NOT modify
  the wiki files.
- Seed script aborts loudly if the post-edit wiki has duplicate (owner_user_id,
  block_name) collisions; the error message lists the colliding names so Marcus
  can fix in the wiki.

LIVE SCHEMA POST-MIGRATION (use exact column names — do NOT invent):

[Full schema dump from Section 4 here, including all 4 new migrations'
CREATE TABLE statements, the rename DDL, and the FK chain.]

ACCEPTANCE CRITERIA:
See SLICE_7A_LIBRARY_READ.md Section 2 — all 54 criteria.

DO NOT:

- Add files outside Section 3
- Build any feature beyond what's specified in Sections 4-6
- Add edit/add/delete affordances to Library — read-only browse only
- Add Recharts, react-hook-form, zod, or any new dependency beyond shadcn Tabs
- Use the service role key anywhere outside supabase/seed/
- Leave placeholder TODOs or stubbed functions
- Use polymorphic FKs at the DB level beyond the documented exception
  (workout_blocks.preset_activity_id which has no DB FK)
- Skip the rename cascade — every old reference in src/ and supabase/migrations
  must be updated
- Modify the wiki content files in supabase/seed/wiki/

OUTPUT:
Write the complete implementation. Do not explain — just produce the code. At
the end, list:

- Every column name referenced (so I can diff against the live schema)
- Every env var used
- Every Supabase RLS policy created (count by table)
- Every assumption made that was not explicit in the prompt
- Every wiki file path read by the parser
- Confirmation that all 54 acceptance criteria are addressable in the produced
  code (mark any AC you couldn't address and why)
- Files created or modified vs. Section 3's allowlist (any deviations)
- Validation warnings encountered during a test seed run (soft-rule warnings)
```

## 8. Claude Code Quality Review Prompt (Phase 4B — MANDATORY after Codex)

```
CONTEXT:
Slice 7a of training-app — Library tab read scaffold + major schema rename.
Codex just generated migrations 013-016, the seed parser rewrite for the new
schema, the Library tab routes/components, and the mechanical rename adaptation
across Today / Plan / History / Logger / Sync layer. This is the largest
schema-touching slice since Slice 4.

Spec sources:

- spec/slices/SLICE_7A_LIBRARY_READ.md (this slice doc)
- DECISIONS.md (locked decisions; Slice 7a entries to be added in post-slice
  sequence)
- spec/MASTER_SPEC.md and spec/ARCHITECTURE.md (Phase 1 follow-up writes for
  Library tab sections drafted in chat alongside this slice)

FILES CODEX TOUCHED (read every one):

[Full file list from Section 3, including the rename adaptation files across
Today / Plan / History / Logger / Sync.]

REVIEW CHECKLIST:

1. Schema fidelity (HEAVIEST CHECK)

   - Migration 013 SQL matches Section 4 exactly. Backfill JOINs reach
     user_id for every existing block before SET NOT NULL fires.
   - Migration 014 backfills workout_blocks BEFORE dropping blocks.session_id;
     order matters.
   - Migration 015 creates 5 new tables + indexes per Section 4.
   - Migration 016 has 4-policy pattern on direct user-scoped tables and
     FK-chain policies on workout_blocks, block_cardio_items,
     block_recovery_items.
   - block_category_enum has exactly the three values 'lifting', 'cardio',
     'recovery'.
   - The blocks_lifting_has_type CHECK constraint is in place.
   - UNIQUE (owner_user_id, block_name) on blocks.
   - workout_blocks PK is (workout_id, block_id, display_order).
   - workout_blocks has the preset_activity_id + preset_activity_type pair
     CHECK constraint.

2. Migration immutability

   - Zero edits to migrations 001-012. ALL new work in 013-016.
   - block_exercises rename (to block_lifting_items) happens via ALTER TABLE,
     not a recreate + drop pattern.
   - sessions rename (to workouts) happens via ALTER TABLE, not via DROP +
     CREATE.

3. Rename cascade completeness

   - Search the entire src/ tree for: session_id, session_name, session_type,
     session_completion, session_completions, block_exercises (as table
     name; the column rename is OK in JOINs that reference the old
     temporarily). Every match should be in a code-comment, a string-literal
     for migration history, or a deliberately-preserved reference to the
     legacy queue kind. No production code references the old names.
   - Same grep on supabase/seed/. Seed parser uses new names.
   - Page routes that referenced [session_id] now use [workout_id]; the
     directory rename happened cleanly.

4. Library data layer

   - getLiftingBlocks, getBlockDetail, getCardioBlock, getRecoveryBlock all
     use the existing Supabase server client (createClient from
     @/lib/supabase/server). Not the browser client.
   - RLS handles user_id filtering — no explicit .eq("owner_user_id", ...)
     filter (would be redundant and error-prone).
   - Type imports use the regenerated Database type from
     src/lib/supabase/types.ts.

5. Library routes

   - /library/page.tsx: server-side redirect via redirect() from
     next/navigation, NOT a Client Component with useEffect.
   - All sub-tab pages are Server Components.
   - Block detail page validates block_id via getBlockDetail; null result
     redirects to /library/lifting (no error page).
   - Block detail page validates block_category = 'lifting' (cardio/recovery
     blocks redirect to their respective sub-tabs, not error).

6. Components

   - LibraryTabs is the ONLY 'use client' component. shadcn Tabs primitive
     is wrapped; active tab derived from usePathname() (no useState).
   - BlockListCard, ExerciseListItem, CardioActivityCard, RecoveryActivityCard
     are all Server Components.
   - BlockLink wraps next/link (this is allowed; matches Slice 6.1 pattern).
   - No direct next/link import in any list/card component for navigation
     to /library/lifting/blocks/[id].

7. Bottom-nav

   - BottomTabBar tabs array has 6 entries in the correct order.
   - Tab labels use text-[10px] (or equivalent at 10px).
   - Touch targets remain 44px+ (verify the wrapper class min-h-11 is
     preserved).
   - usePathname startsWith match still picks the right active tab.

8. Cross-link contract

   - Same enforcement as Slice 6.1. crossLinks.ts is the single source for
     /library/lifting/blocks/[id] URLs. BlockLink consumes it.
   - Search every component file for direct next/link import that targets
     /library/lifting/blocks/. Should find zero outside BlockLink itself.

9. Empty states

   - AC #23 (lifting empty): "No lifting blocks yet."
   - AC #26 (cardio empty): "No cardio activities yet."
   - AC #27 (cardio block missing): "Cardio block not configured."
   - AC #30 (recovery empty): "No recovery activities yet."
   - Wording matches AC verbatim or close paraphrase.

10. Seed parser

    - parsePlanFromWiki returns the new TrainingPlanSpec shape: global
      blocks catalog + workout_blocks junctions + activity catalogs.
    - Seed aborts on duplicate (owner_user_id, block_name) collision; error
      message lists the duplicates.
    - Seed populates cardio_activities + block_cardio_items + the user's
      Cardio block consistently (one cardio block; all activities wired).
    - Same for recovery.
    - workout_blocks.preset_activity_id NOT NULL for cardio/recovery
      workouts; NULL for lifting workouts.

11. Slice 6.1 KI closures and FUTURE_WORK actions

    - 🟡 S4-M1 verification: was the deliberate tab-close-mid-save test
      run during pre-test setup? If yes, was the result documented? If
      verified, propose closing the KI in the post-slice sequence.
    - Slice 6.1's empty-state e2e verification: were T27, T28, T29 run?
      If yes, propose closing the FUTURE_WORK entry in the post-slice
      sequence.

12. Module boundaries

    - src/lib/library/ has zero React imports. Pure server-side data layer.
    - src/components/ no Supabase client construction (uses passed props
      / server-fetched data only).
    - src/lib/methodology/ unchanged.

13. Strict TypeScript

    - tsconfig strict preserved.
    - No any. No widening casts.
    - Component props typed.
    - Database insert/update types use TablesInsert / TablesUpdate from the
      regenerated types.

14. Performance

    - getLiftingBlocks is one query (with COUNT subquery for exercise_count).
      Not N+1.
    - getBlockDetail is one query with JOINs.
    - getCardioBlock, getRecoveryBlock are each one query.
    - Library list pages don't make extra round-trips per row.

15. Phase A surfaced findings to investigate (none yet from this slice's
    Phase A — Phase A is yet to run).

AUTO-FIX vs FLAG:

Auto-fix (apply directly):
- Naming inconsistencies (rename to match contract)
- Missing error handling on queries
- Removed dead code, unused imports
- Replaced direct next/link with BlockLink where AC #36 requires
- Removed leftover TODOs
- Schema drift on column names
- Removed 'use client' from Server Components that don't need it
- Lingering `session_*` references in renamed code paths

Flag for approval (do not change without my response):
- Structural changes that affect more than this slice's allowlist
- Refactors that alter the API contract or folder structure
- Subjective styling preferences when the existing code is acceptable
- Adding new dependencies for any reason beyond shadcn Tabs
- Changes to spec docs

CONSTRAINTS:

- Do not add features beyond the 54 ACs
- Do not change the folder structure from ARCHITECTURE
- Do not modify files outside the slice's allowlist
- Minimal, surgical changes

OUTPUT:
Summary with four parts:

1. Files changed and why (one line each)
2. Items flagged for my approval with reasoning
3. Any issues to log in KNOWN_ISSUES.md or FUTURE_WORK.md
4. Ready-for-testing verdict (yes / no — if no, what's blocking)

Specific findings I want surfaced if present:

- Did Codex correctly handle the migration 013 backfill ordering (set
  owner_user_id before NOT NULL; populate workout_blocks before dropping
  blocks.session_id)?
- Did the rename cascade catch every session_* reference, or are there
  lingering ones?
- Did the seed parser correctly produce one Cardio block + one Recovery
  block per user, with all activities wired?
- Are workout_blocks.preset_activity_id + preset_activity_type populated
  consistently for cardio/recovery workouts?
- Is the Library is read-only (zero edit/add/delete affordances)?
- Did Codex use the correct Supabase server client for all queries?
```

## 9. Claude Code Debugging Prompt (Phase 4C — fill in CURRENT PROBLEM if tests fail)

```
CONTEXT:
Slice 7a of training-app — Library tab read scaffold + schema rename. Codex
generated, Claude Code quality review pass complete. Tests in Section 6 of
SLICE_7A_LIBRARY_READ.md are now being run.

CURRENT PROBLEM:
[Fill in: exact error message, screenshot transcription, or description of
which test is failing. Be specific — include the test number, browser console
output, server logs, and the exact URL / action involved.]

RELEVANT FILES:
[Default starting points for common failures:

- Migration apply failure → supabase/migrations/<file>.sql
- Seed failure → supabase/seed/seed-from-wiki.ts + methodology-rules.ts
- Today/Plan/Logger regression → check the rename adaptation in the
  affected component
- Library list/detail render failure → src/lib/library/queries.ts,
  src/app/(app)/library/<route>/page.tsx
- Cross-link contract violation → src/components/shared/BlockLink.tsx,
  the offending list component
- workout_blocks junction inconsistency → migration 014 backfill or seed
  parser
- Bottom-nav layout broken at 375px → BottomTabBar.tsx label sizing]

WHAT THE CODE CURRENTLY DOES:
[Brief summary — what's working, what's broken, structural choices to
preserve.]

CONSTRAINTS:

- Migration immutability: do NOT edit migrations 001-012. Do NOT edit
  013-016 unless the problem is a literal SQL syntax error on first apply
  (after first remote apply, even 013-016 are immutable — fix forward
  with new migrations).
- Schema rename atomicity: don't half-revert the sessions→workouts rename.
  Either complete the cascade or revert the entire migration.
- Library is read-only — no edit/add/delete affordances introduced as part
  of debugging.
- Module boundaries preserved.
- LibraryTabs stays the only Client Component.

ACCEPTANCE CRITERIA:
[Reference the failing AC by number from Section 2.]

DO NOT:

- Rewrite working files
- Add features outside the current fix
- Change the folder structure
- Generate a new slice from scratch — if that's needed, stop and tell me to
  take it to Codex first
- Bypass cross-link contracts
- Modify wiki content files in supabase/seed/wiki/

OUTPUT:
Fix the problem. Summarize what was changed, why, and list any follow-up
issues for the next session. If the fix surfaces a deeper architectural
issue or contradicts a Phase 0/1 decision, flag it before applying — do
not silently rewrite the spec.
```
