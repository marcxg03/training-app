# SLICE_7B_LIBRARY_EDIT.md

> Slice 7b of 10 (paired with Slice 7a — read scaffold)
> Phase 4 — feature slice, schema-light (one new migration), form-library-introducing
> Spec source: this slice doc plus MASTER_SPEC §13 + ARCHITECTURE §17 (referenced from 7a; Library editing layered on top)
> Phase 0 decisions (locked in chat 2026-05-04): plan_templates decoupled from Library edits (Option A); RHF + zod + shadcn Form primitive installed; Delete deferred to a future slice; seeded rows fully editable (wiki bootstrap-only after first seed); pick-or-create-inline picker UX; per-block-exercise fields limited to `display_order` (corrected from initial Q5b lockdown — prescribed range and notes are exercise-global per schema); four-sub-tab IA (Lifting / Exercises / Cardio / Recovery) with full-page block edit + Sheet modal for the others; `block_category` immutable, `block_type` editable with historical-set-log warning; UNIQUE additions on `cardio_activities` + `recovery_activities`; UI-layer uniqueness via zod async refine; Library writes do NOT use Slice 5 sync queue.

## 1. Goal

Promote the Library tab from read-only browse (Slice 7a) to a full editing surface. Adds Create + Update affordances to all four catalog surfaces — lifting blocks, exercises, cardio activities, recovery activities — and introduces an Exercises sub-tab as the fourth Library section. Installs `react-hook-form` + `zod` + `@hookform/resolvers` plus the shadcn `Form` and `Sheet` primitives as the project's form library, executing the deferred adoption decision from Slice 1 DECISIONS.md (single-field-form carve-out) and Slice 4 DECISIONS.md (form library deferred to Slice 7-8 evaluation point). Adds one new migration (017) that defensively guarantees `UNIQUE (owner_user_id, name)` on `cardio_activities` and `recovery_activities` and verifies `(block_id, exercise_id)` uniqueness on `block_lifting_items`. Delete is deferred to a future slice. `plan_templates` is decoupled from Library edits — catalog tables become live state; templates remain seed-pipeline output (Phase 0 lockdown 1).

### Phase 0 lockdowns echoed for fast spec-author reference

1. **`plan_templates` decoupled from Library edits.** Catalog tables (`blocks`, `exercises`, `cardio_activities`, `recovery_activities`) are user-owned live state. Library mutations DO NOT increment `plan_templates.version`. Subscribers (Phase 4) reference frozen template snapshots; Marcus's daily catalog edits stay in his catalog only.
2. **Form library: react-hook-form + zod + shadcn Form.** Adoption trigger event reached. Zod schemas describe form input shape; map to/from generated Supabase types at submit boundary. Per AGENTS.md rule 8 ("multi-field forms use react-hook-form + zod") this is alignment, not deviation.
3. **Delete deferred.** 7b ships Create + Update only across all four surfaces. FUTURE_WORK entry (added in 7b's post-slice sequence) preserves the in-use-guard design question for the slice that adds Delete.
4. **Seeded rows fully editable; wiki is bootstrap-only after first seed.** Library edits are authoritative day-to-day. The seed pipeline is bootstrap; re-running it after Library edits creates duplicates by design and is a power-user action. Spec documents this expectation explicitly so Codex doesn't generate "reconcile against wiki" logic.
5. **Block bank UX: pick-or-create-inline.** "Add exercise" picker has a "+ Create new exercise" affordance opening an Exercise create modal; on submit, returns to block edit context with the new exercise pre-selected. Reorder via move-up / move-down buttons (no drag-drop).
6. **Library IA: four sub-tabs (Lifting / Exercises / Cardio / Recovery).** Full-page edit for blocks (`/library/lifting/blocks/[id]/edit` and `/library/lifting/blocks/new`); shadcn `Sheet` modal edit for exercises, cardio activities, recovery activities. Detail-page Edit button on blocks; per-row pencil icon on exercises, cardio activities, recovery activities.
7. **Mutability:** `block_category` immutable post-creation (form omits the Select at edit time). `block_type` editable on lifting blocks with informative warning if any `set_logs` reference the block. Cardio `format` mutable without warning. Recovery has no category-equivalent.
8. **Uniqueness validation.** Migration 017 adds `UNIQUE (owner_user_id, name)` on `cardio_activities` and `recovery_activities` if missing; verifies `(block_id, exercise_id)` UNIQUE on `block_lifting_items`. UI-layer async uniqueness via zod `.refine()` query (excludes own-row id on edit). DB constraint is final guard; 23505 surfaces as friendly "Name already exists."
9. **No Slice 5 queue integration for Library writes.** Direct supabase browser-client mutations with pessimistic-then-update pattern. Inline "Save failed — retry" on network failure.

### Phase 0 correction — Q5b premise was wrong

Q5b initially locked "per-block-exercise fields (range, notes) edited inline in the block form, separate from the exercise's canonical fields." Schema verification (MASTER_SPEC §6, Slice 7a Section 4 contracts) found `prescribed_min`, `prescribed_max`, `muscle_groups`, `is_bodyweight`, and `notes` all live on `exercises` (exercise-global). `block_lifting_items` carries only `(block_id, exercise_id, display_order)`. Corrected: block bank composition is reorder-only. All exercise fields edit in the Exercises sub-tab. One edit to an exercise's `notes` propagates to every block referencing the exercise — methodologically correct per the existing schema (a Squat is a Squat regardless of which block it appears in). Section 4 contracts and Section 5 Edge Case 17 reflect this.

## 2. Acceptance Criteria

### Schema and migration

1. New migration `017_library_edit_uniqueness.sql` applies cleanly. Adds `UNIQUE (owner_user_id, name)` to `cardio_activities` and `recovery_activities` if not already present (idempotent via `CREATE UNIQUE INDEX IF NOT EXISTS`). Verifies (or adds) `(block_id, exercise_id)` UNIQUE on `block_lifting_items`. No other schema changes.
2. Migration immutability: zero edits to migrations 001-016.
3. Generated TS types in `src/lib/supabase/types.ts` regenerated after 017 applies via `pnpm exec supabase gen types typescript --linked`. Constraints don't appear in TS types — the regen is a discipline check, not a structural change.

### Dependencies and primitives

4. New dependencies installed: `react-hook-form`, `zod`, `@hookform/resolvers`. Versions pinned in `package.json` to latest stable that supports React 19. Lockfile committed.
5. New shadcn primitives installed under `src/components/ui/`: `form`, `sheet`, `input`, `textarea`, `select`, `checkbox`, `label`, `popover`, `command`. Each via `pnpm dlx shadcn add <name>`. Codex does not skip the install step; quality review verifies presence of each primitive file.
6. No other new dependencies. No drag-drop library, no date-handling library beyond what's installed, no state-management library, no icon library beyond `lucide-react`.

### Library IA — fourth sub-tab (Exercises)

7. `LibraryTabs` updated: 4 sub-tabs in order **Lifting / Exercises / Cardio / Recovery**. Existing shadcn `Tabs` primitive (installed in 7a) drives the navigation strip; active tab derived from `usePathname()` (no client state).
8. Sub-tab labels: `"Lifting"`, `"Exercises"`, `"Cardio"`, `"Recovery"`. At 375px viewport, four labels at the existing 12px (shadcn `text-xs` default) sub-tab type fit cleanly. If they don't, fall back to `text-[10px]` across all four labels (not selectively). Codex verifies fit at the standard viewport before locking type size.
9. `/library` redirects to `/library/lifting` (unchanged from 7a).
10. New route `/library/exercises` renders the Exercises sub-tab as a Server Component. Lists all of the current user's exercises (`exercises WHERE user_id = auth.uid()`) ordered by `name ASC`. Each row renders as an `ExerciseListCard` showing name, primary muscle-group caption, prescribed range (e.g., `"6–8 reps"`), bodyweight tag (if `is_bodyweight = true`), and a per-row pencil icon (the edit affordance).
11. Empty state if user has zero exercises: `"No exercises yet."` with an "Add exercise" CTA (mirrors the AddBlockButton pattern).

### Lifting sub-tab — Create + Update affordances on blocks

12. `/library/lifting` (existing from 7a) gains an "Add lifting block" CTA at the top of the block list. Tapping the CTA navigates to `/library/lifting/blocks/new`.
13. `/library/lifting/blocks/[block_id]` (existing block detail page) gains an "Edit" button in the header. Tapping Edit navigates to `/library/lifting/blocks/[block_id]/edit`.
14. `/library/lifting/blocks/new` is a Server Component shell that renders `BlockForm` in create mode. The form is a Client Component (RHF wraps).
15. `/library/lifting/blocks/[block_id]/edit` is a Server Component shell that fetches the existing block + its bank + `historical_set_log_count`, renders `BlockForm` in edit mode with pre-filled values.
16. `BlockForm` fields: `block_name` (required, validated unique per owner), `block_type` (Select: failure / mobility / corrective — required, NO default value; placeholder copy `"Pick a protocol"`), bank composition (see AC #17-21). The form is for **lifting blocks only** — `block_category` is implicit from the route path (`/library/lifting/blocks/new` and `/library/lifting/blocks/[id]/edit` both live under `/lifting/`) and is NOT a form field in either mode. Cardio + recovery blocks remain seeded one-per-user from 7a and have no create or edit affordance in 7b. The form's `onSubmit` always sends `block_category: "lifting"` to `createBlock` (the mutation helper still accepts the field for type completeness; it's hardcoded by the form, not user-input). Submit copy: `"Create block"` (create) / `"Save changes"` (edit).
17. Bank composition section renders below the block fields. Always visible (the form is lifting-only).
18. Bank composition shows the current bank as a list of rows, each row displays exercise name + reorder controls (↑ + ↓) + a remove button. Removing an exercise from the bank deletes the corresponding `block_lifting_items` row on submit (not before — bank changes commit only with the form save).
19. "Add exercise to bank" button below the bank list opens an exercise picker (Sheet modal). Picker shows a searchable list of all the user's exercises (excluding those already in the bank). Top of picker: "+ Create new exercise" affordance.
20. "+ Create new exercise" opens a nested `ExerciseEditSheet` in create mode. On submit, the exercise is created via direct supabase write; the picker's exercise list refreshes; the newly-created exercise is auto-selected; both Sheets close, returning to the block edit form with the new exercise inserted at the bottom of the bank.
21. Reorder controls: tapping ↑ on a row swaps its `display_order` with the row above; tapping ↓ swaps with the row below. First row's ↑ disabled; last row's ↓ disabled. Order changes are pending until form submit (operates on form's local field-array state, not against the DB).
22. `block_type` warning: if user is in Edit mode and the block has any `set_logs` referencing it, the form displays informative copy below the `block_type` Select: `"[N] historical sets were logged under [old_type] protocol. Changing this affects future logs only."` where N is the count and `[old_type]` is the originally-saved value. Warning fires only when `currentType !== originalType` — hidden on initial load and hidden if the user reverts the Select. The warning is informative, not a guard — submit is always allowed.
23. `block_category` is implicit from route, not a form field. Per AC #16's revision, the BlockForm is lifting-only; `block_category` is derived from the URL (`/library/lifting/...`) and never rendered as a form input. In Edit mode, a static "Lifting block" label renders for context. Schema CHECK constraint `blocks_lifting_has_type` (from migration 013) provides DB-level defense.

### Exercises sub-tab — Create + Update via Sheet modal

24. `/library/exercises` gains an "Add exercise" CTA at the top of the list. Tapping the CTA opens an `ExerciseEditSheet` (shadcn Sheet from the bottom on mobile) in create mode.
25. Per-row pencil icon on each `ExerciseListCard` opens the same `ExerciseEditSheet` in edit mode for that row.
26. `ExerciseForm` fields: `name` (required, validated unique per user), `muscle_groups` (multi-select; required, at least one), `is_bodyweight` (Checkbox), `prescribed_min` and `prescribed_max` (numeric inputs, required, both `≥ 1`, `prescribed_max ≥ prescribed_min`), `notes` (Textarea, optional, ≤ 1000 chars). Submit copy: `"Create exercise"` / `"Save changes"`.
27. The muscle-groups multi-select offers the locked taxonomy from MASTER_SPEC §11 plus Slice 2's granular tags: Chest, Shoulders, Back, Arms, Legs, Core, Calves (the high-level seven), plus Lats, Upper Back, Teres Major, Rear Delts (the granular four). Eleven options total, displayed in two grouped sections in the picker (Primary 7, then Specific 4).
28. `ExerciseEditSheet`'s onSubmit performs a direct supabase upsert (insert in create mode; update in edit mode). On success, sheet closes and the parent list re-fetches via `router.refresh()`. On error, inline `"Save failed — please retry."` with a retry button.

### Cardio sub-tab — Create + Update via Sheet modal

29. `/library/cardio` (existing from 7a) gains an "Add cardio activity" CTA at the top of the activities list (below the cardio block header).
30. Each `CardioActivityCard` row gains a per-row pencil icon. Tapping opens a `CardioActivityEditSheet` in edit mode.
31. `CardioActivityForm` fields: `name` (required, validated unique per owner), `cardio_format` (Select: speed_run / endurance_run / basketball — required, NO default value; placeholder copy `"Pick a format"`; uses the existing `cardio_format_enum`), `cardio_distance` (text, optional, ≤ 40 chars), `cardio_target_zone` (Select: sprint / zone_2 / anaerobic / game_pace — required, NO default value; placeholder copy `"Pick a zone"`; uses the existing `cardio_target_zone_enum`), `description` (Textarea, optional, ≤ 1000 chars). Submit copy: `"Create activity"` / `"Save changes"`. Forced explicit selection on the two Selects prevents silent miscategorization (e.g., labeling an Endurance Run as `speed_run` because the user forgot to change a stuck default).
32. On create, the new activity is inserted into `cardio_activities`; the user's single cardio block (from 7a) auto-wires the new activity via `block_cardio_items` with `display_order = MAX(display_order) + 1` (NULL → 0).
33. On edit, only the `cardio_activities` row updates. The `block_cardio_items` wiring is untouched.

### Recovery sub-tab — Create + Update via Sheet modal

34. `/library/recovery` (existing from 7a) gains an "Add recovery activity" CTA at the top of the activities list (below the recovery block header).
35. Each `RecoveryActivityCard` row gains a per-row pencil icon. Tapping opens a `RecoveryActivityEditSheet` in edit mode.
36. `RecoveryActivityForm` fields: `name` (required, validated unique per owner), `description` (Textarea, optional, ≤ 1000 chars). Submit copy: `"Create activity"` / `"Save changes"`.
37. On create, the new activity is inserted into `recovery_activities`; the user's single recovery block (from 7a) auto-wires the new activity via `block_recovery_items` with `display_order = MAX(display_order) + 1` (NULL → 0).
38. On edit, only the `recovery_activities` row updates. The `block_recovery_items` wiring is untouched.

### Form library patterns

39. Zod schemas live in `src/lib/library/schemas.ts`. One exported schema per editable entity: `blockSchema`, `exerciseSchema`, `cardioActivitySchema`, `recoveryActivitySchema`. Each schema includes the field-level constraints (required, min length, numeric ranges) and an async `.refine()` for name uniqueness.
40. Async uniqueness check pattern: `.refine()` calls `nameConflicts({ table, nameColumn, name, ownIdColumn, ownId })` which runs a scoped Supabase query (`SELECT <pk> WHERE <name_col> = $value [AND <pk> != $own_id] LIMIT 2`). Returns true if zero matches. Friendly error: `"A {block | exercise | cardio activity | recovery activity} with this name already exists."`.
41. Form integration via shadcn `<Form>` primitive: `<Form>` wraps `<form>`; `<FormField>` wraps each labeled input; field-level error messages render via `<FormMessage>`. Submit handler calls into mutation helper, awaits response, then closes the form (Sheet) or navigates (full-page block edit).
42. Discard-edit confirmation: form's `formState.isDirty` is checked on close attempt (Sheet's `onOpenChange`, Cancel button, or in-page back affordance). If dirty, prompt `"Discard changes?"` with Cancel / Discard buttons. Cancel keeps form open; Discard closes / navigates without saving.
43. Form value types: each form's TypeScript type is derived from its zod schema via `z.infer<typeof schema>`. No hand-rolled types for form values.

### Save semantics

44. All Library mutations use the supabase BROWSER client directly (`createClient()` from `@/lib/supabase/client`). No Server Actions. No Slice 5 sync queue integration.
45. Mutation helpers live in `src/lib/library/mutations.ts`: one function per (entity, action) pair. Each takes the supabase client + payload + optional own-id (for edits), returns `Promise<{ ok: true; data: T } | { ok: false; error: string }>`.
46. Pessimistic-then-update pattern: form submit shows pending state (button disabled, RHF `formState.isSubmitting`); on response, either close + refresh (success) or show inline retry (failure). Local form state is NOT advanced on optimistic assumption.
47. 23505 race handling: if DB rejects a name on insert due to the unique constraint despite the UI's async pre-check passing (rare race), the mutation helper translates 23505 to the friendly "Name already exists" inline error on the name field. No silent failure.

### Cross-link contract extension

48. New cross-link helpers added to `src/lib/library/crossLinks.ts`: `exerciseDetailHref(exerciseId): string` (reserved for a future Exercise detail page; not used as a Link in 7b — the per-row pencil button is the affordance), `blockEditHref(blockId): string` → `/library/lifting/blocks/[id]/edit`, `blockCreateHref(): string` → `/library/lifting/blocks/new`.
49. Existing `BlockLink`, `WorkoutLink`, `ExerciseLink` cross-link components from Slices 6.1 and 7a are unchanged. Form components use `useRouter()` + the new href helpers for post-submit navigation; no direct `next/link` usage in form components for navigation.

### Regression — existing surfaces still render correctly

50. **Library tab read flows from 7a still work:** `/library/lifting` block list, `/library/lifting/blocks/[id]` block detail, `/library/cardio` activities list, `/library/recovery` activities list — all render with no behavior change beyond the new affordances (Add CTAs, Edit button on block detail, per-row pencil icons).
51. **Today / Plan / History / Logger / Sync** unchanged. Library editing does not touch their query shapes or component contracts.
52. **Bottom nav** unchanged from 7a. Six tabs in order Today / Plan / Library / History / Nutrition / Settings, labels at 10px, Library tab active for descendant routes via `startsWith`.

### Slice 7b NOT-IN-SCOPE

53. NO Delete affordance on any of the four catalog surfaces.
54. NO bulk operations (multi-select + delete, multi-select + edit).
55. NO drag-drop reorder. Move-up / move-down buttons only.
56. NO inline-create cardio activity OR inline-create recovery activity from any other surface (cardio + recovery activity creation lives only in their respective sub-tabs).
57. NO exercise detail page route. Per-row pencil icon → Sheet modal is the entire edit affordance for exercises.
58. NO cross-block "duplicate this block" or "use as template" affordance.
59. NO change to `block_category` for in-use blocks. `block_type` editing on in-use blocks is allowed per AC #22 with the informative warning.
60. NO completion-tracking UI for cardio/recovery activities (still scoped to a future slice; `activity_completions` schema-only since 7a).
61. NO AI-assisted form pre-fill (logged in FUTURE_WORK as a Nutrition slice item; not part of catalog editing).
62. NO history of catalog edits (no edit log, no `updated_by`, no soft-delete trail).
63. NO seeding of a "starter exercise library" for new users beyond what `pnpm seed` already produces.

### Code quality gates

64. `pnpm lint`, `pnpm typecheck`, `pnpm format:check` all clean.
65. `pnpm-lock.yaml` committed; reflects new RHF + zod + `@hookform/resolvers` plus the nine shadcn primitive transitive deps.
66. No new console errors during any of Section 6's manual tests (Logger / Today / Plan / History / Library all clean).

## 3. Files to Create or Modify

### New SQL migration

- `supabase/migrations/017_library_edit_uniqueness.sql` — defensively guarantees `UNIQUE (owner_user_id, name)` on `cardio_activities` and `recovery_activities`; verifies `(block_id, exercise_id)` UNIQUE on `block_lifting_items`. All `CREATE UNIQUE INDEX IF NOT EXISTS` for idempotency.

### New routes — Library editing

- `src/app/(app)/library/exercises/page.tsx` — Exercises sub-tab list (Server Component)
- `src/app/(app)/library/lifting/blocks/new/page.tsx` — Block create route (Server Component shell, renders BlockForm in create mode)
- `src/app/(app)/library/lifting/blocks/[block_id]/edit/page.tsx` — Block edit route (Server Component shell, fetches block + bank + set_log count, renders BlockForm in edit mode)

### New components — Library tab

- `src/app/(app)/library/_components/AddBlockButton.tsx` — Server, links to `/library/lifting/blocks/new`
- `src/app/(app)/library/_components/EditBlockButton.tsx` — Server, links to `/library/lifting/blocks/[id]/edit`
- `src/app/(app)/library/_components/BlockForm.tsx` — Client (RHF wraps), the full block edit form with bank composition
- `src/app/(app)/library/_components/BankComposition.tsx` — Client (sub-component of BlockForm), renders bank list + Add button
- `src/app/(app)/library/_components/BankItemRow.tsx` — Client, one bank row with reorder + remove buttons
- `src/app/(app)/library/_components/MoveButton.tsx` — Client, the up/down reorder button (encapsulates disabled-at-boundary logic)
- `src/app/(app)/library/_components/ExercisePicker.tsx` — Client, the searchable exercise picker Sheet with "+ Create new exercise" affordance
- `src/app/(app)/library/_components/ExerciseListCard.tsx` — Server (presentational shell with EditPencilButton client island)
- `src/app/(app)/library/_components/ExerciseEditSheet.tsx` — Client, the Sheet wrapper around ExerciseForm (used both by per-row pencil and by ExercisePicker's inline-create)
- `src/app/(app)/library/_components/ExerciseForm.tsx` — Client (RHF wraps), the exercise edit form
- `src/app/(app)/library/_components/MuscleGroupMultiSelect.tsx` — Client, the Popover + Command + checkbox-list assembly
- `src/app/(app)/library/_components/AddExerciseButton.tsx` — Client, opens ExerciseEditSheet in create mode
- `src/app/(app)/library/_components/EditPencilButton.tsx` — Client, the per-row pencil icon button (reusable across exercises, cardio activities, recovery activities)
- `src/app/(app)/library/_components/CardioActivityEditSheet.tsx` — Client, the Sheet wrapper around CardioActivityForm
- `src/app/(app)/library/_components/CardioActivityForm.tsx` — Client (RHF wraps)
- `src/app/(app)/library/_components/AddCardioActivityButton.tsx` — Client
- `src/app/(app)/library/_components/RecoveryActivityEditSheet.tsx` — Client
- `src/app/(app)/library/_components/RecoveryActivityForm.tsx` — Client (RHF wraps)
- `src/app/(app)/library/_components/AddRecoveryActivityButton.tsx` — Client
- `src/app/(app)/library/_components/DiscardChangesDialog.tsx` — Client, shadcn Dialog wrapper for the discard-edit confirmation

### New shadcn primitives (each via `pnpm dlx shadcn add <name>`)

- `src/components/ui/form.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/command.tsx`

### New data layer files

- `src/lib/library/schemas.ts` — Zod schemas: `blockSchema`, `exerciseSchema`, `cardioActivitySchema`, `recoveryActivitySchema`. Each has the async uniqueness `.refine()`.
- `src/lib/library/mutations.ts` — Mutation helpers: `createBlock`, `updateBlock`, `createExercise`, `updateExercise`, `createCardioActivity`, `updateCardioActivity`, `createRecoveryActivity`, `updateRecoveryActivity`. Plus internal helpers for bank composition delete-then-insert.
- `src/lib/library/uniqueness.ts` — Async name conflict checker `nameConflicts(...)`. Used by zod refines.

### Modified data layer files (extending Slice 7a)

- `src/lib/library/queries.ts` — add `getExercises()` for the Exercises sub-tab list; add `getHistoricalSetLogCount(blockId)` for the block_type warning.
- `src/lib/library/projections.ts` — add `ExerciseListItem` projection; extend `LiftingBlockDetail` with `historical_set_log_count: number` (or pass alongside as a separate prop — Codex's call).
- `src/lib/library/crossLinks.ts` — add `exerciseDetailHref(exerciseId)`, `blockEditHref(blockId)`, `blockCreateHref()`.

### Modified — Library sub-tab navigator and existing components

- `src/app/(app)/library/_components/LibraryTabs.tsx` — extend the Tabs strip to four entries (Lifting / Exercises / Cardio / Recovery). `activeTab` prop type expanded. Verify label fit at 375px.
- `src/app/(app)/library/lifting/page.tsx` — render `<AddBlockButton />` at the top of the list.
- `src/app/(app)/library/lifting/blocks/[block_id]/page.tsx` — render `<EditBlockButton />` in the block detail header.
- `src/app/(app)/library/cardio/page.tsx` — render `<AddCardioActivityButton />` at the top of the activities list.
- `src/app/(app)/library/recovery/page.tsx` — render `<AddRecoveryActivityButton />` at the top of the activities list.
- `src/app/(app)/library/_components/CardioActivityCard.tsx` — append `<EditPencilButton />` on each row.
- `src/app/(app)/library/_components/RecoveryActivityCard.tsx` — append `<EditPencilButton />` on each row.

### Modified — package.json + lockfile

- `package.json` — adds `react-hook-form`, `zod`, `@hookform/resolvers` to dependencies. Versions pinned at install-time latest stable that supports React 19.
- `pnpm-lock.yaml` — committed updates.

### Files NOT touched (allowlist enforcement)

- Any migration 001-016
- Any DECISIONS.md, KNOWN_ISSUES.md, FUTURE_WORK.md, CHANGELOG.md (Claude Code's post-slice automation handles these)
- Any AGENTS.md, CLAUDE.md, MASTER_SPEC.md, ARCHITECTURE.md, PROJECT_BRIEF.md
- Any wiki content under `supabase/seed/wiki/`
- Any seed file under `supabase/seed/` (the seed pipeline is bootstrap-only; 7b's editing surface is the Library tab UI)
- Any Today / Plan / History / Logger / Sync / Auth file (no behavioral changes; rename adaptation already complete in 7a)

## 4. Component / Function Contracts

### Migration 017 — Library edit uniqueness

> **Cross-slice constraint check.** Echoes Slice 2 DECISIONS.md ("Migration immutability rule") and Slice 7a's locked schema. 7a's migration 015 specified `UNIQUE (owner_user_id, name)` on `cardio_activities` and `recovery_activities` per AC #2 of that slice. 017 applies the defensive `IF NOT EXISTS` pattern so the migration is a clean no-op against any environment where 015 already established the constraints, and adds them safely if the live DB diverges from spec.

```sql
-- ============================================================
-- Migration 017: Library edit uniqueness constraints
--
-- Defensively guarantees the UNIQUE constraints required by
-- Slice 7b's UI-layer uniqueness validation (zod async refine
-- + DB final guard). All operations idempotent: if the
-- constraint already exists from migration 015 / 002,
-- IF NOT EXISTS makes this migration a no-op.
-- ============================================================

-- cardio_activities: UNIQUE (owner_user_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cardio_activities_owner_name
  ON cardio_activities (owner_user_id, name);

-- recovery_activities: UNIQUE (owner_user_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_activities_owner_name
  ON recovery_activities (owner_user_id, name);

-- block_lifting_items: UNIQUE (block_id, exercise_id)
-- (PK was already (block_id, exercise_id) per migration 002, so this
-- typically is a no-op; the IF NOT EXISTS makes it safe regardless.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_block_lifting_items_block_exercise
  ON block_lifting_items (block_id, exercise_id);
```

### Zod schemas (`src/lib/library/schemas.ts`)

> Cross-slice constraint check: muscle-group taxonomy is locked in MASTER_SPEC §11 (resolution: `Chest, Shoulders, Back, Arms, Legs, Core, Calves`) plus Slice 2 added granular tags (`lats, upper_back, teres_major, rear_delts`) per the Friday Pull sub-bank mapping. Eleven options total.

```typescript
import { z } from "zod";
import { nameConflicts } from "./uniqueness";

const MUSCLE_GROUPS = [
  "chest",
  "shoulders",
  "back",
  "arms",
  "legs",
  "core",
  "calves",
  "lats",
  "upper_back",
  "teres_major",
  "rear_delts",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

// Block schema — shape for both create and edit (own_id distinguishes)
export const blockSchema = z
  .object({
    block_name: z.string().trim().min(1, "Block name is required").max(80),
    block_category: z.enum(["lifting", "cardio", "recovery"]),
    block_type: z.enum(["failure", "mobility", "corrective"]).nullable(),
    bank: z
      .array(
        z.object({
          exercise_id: z.string().uuid(),
          display_order: z.number().int().nonnegative(),
        })
      )
      .default([]),
    own_id: z.string().uuid().optional(), // edit mode only
  })
  .refine(
    (data) => data.block_category !== "lifting" || data.block_type !== null,
    { message: "Lifting blocks require a block type", path: ["block_type"] }
  )
  .refine(
    (data) => data.block_category === "lifting" || data.block_type === null,
    {
      message: "Cardio/recovery blocks must not have a block type",
      path: ["block_type"],
    }
  )
  .refine(
    async (data) =>
      !(await nameConflicts({
        table: "blocks",
        nameColumn: "block_name",
        name: data.block_name,
        ownIdColumn: "block_id",
        ownId: data.own_id,
      })),
    { message: "A block with this name already exists.", path: ["block_name"] }
  );

export type BlockFormValues = z.infer<typeof blockSchema>;

// Exercise schema
export const exerciseSchema = z
  .object({
    name: z.string().trim().min(1, "Exercise name is required").max(80),
    muscle_groups: z
      .array(z.enum(MUSCLE_GROUPS))
      .min(1, "Pick at least one muscle group"),
    is_bodyweight: z.boolean().default(false),
    prescribed_min: z
      .number()
      .int()
      .min(1, "Minimum reps must be at least 1"),
    prescribed_max: z
      .number()
      .int()
      .min(1, "Maximum reps must be at least 1"),
    notes: z.string().max(1000).default(""),
    own_id: z.string().uuid().optional(),
  })
  .refine((data) => data.prescribed_max >= data.prescribed_min, {
    message: "Maximum reps must be ≥ minimum reps",
    path: ["prescribed_max"],
  })
  .refine(
    async (data) =>
      !(await nameConflicts({
        table: "exercises",
        nameColumn: "name",
        name: data.name,
        ownIdColumn: "exercise_id",
        ownId: data.own_id,
      })),
    { message: "An exercise with this name already exists.", path: ["name"] }
  );

export type ExerciseFormValues = z.infer<typeof exerciseSchema>;

// Cardio activity schema
export const cardioActivitySchema = z
  .object({
    name: z.string().trim().min(1, "Activity name is required").max(80),
    cardio_format: z.enum(["speed_run", "endurance_run", "basketball"]),
    cardio_distance: z.string().trim().max(40).default(""),
    cardio_target_zone: z.enum([
      "sprint",
      "zone_2",
      "anaerobic",
      "game_pace",
    ]),
    description: z.string().max(1000).default(""),
    own_id: z.string().uuid().optional(),
  })
  .refine(
    async (data) =>
      !(await nameConflicts({
        table: "cardio_activities",
        nameColumn: "name",
        name: data.name,
        ownIdColumn: "activity_id",
        ownId: data.own_id,
      })),
    {
      message: "A cardio activity with this name already exists.",
      path: ["name"],
    }
  );

export type CardioActivityFormValues = z.infer<typeof cardioActivitySchema>;

// Recovery activity schema
export const recoveryActivitySchema = z
  .object({
    name: z.string().trim().min(1, "Activity name is required").max(80),
    description: z.string().max(1000).default(""),
    own_id: z.string().uuid().optional(),
  })
  .refine(
    async (data) =>
      !(await nameConflicts({
        table: "recovery_activities",
        nameColumn: "name",
        name: data.name,
        ownIdColumn: "activity_id",
        ownId: data.own_id,
      })),
    {
      message: "A recovery activity with this name already exists.",
      path: ["name"],
    }
  );

export type RecoveryActivityFormValues = z.infer<typeof recoveryActivitySchema>;
```

### Uniqueness checker (`src/lib/library/uniqueness.ts`)

```typescript
import { createClient } from "@/lib/supabase/client";

type NameConflictArgs = {
  table:
    | "blocks"
    | "exercises"
    | "cardio_activities"
    | "recovery_activities";
  nameColumn: string; // "block_name" for blocks; "name" for the rest
  name: string;
  ownIdColumn: string; // PK column for the table (block_id, exercise_id, activity_id)
  ownId?: string;
};

export async function nameConflicts({
  table,
  nameColumn,
  name,
  ownIdColumn,
  ownId,
}: NameConflictArgs): Promise<boolean> {
  const supabase = createClient();
  let query = supabase
    .from(table)
    .select(ownIdColumn)
    .eq(nameColumn, name)
    .limit(2);
  if (ownId) {
    query = query.neq(ownIdColumn, ownId);
  }
  const { data, error } = await query;
  if (error) {
    // Network/RLS error — fail open (let DB constraint catch on submit). Logged.
    console.warn("nameConflicts query failed; deferring to DB constraint", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
```

### Mutation helpers (`src/lib/library/mutations.ts`)

> Cross-slice constraint check: ARCHITECTURE.md §1 ("No Server Actions for mutations"). All Library writes go through the supabase BROWSER client passed in by the calling form component.

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const friendlyError = (err: { code?: string; message?: string }): string => {
  if (err.code === "23505") return "Name already exists.";
  if (err.code === "23514") return "Invalid combination of fields.";
  if (err.code === "42501") return "You don't have access to make this change.";
  return err.message ?? "Save failed — please retry.";
};

// ── Block mutations ──────────────────────────────────────────────────

export async function createBlock(
  supabase: SupabaseClient<Database>,
  ownerUserId: string,
  input: {
    block_name: string;
    block_category: "lifting" | "cardio" | "recovery"; // BlockForm always sends "lifting" — see AC #16 revision
    block_type: "failure" | "mobility" | "corrective"; // required for lifting blocks (no null)
    bank: { exercise_id: string; display_order: number }[];
  }
): Promise<MutationResult<{ block_id: string }>>;
// 1. INSERT INTO blocks (owner_user_id, block_name, block_category, block_type)
//    RETURNING block_id
// 2. If bank.length > 0:
//    INSERT INTO block_lifting_items VALUES (block_id, exercise_id, display_order) [...rows]
// On any failure, return { ok: false, error: friendlyError(err) }.
// (The two inserts are not transactional. If step 1 succeeds and step 2 fails, the
// block is created with an empty bank; the user retries the bank composition by
// editing the block. Acceptable for personal-first scope.)
// NOTE: block_category parameter retained for type/schema completeness even
// though BlockForm hardcodes "lifting". A future Library editing surface that
// supports cardio/recovery block creation could pass other values; for 7b,
// only "lifting" reaches this function.

export async function updateBlock(
  supabase: SupabaseClient<Database>,
  blockId: string,
  input: {
    block_name: string;
    block_type: "failure" | "mobility" | "corrective"; // required (no null) — form is lifting-only per AC #16
    bank: { exercise_id: string; display_order: number }[];
  }
): Promise<MutationResult<void>>;
// NOTE: block_category is structurally absent from this payload. The form is
// lifting-only per AC #16 revision; category is implicit from the route and
// never editable.
//
// 1. UPDATE blocks SET block_name = $name, block_type = $type WHERE block_id = $id
// 2. DELETE FROM block_lifting_items WHERE block_id = $id
// 3. INSERT INTO block_lifting_items VALUES (block_id, exercise_id, display_order) [...rows]
// (Bank update is delete-then-insert. Same atomicity caveat as createBlock.)

// ── Exercise mutations ───────────────────────────────────────────────

export async function createExercise(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: {
    name: string;
    muscle_groups: string[];
    is_bodyweight: boolean;
    prescribed_min: number;
    prescribed_max: number;
    notes: string;
  }
): Promise<MutationResult<{ exercise_id: string }>>;
// INSERT INTO exercises (...)  RETURNING exercise_id

export async function updateExercise(
  supabase: SupabaseClient<Database>,
  exerciseId: string,
  input: {
    name: string;
    muscle_groups: string[];
    is_bodyweight: boolean;
    prescribed_min: number;
    prescribed_max: number;
    notes: string;
  }
): Promise<MutationResult<void>>;
// UPDATE exercises SET ... WHERE exercise_id = $id

// ── Cardio activity mutations ────────────────────────────────────────

export async function createCardioActivity(
  supabase: SupabaseClient<Database>,
  ownerUserId: string,
  cardioBlockId: string, // user's single cardio block (from getCardioBlock)
  input: {
    name: string;
    cardio_format: "speed_run" | "endurance_run" | "basketball";
    cardio_distance: string | null;
    cardio_target_zone: "sprint" | "zone_2" | "anaerobic" | "game_pace";
    description: string | null;
  }
): Promise<MutationResult<{ activity_id: string }>>;
// 1. INSERT INTO cardio_activities (...)  RETURNING activity_id
// 2. SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
//    FROM block_cardio_items WHERE block_id = $cardio_block_id
// 3. INSERT INTO block_cardio_items (block_id, activity_id, display_order)
//    VALUES ($cardio_block_id, $activity_id, $next_order)
// (Steps 2 + 3 can be combined as INSERT ... SELECT; either is fine.)
// On step-2/3 failure (after step 1 success): toast warning per Edge case 16.

export async function updateCardioActivity(
  supabase: SupabaseClient<Database>,
  activityId: string,
  input: {
    name: string;
    cardio_format: "speed_run" | "endurance_run" | "basketball";
    cardio_distance: string | null;
    cardio_target_zone: "sprint" | "zone_2" | "anaerobic" | "game_pace";
    description: string | null;
  }
): Promise<MutationResult<void>>;
// UPDATE cardio_activities SET ... WHERE activity_id = $id
// (Junction unchanged.)

// ── Recovery activity mutations ──────────────────────────────────────

export async function createRecoveryActivity(
  supabase: SupabaseClient<Database>,
  ownerUserId: string,
  recoveryBlockId: string,
  input: { name: string; description: string | null }
): Promise<MutationResult<{ activity_id: string }>>;
// Same shape as createCardioActivity (recovery_activities + block_recovery_items).

export async function updateRecoveryActivity(
  supabase: SupabaseClient<Database>,
  activityId: string,
  input: { name: string; description: string | null }
): Promise<MutationResult<void>>;
// UPDATE recovery_activities SET ... WHERE activity_id = $id
```

### BlockForm contract

```typescript
// src/app/(app)/library/_components/BlockForm.tsx

"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { blockSchema, type BlockFormValues } from "@/lib/library/schemas";

type BlockFormProps = {
  mode: "create" | "edit";
  initialValues?: Partial<BlockFormValues>; // undefined for create
  blockId?: string; // required for edit
  historicalSetLogCount?: number; // edit mode only; informs block_type warning
};

// Behavior (per AC #16 revision — lifting-only form):
// - block_category is HARDCODED to "lifting" — never a form field, never
//   driven by useWatch. The form is mounted only on /library/lifting/blocks/...
//   routes; cardio + recovery blocks are seeded one-per-user from 7a and have
//   no edit affordance in 7b.
// - useForm with zodResolver(blockSchema), defaultValues from initialValues
//   (or block_type=null, bank=[] for create — NO default for block_type;
//   placeholder text "Pick a protocol" forces explicit selection).
// - block_type Select always visible; BankComposition always visible; submit
//   button copy is "Create block" / "Save changes". No useWatch needed for
//   structural toggling.
// - In edit mode:
//     * Static "Lifting block" label renders for context.
//     * own_id field on the form values is set to blockId so the schema's
//       async refine excludes the current row.
// - block_type warning logic (edit mode + has history):
//     const originalType = initialValues?.block_type ?? null;
//     const currentType = useWatch({ name: "block_type" });
//     const showWarning =
//       mode === "edit" &&
//       (historicalSetLogCount ?? 0) > 0 &&
//       currentType !== originalType;
//     // Render the informative copy below the block_type Select if showWarning.
// - onSubmit (RHF handleSubmit wraps):
//     * Pessimistic: button disables via formState.isSubmitting.
//     * Calls createBlock with hardcoded block_category: "lifting", or updateBlock.
//     * On { ok: true } create: router.push(blockDetailHref(data.block_id)).
//     * On { ok: true } edit: router.refresh() + render brief success state.
//     * On { ok: false }: setError on path "block_name" if 23505-style; else
//       toast / general error.
// - DiscardChangesDialog wired to formState.isDirty; intercepts navigation
//   away while dirty.
```

### BankComposition contract

```typescript
// src/app/(app)/library/_components/BankComposition.tsx

"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import type { BlockFormValues } from "@/lib/library/schemas";

// Reads form context's "bank" field via useFieldArray. No props beyond
// the implicit context.
//
// Operations exposed to children (BankItemRow, ExercisePicker):
//   - move(from, to)    — fields.move(from, to); reassign display_order
//                         to match new index.
//   - remove(index)     — fields.remove(index).
//   - append({ exercise_id, display_order })
//                       — fields.append; display_order = fields.length
//                         (i.e., next index after the current append).
//
// Renders the bank list. Each row is <BankItemRow index={i} />.
// Below the list: <Button onClick={() => setPickerOpen(true)}>
//   Add exercise to bank
// </Button>
// Picker is <ExercisePicker open={pickerOpen} onOpenChange={setPickerOpen}
//   excludeIds={currentBankExerciseIds}
//   onSelect={(exerciseId) => append({ exercise_id, display_order: ... })}
// />.
//
// Reorder normalization: after any move(), recompute display_order across
// the full array as 0..n-1 to keep the persisted order tight.
```

### ExercisePicker contract

```typescript
// src/app/(app)/library/_components/ExercisePicker.tsx

"use client";

type ExercisePickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[]; // exercises already in the bank — hidden from list
  onSelect: (exerciseId: string) => void;
};

// Sheet-rendered picker. Top of Sheet:
//   <Button onClick={() => setCreateSheetOpen(true)}>+ Create new exercise</Button>
// Below:
//   <Input value={search} onChange={...} placeholder="Search exercises..." />
//   {filteredExercises.map((ex) => (
//     <button onClick={() => { onSelect(ex.exercise_id); onOpenChange(false); }}>
//       {ex.name} — {primaryMuscleGroup}
//     </button>
//   ))}
//
// Inline-create flow:
//   1. User taps "+ Create new exercise"
//   2. <ExerciseEditSheet open={createSheetOpen} mode="create"
//        onCreated={(newExerciseId) => {
//          setCreateSheetOpen(false);
//          router.refresh(); // refreshes the picker's exercise list via parent re-render
//          onSelect(newExerciseId);
//          onOpenChange(false);
//        }}
//      />
//   3. (Picker's exercise list comes from a server-fetched prop; router.refresh
//       triggers re-fetch on re-render. If a more aggressive refresh pattern is
//       needed because router.refresh doesn't re-render this client component
//       quickly enough, fall back to an SWR-style local fetch hook here.)
//
// On regular pick (existing exercise tap): picker closes via onOpenChange(false);
// onSelect fires with exercise_id.
```

### MuscleGroupMultiSelect contract

```typescript
// src/app/(app)/library/_components/MuscleGroupMultiSelect.tsx

"use client";

import { useState } from "react";
// shadcn primitives:
//   Popover, PopoverTrigger, PopoverContent, Command, CommandInput,
//   CommandGroup, CommandItem, CommandSeparator, Checkbox

type MuscleGroupMultiSelectProps = {
  value: string[]; // current selection
  onChange: (value: string[]) => void;
  error?: string;
};

// Renders a button that displays current selection count
// (e.g., "3 muscle groups" — or "Pick muscle groups" if value.length === 0).
// Button opens a Popover. Inside the Popover:
//   <Command>
//     <CommandGroup heading="Primary">
//       <CommandItem onSelect={() => toggle("chest")}>
//         <Checkbox checked={value.includes("chest")} /> Chest
//       </CommandItem>
//       ... (shoulders, back, arms, legs, core, calves)
//     </CommandGroup>
//     <CommandSeparator />
//     <CommandGroup heading="Specific">
//       ... (lats, upper_back, teres_major, rear_delts)
//     </CommandGroup>
//   </Command>
//   <Button onClick={() => setOpen(false)}>Done</Button>
//
// Error display: red 1px border on the trigger button + the error
// message rendered below by FormMessage in the parent FormField.
```

### Library route shells

```typescript
// src/app/(app)/library/exercises/page.tsx

export default async function ExercisesLibraryPage(): Promise<JSX.Element>;
// Server Component. Calls getExercises(). Renders:
//   <LibraryTabs activeTab="exercises" />
//   <AddExerciseButton />
//   {exercises.map((ex) => <ExerciseListCard exercise={ex} />)}
//   {exercises.length === 0 && <EmptyState message="No exercises yet." />}

// src/app/(app)/library/lifting/blocks/new/page.tsx

export default async function NewBlockPage(): Promise<JSX.Element>;
// Server Component. Renders a minimal page header + <BlockForm mode="create" />.
// No data fetching beyond the auth check (handled by middleware).

// src/app/(app)/library/lifting/blocks/[block_id]/edit/page.tsx

export default async function EditBlockPage(props: {
  params: Promise<{ block_id: string }>;
}): Promise<JSX.Element>;
// Server Component. Calls:
//   const block = await getBlockDetail(blockId);
//   if (!block) redirect("/library/lifting");
//   if (block.block_category !== "lifting") redirect("/library/lifting");
//   const count = await getHistoricalSetLogCount(blockId);
// Renders:
//   <BlockForm
//     mode="edit"
//     blockId={blockId}
//     initialValues={{ block_name, block_type, bank: [...] }}
//     historicalSetLogCount={count}
//   />
```

### LibraryTabs (extended for four tabs)

```typescript
// src/app/(app)/library/_components/LibraryTabs.tsx (modified)

"use client";

type LibraryTabsProps = {
  activeTab: "lifting" | "exercises" | "cardio" | "recovery";
};

// Renders shadcn <Tabs value={activeTab}> with FOUR <TabsTrigger>s, each
// wrapped in a next/link to its category route.
// Sub-tab labels: "Lifting", "Exercises", "Cardio", "Recovery".
// Type size: text-xs (shadcn default = 12px) is the starting point.
// At 375px viewport, four labels of these lengths fit cleanly in a 4-col
// grid. Codex verifies via screenshot or manual measurement during
// implementation. If they don't fit, switch to text-[10px] across all four.
//
// Keep usePathname-derived activeTab pattern from 7a; no client useState.
```

### Extended queries and projections

```typescript
// src/lib/library/queries.ts (additions)

export async function getExercises(): Promise<ExerciseListItem[]>;
// SELECT exercise_id, name, muscle_groups, is_bodyweight,
//        prescribed_min, prescribed_max
// FROM exercises
// WHERE user_id = auth.uid()  -- RLS handles the filter
// ORDER BY name ASC
//
// Maps muscle_groups text[] to a sorted array; primary muscle group derived
// for caption display via getPrimaryMuscleGroupLabel from
// src/lib/methodology/muscle-groups.ts.

export async function getHistoricalSetLogCount(
  blockId: string
): Promise<number>;
// SELECT COUNT(*) AS count FROM set_logs
// WHERE block_id = $1 AND user_id = auth.uid()
//
// (Direct count via set_logs.block_id FK. RLS on set_logs handles the
// user_id filter.)
```

```typescript
// src/lib/library/projections.ts (additions)

export type ExerciseListItem = {
  exercise_id: string;
  name: string;
  muscle_groups: string[];
  primary_muscle_group_label: string; // formatted via getPrimaryMuscleGroupLabel
  is_bodyweight: boolean;
  prescribed_min: number;
  prescribed_max: number;
};

// Existing LiftingBlockDetail unchanged; historical_set_log_count passed
// alongside as a separate prop to BlockForm rather than embedded.
```

```typescript
// src/lib/library/crossLinks.ts (additions)

export function exerciseDetailHref(exerciseId: string): string;
// Returns `/library/exercises/${exerciseId}` — reserved for a future detail page.
// Not used as a Link in 7b; the EditPencilButton is the affordance.

export function blockEditHref(blockId: string): string;
// Returns `/library/lifting/blocks/${blockId}/edit`

export function blockCreateHref(): string;
// Returns `/library/lifting/blocks/new`
```

### Save-failure UI copy

```
Network failure or 5xx: "Save failed — please retry." with retry button.
23505 race: "Name already exists." inline on the name field.
RLS denial (42501): "You don't have access to make this change." (defensive — should never fire for own rows).
Validation failure (4xx other than 408/429): "Couldn't save — please check the fields and retry."
Step-2-failure on cardio/recovery activity create: toast warning "Activity created
   but not yet wired to your Cardio block — retry to wire it up." Activity_id
   surfaced in toast for debugging if needed.
```

## 5. Edge Cases to Handle

E7b.1. **23505 race on name uniqueness submit.** Async refine passed at form-blur but DB rejects on insert because another tab/concurrent client created a row with the same name. Mutation helper translates 23505 to `"Name already exists."` inline error on the name field. User adjusts name and retries.

E7b.2. **Inline-create exercise during block edit — backend create succeeds, picker still showing stale list.** When user creates a new exercise via the picker's nested Sheet, the picker's exercise list must refresh before auto-selecting the new exercise. Implementation: `router.refresh()` triggers re-fetch in the parent server component. If `router.refresh()` doesn't re-render the picker fast enough (it's a Client Component holding its own state), the picker can also locally append the new exercise to its in-memory list and select it, deferring the formal refresh to the next mount. Either path works; quality review verifies the new exercise is visible after picker reopen.

E7b.3. **`block_type` warning on first form load.** If the block has historical `set_logs` but the user hasn't changed `block_type` yet, the warning is hidden (per `currentType !== originalType` check). Only when the user actually picks a different `block_type` from the Select does the warning appear. Avoids alarmist copy on every edit-page load.

E7b.4. **`block_type` Select reverted to original value.** Warning hides automatically (the conditional in the BlockForm contract).

E7b.5. **Move-up on first row / move-down on last row.** Buttons are disabled (visually muted, `onClick` is a no-op). `MoveButton` encapsulates the boundary logic so each row only knows its index + total length.

E7b.6. **Empty bank submit on lifting block.** Schema allows `bank` to be empty (default `[]`), so the submit succeeds and the user gets a Lifting block with an empty bank. The existing Logger UI from Slice 4 already handles empty bank gracefully (renders "No exercises in this block" or similar). No forced "are you sure?" prompt in 7b; future polish could add one.

E7b.7. **Discard-edit confirmation on browser back / Sheet close.** RHF's `formState.isDirty` drives a `DiscardChangesDialog`. Sheet closes (exercises, cardio, recovery) intercept via the Sheet's `onOpenChange`. For full-page block edit, browser-back is harder to intercept reliably — `beforeunload` listener catches full page reload but doesn't cleanly intercept SPA navigation. Pragmatic approach: rely on the Sheet pattern for in-flow cases; for full-page block edit, accept that browser-back loses unsaved changes since they were never persisted. UX is "click back, lose changes" — equivalent to pre-7b behavior.

E7b.8. **Server save failure during inline-create-exercise.** Nested Sheet's submit fails. The exercise is not created. The picker remains open with no new exercise. The picker's "+ Create new exercise" button can be re-tapped. No partial state.

E7b.9. **Sub-tab label fit at 375px with four tabs.** AC #8 covers. Codex measures, switches to abbreviated `text-[10px]` if needed. Touch targets stay ≥ 44px even at the smaller text size.

E7b.10. **Rapid double-tap save.** Pessimistic submit pattern: button disables on first tap (RHF's `formState.isSubmitting`); subsequent taps are no-ops until the response returns. DB-level 23505 catches any racing duplicate creates from a different tab.

E7b.11. **7a regression: existing Library read flows.** Adding the fourth Exercises sub-tab and the new affordances doesn't break the existing 7a routes. Quality review's regression check covers explicitly.

E7b.12. **`block_category` mismatch on update.** AC #23 omits `block_category` from the edit form. `updateBlock`'s payload type is structurally without `block_category` — Codex's type-checking catches any attempt to send it. RLS + `blocks_lifting_has_type` CHECK constraint provide defense in depth at the DB level.

E7b.13. **Historical set-log count query timeout.** If the count query is slow on large datasets (unlikely for Marcus's volume but possible), the BlockForm renders without the warning while the count is pending. When the count resolves, the warning may flash in. Acceptable; alternative is a skeleton that's heavier than the value provides.

E7b.14. **Muscle-group multi-select: zero selected on submit.** Schema's `.min(1)` enforces. Form shows error message; submit blocked.

E7b.15. **Exercise `prescribed_max < prescribed_min` on submit.** Schema's `.refine()` catches with a path-specific error on `prescribed_max`. Form shows error; submit blocked.

E7b.16. **Cardio/recovery activity created but junction insert fails.** Step 1 (activity insert) succeeds; step 2 (`block_cardio_items` / `block_recovery_items` insert) fails. Mitigation: mutation helper detects step-2 failure after step-1 success; surfaces a warning toast `"Activity created but not yet wired to your Cardio block — retry to wire it up."` On retry, async refine catches the duplicate name (since the activity already exists in the catalog), so user can't simply re-create. Recovery path: support exists in 7b but is awkward — quality review should flag if this scenario is hit during testing. Future cleanup: wrap the two-step in a Postgres function for true atomicity.

E7b.17. **Exercise notes edit propagates to all blocks (Q5b correction).** Per the schema (`notes` lives on `exercises`, exercise-global), editing notes on Squat in the Exercises sub-tab changes how Squat's notes display in every block that contains Squat. This is the correct, methodology-matching behavior — but worth flagging in spec so QA verifies rather than assumes "blocks B and C still have the old notes." Test T32 exercises this explicitly.

E7b.18. **Pencil icon overlap with row tap target.** `EditPencilButton` has its own touch target (≥ 44px) inside the row. Tapping the pencil opens the edit Sheet; tapping the row body does nothing in 7b (the per-row pencil is the only affordance for cardio / recovery activities; for exercises, same). Quality review verifies the pencil doesn't interfere with surrounding tap zones.

E7b.19. **Inline-create exercise bypasses bank-uniqueness if same name typed twice.** The picker's `excludeIds` prop excludes exercises already in the bank, but inline-create can produce the same name as one already in the bank if the user types a colliding name. `exerciseSchema`'s async refine rejects on name conflict — same path as the regular Exercises sub-tab create. Picker doesn't need an additional guard.

E7b.20. **Migration 017 reapplied on a DB where 015 already added the constraints.** `IF NOT EXISTS` makes 017 a no-op. Discipline check, not a state change.

E7b.21. **Auto-wire `display_order` for the first-ever cardio/recovery activity.** The MAX query returns NULL on an empty `block_cardio_items` / `block_recovery_items`. `COALESCE(MAX(display_order), -1) + 1` resolves to 0 for the first row.

E7b.22. **Exercise muscle-groups taxonomy mismatch with seeded data.** Existing exercises seeded by Slice 2 have `muscle_groups` text[] values that should match the locked taxonomy. If a seeded row contains a value outside the 11-tag taxonomy (legacy or unforeseen), the multi-select form will not show a checkbox for it — the unrecognized tag is silently dropped on edit. Quality review flags this if the live DB has any exercise with an unrecognized tag; the cleanup is a one-shot SQL update or a future migration. Not blocking for 7b.

## 6. Test Cases

Manual end-to-end tests after Codex generation + Claude Code quality review. Mix of pre-test setup, schema verification, IA flows, per-surface CRUD flows, save-failure UX, cross-link contract, regression on existing surfaces, and code-quality gates.

### Pre-test setup

T0a. **Migration 017 applies cleanly.** Run `supabase db push`. No errors. `idx_cardio_activities_owner_name`, `idx_recovery_activities_owner_name`, `idx_block_lifting_items_block_exercise` all present in the DB (verify via Supabase Studio or `\d <table>`).

T0b. **Generated types regenerated.** Run `pnpm exec supabase gen types typescript --linked > src/lib/supabase/types.ts`. Verify Database type unchanged in shape (constraints don't appear in TS types) but file modtime updated, confirming the regen step ran.

T0c. **Dependencies installed.** `node_modules/react-hook-form`, `node_modules/zod`, `node_modules/@hookform/resolvers` all present. shadcn primitives present at `src/components/ui/{form,sheet,input,textarea,select,checkbox,label,popover,command}.tsx`.

### Library IA — fourth sub-tab

T1. **Four sub-tabs visible.** Navigate to `/library`. Redirects to `/library/lifting`. LibraryTabs strip shows four triggers: Lifting / Exercises / Cardio / Recovery. Lifting active.

T2. **Exercises sub-tab navigation.** Tap Exercises trigger. URL changes to `/library/exercises`. Exercises sub-tab active. List of exercises renders ordered alphabetically.

T3. **Sub-tab label fit at 375px.** Inspect bottom of viewport at exactly 375px width. All four sub-tab labels fit without truncation. (If truncation observed → Codex switches to `text-[10px]` per AC #8.)

T4. **Direct URL navigation.** Navigate to `/library/exercises` directly. Sub-tab loads, Exercises trigger active.

### Lifting sub-tab — Block Create flow

T5. **Add lifting block CTA.** On `/library/lifting`, "Add lifting block" button visible at the top of the list.

T6. **Create flow lands on form.** Tap CTA. URL changes to `/library/lifting/blocks/new`. BlockForm renders in create mode with empty fields. `block_category` Select shows three options; default "lifting." `block_type` Select visible (because category is lifting). Bank composition section renders empty.

T7. **Block name uniqueness — async pre-check.** In the name field, type `"Bench Press Focus"` (an existing block name). Tab away. Inline error appears: `"A block with this name already exists."`. Submit button disabled while error present.

T8. **Block name uniqueness — DB final guard.** Type a unique name that passes the async check. From a different browser session (or Supabase Studio), insert a `blocks` row with the same name + same `owner_user_id`. Submit the original form. DB-level 23505 surfaces as inline error on the name field: `"Name already exists."`.

T9. **`block_category` change updates form structure.** Switch `block_category` to cardio. `block_type` Select disappears. Bank composition section disappears. Submit button copy reads `"Create cardio block"`.

T10. **`block_type` required for lifting.** Set `block_category` to lifting. Leave `block_type` blank. Submit. Form blocks with error `"Lifting blocks require a block type"` on the `block_type` field.

T11. **Add exercise to bank (existing exercise pick).** With `block_category=lifting` and a name + type filled, tap "Add exercise to bank." Picker Sheet opens. Search for `"Squat"` in the picker. Tap Squat. Picker closes. Bank now shows one row: Squat. `display_order = 0`.

T12. **Inline-create exercise from picker.** Tap "Add exercise to bank" again. Picker opens. Tap `"+ Create new exercise"`. Nested ExerciseEditSheet opens in create mode. Fill `name="Test Pistol Squat"`, `muscle_groups=[legs]`, `prescribed_min=8`, `prescribed_max=12`. Submit. Nested Sheet closes; picker's exercise list refreshes; new exercise auto-selected; picker closes; bank now shows two rows: Squat (`display_order=0`), Test Pistol Squat (`display_order=1`).

T13. **Reorder bank.** Tap ↑ on the second row. Test Pistol Squat moves up; bank order is now Test Pistol Squat (0), Squat (1).

T14. **Reorder boundary.** Tap ↑ on the first row (Test Pistol Squat). Button is disabled (no state change). Tap ↓ on the second/last row (Squat). Button is disabled.

T15. **Remove exercise from bank.** Tap remove on Squat. Bank now shows only Test Pistol Squat.

T16. **Submit creates block + bank rows.** Submit the form. Loading state shows. On response: redirect to `/library/lifting/blocks/[new_block_id]`. New block detail page renders with name + type + the bank composition (Test Pistol Squat with prescribed range from the exercise's own `prescribed_min/max`).

T17. **DB check post-create.** Supabase Studio: new row in `blocks` with correct `owner_user_id`, `block_name`, `block_category=lifting`, `block_type`. New row in `block_lifting_items` with the new `block_id` + Test Pistol Squat `exercise_id` + `display_order=0`.

### Lifting sub-tab — Block Update flow

T18. **Edit button on block detail.** Navigate to `/library/lifting/blocks/[some_block_id]`. Edit button visible in header.

T19. **Edit flow lands on form.** Tap Edit. URL changes to `/library/lifting/blocks/[id]/edit`. Form renders in edit mode with all fields pre-filled. `block_category` shown as static text (`"Lifting block"`); no Select visible.

T20. **`block_type` warning on change.** With a block that has historical `set_logs` (e.g., a block referenced by ≥ 1 set_log row from a logged workout), open edit. Change `block_type` from current value (e.g., failure) to mobility. Below the Select, informative copy appears: `"[N] historical sets were logged under failure protocol. Changing this affects future logs only."` where N is the actual count.

T21. **`block_type` warning hides on revert.** Change `block_type` back to original value. Warning disappears.

T22. **`block_type` warning skipped if zero history.** Open edit on a block with zero `set_logs` (e.g., a freshly-created block from T16). Change `block_type`. No warning appears.

T23. **Bank composition edit.** Add a new exercise via the picker. Reorder. Remove an exercise. Submit. Block detail page reflects the new bank composition.

T24. **DB check post-update.** Supabase Studio: `blocks` row reflects updated `block_name` + `block_type`. `block_lifting_items` rows for this block reflect the new bank: deleted rows gone, new rows present, `display_order` matches the form's order.

### Exercises sub-tab — Create + Update

T25. **Add exercise CTA.** On `/library/exercises`, "Add exercise" button visible at the top of the list.

T26. **Create exercise via Sheet.** Tap Add. Sheet opens from the bottom (mobile). Form renders with empty fields. Fill name, muscle groups (multi-select), `is_bodyweight`, prescribed range, notes. Submit. Sheet closes; list re-fetches; new exercise visible in the alphabetical list.

T27. **Edit exercise via pencil.** Tap pencil icon on any exercise row. Sheet opens with pre-filled fields. Change name. Submit. Sheet closes; list reflects the new name.

T28. **Muscle-group multi-select.** Open exercise edit. Tap muscle-groups trigger button. Popover opens with two grouped sections (Primary 7 + Specific 4). Tap to add/remove selections. Tap Done. Trigger button reflects updated count.

T29. **Required muscle group validation.** Try to submit with zero muscle groups selected. Error appears: `"Pick at least one muscle group"`.

T30. **Prescribed range validation.** Set `prescribed_min=10`, `prescribed_max=5`. Submit. Error on `prescribed_max`: `"Maximum reps must be ≥ minimum reps"`.

T31. **Exercise name uniqueness.** Try to create an exercise with the same name as an existing one. Async pre-check catches: inline error on name field.

T32. **Notes propagation (Q5b correction verification).** Edit Squat exercise; change notes to `"7b notes test"`. Save. Navigate to a block whose bank includes Squat (`/library/lifting/blocks/[id_with_squat]`). Squat's notes display the new value `"7b notes test"`. (Verifies the schema model: notes are exercise-global, not per-block.)

### Cardio sub-tab — Create + Update

T33. **Add cardio activity CTA.** On `/library/cardio`, "Add cardio activity" button visible.

T34. **Create cardio activity via Sheet.** Tap Add. Sheet opens. Fill name, format, distance, target zone, description. Submit. Sheet closes; list re-fetches; new activity visible in the cardio block's expanded list.

T35. **DB check — junction populated.** Supabase Studio: new row in `cardio_activities`. New row in `block_cardio_items` wiring the new activity to Marcus's single cardio block with `display_order = MAX(prior) + 1`.

T36. **Edit cardio activity via pencil.** Tap pencil on any cardio activity row. Sheet opens with pre-filled fields. Change description. Submit. List reflects new description.

T37. **Cardio activity name uniqueness.** Try to create with an existing name. Async refine catches; inline error.

### Recovery sub-tab — Create + Update

T38. **Add recovery activity CTA.** On `/library/recovery`, "Add recovery activity" button visible.

T39. **Create recovery activity.** Tap Add. Sheet opens. Fill name + description. Submit. Sheet closes; list shows new activity.

T40. **DB check — junction populated.** New row in `recovery_activities`. New row in `block_recovery_items` wiring to recovery block.

T41. **Edit recovery activity.** Tap pencil. Edit description. Submit. List reflects update.

### Save failure UX

T42. **Network failure on submit.** Disable network in devtools. Open exercise create Sheet. Fill fields. Submit. Inline error: `"Save failed — please retry."` with retry button. Re-enable network. Tap retry. Save succeeds.

T43. **Discard-edit confirmation.** Open exercise edit Sheet. Change name. Without saving, tap outside Sheet (or close button). DiscardChangesDialog appears: `"Discard changes?"` with Cancel / Discard. Tap Cancel. Sheet stays open, fields preserved. Tap Discard. Sheet closes, no changes saved.

T44. **Block edit form submit pending state.** During submit, the submit button shows a spinner and is disabled. Form fields are also disabled (preventing edits during the in-flight save).

### Cross-link contract enforcement

T45. **`grep` check on cross-links.** Search src/ for `/library/lifting/blocks/` paths outside `crossLinks.ts` and `BlockLink.tsx`. Should return zero matches.

T46. **`grep` check on next/link in form components.** Form components (BlockForm, ExerciseForm, CardioActivityForm, RecoveryActivityForm) have no direct `next/link` import. Navigation post-submit goes through `router.push` (from `useRouter()`) using href helpers from `crossLinks.ts`.

### Regression on existing surfaces

T47. **7a Library read flows.** Navigate to `/library/lifting`, `/library/cardio`, `/library/recovery`. All three render as before; the new affordances (Add CTA, Edit pencil, Edit button on detail) coexist with the existing read content.

T48. **Today / Plan / Logger / History.** Smoke-test each tab. No errors, no behavioral change. Logger flow on a today's lifting workout still works; PR detection still fires.

T49. **Bottom nav.** Six tabs at 10px, Library tab still active for `/library/*` routes via `startsWith`.

### Code quality gates

T50. **`pnpm lint`** clean.

T51. **`pnpm typecheck`** clean. Form value types correctly inferred from zod schemas.

T52. **`pnpm format:check`** clean.

T53. **`pnpm-lock.yaml`** committed; new deps reflected.

T54. **No new console errors during the full T1-T49 sequence.** Browser devtools console clean.

## 7. Codex Generation Prompt (Phase 4A)

```
CONTEXT:
Slice 7b of training-app — Library tab Create + Update affordances on top of
Slice 7a's read scaffold. Stack: Next.js 15 App Router with React 19,
TypeScript strict, Tailwind + shadcn/ui, Supabase (existing instance with RLS
enforced), pnpm + Node 20 LTS. Adds the project's first multi-field cross-
validated forms — RHF + zod + shadcn Form is the form-library trigger event
deferred from Slices 1 and 4. One small migration (017). Major UI surface:
fourth Library sub-tab (Exercises), full-page block edit + create routes,
Sheet modal edit for exercises / cardio / recovery activities.

The full spec is in spec/slices/SLICE_7B_LIBRARY_EDIT.md. Read it end-to-end
before generating. The spec docs in spec/ (PROJECT_BRIEF.md, MASTER_SPEC.md,
ARCHITECTURE.md) are the project constitution. AGENTS.md at the root contains
the rules for this build (rule 8 mandates RHF + zod for multi-field forms).
CLAUDE.md governs the post-generation review pass. DECISIONS.md has the locked
project decisions including Slice 7a's Library scaffold and Slice 7b's
nine Phase 0 lockdowns. KNOWN_ISSUES.md tracks live KIs. Read all of these
before generating.

TASK:
Implement everything in Sections 3 and 4 of SLICE_7B_LIBRARY_EDIT.md:

1. Migration 017 (UNIQUE constraints on cardio_activities, recovery_activities,
   block_lifting_items — guarded with IF NOT EXISTS for idempotency).
2. Install dependencies: react-hook-form, zod, @hookform/resolvers. Pin
   versions to latest stable that supports React 19. Update pnpm-lock.yaml.
3. Install shadcn primitives via pnpm dlx shadcn add: form, sheet, input,
   textarea, select, checkbox, label, popover, command. Each generates a file
   under src/components/ui/.
4. Library data layer additions: src/lib/library/schemas.ts,
   src/lib/library/mutations.ts, src/lib/library/uniqueness.ts. Modifications
   to src/lib/library/queries.ts (add getExercises + getHistoricalSetLogCount),
   src/lib/library/projections.ts (add ExerciseListItem), src/lib/library/
   crossLinks.ts (add exerciseDetailHref, blockEditHref, blockCreateHref).
5. Library route shells (/library/exercises, /library/lifting/blocks/new,
   /library/lifting/blocks/[block_id]/edit).
6. Library form components (BlockForm with bank composition + ExercisePicker
   + inline-create flow; ExerciseForm + ExerciseEditSheet +
   MuscleGroupMultiSelect; CardioActivityForm + CardioActivityEditSheet;
   RecoveryActivityForm + RecoveryActivityEditSheet; AddBlockButton,
   AddExerciseButton, AddCardioActivityButton, AddRecoveryActivityButton;
   EditBlockButton; EditPencilButton; ExerciseListCard; BankComposition;
   BankItemRow; MoveButton; DiscardChangesDialog).
7. Modifications to existing 7a routes (lifting, cardio, recovery sub-tabs)
   to add the CTAs and per-row pencil icons.
8. Modifications to LibraryTabs to support the fourth Exercises tab.
9. Modifications to existing Library card components (CardioActivityCard,
   RecoveryActivityCard) to append EditPencilButton.

CONSTRAINTS:

- Migration immutability: zero edits to migrations 001-016.
- Migration 017 MUST use IF NOT EXISTS guards on every CREATE UNIQUE INDEX
  statement so the migration is idempotent against any DB state where the
  constraints might already exist from migration 015 (cardio_activities and
  recovery_activities unique indexes are spec'd in 015 AC #3 but defensive
  guarding is the correct pattern).
- TypeScript strict mode. No any. No widening casts.
- Module boundaries: src/lib/library/ stays pure (no React imports); React
  components live under src/app/(app)/library/_components/ or
  src/components/shared/; forms are Client Components ('use client');
  route entries (page.tsx) are Server Components; data fetching happens at
  the route layer.
- Mutations use the supabase BROWSER client (createClient from
  @/lib/supabase/client), NOT the server client, NOT a Server Action.
  Per ARCHITECTURE §1: "No Server Actions for mutations."
- Library writes do NOT integrate with the Slice 5 sync queue. Direct supabase
  calls with pessimistic-then-update + inline retry on failure.
- 23505 unique-violation translates to friendly "Name already exists" inline
  error. NO silent failure.
- block_category is immutable post-creation: edit form omits the Select.
- block_type is editable on lifting blocks with the historical-set-log
  warning per AC #22.
- Form library: zod schemas in src/lib/library/schemas.ts; types via z.infer;
  RHF integration via @hookform/resolvers/zod and shadcn <Form>. NO hand-rolled
  form value types.
- Async name uniqueness via zod .refine() pattern, with own-id exclusion in
  edit mode.
- Move-up / move-down reorder buttons. NO drag-drop library.
- Sub-tab label sizing: at 375px viewport, four labels (Lifting / Exercises /
  Cardio / Recovery) must fit without truncation. Codex measures and switches
  to text-[10px] across all four if needed.
- Inline-create exercise from block edit: nested Sheet, on success refreshes
  the picker list and auto-selects the new exercise.
- Pencil icon on cardio/recovery rows + on exercise rows. Tap opens edit Sheet.
- Block edit and create are full-page routes (/library/lifting/blocks/[id]/edit
  and /library/lifting/blocks/new), NOT modals.
- Discard-edit confirmation on Sheet close + browser-back per AC #42.
- Delete is OUT OF SCOPE for 7b. Do not generate any delete affordance, route,
  or mutation helper.

LIVE SCHEMA REFERENCE (use exact column names — do NOT invent):

blocks: block_id (PK), owner_user_id (FK auth.users.id), block_name (text),
  block_type (block_type_enum: failure | mobility | corrective | NULL for
  non-lifting), block_category (block_category_enum: lifting | cardio |
  recovery), display_order (integer, vestigial in global model — leave alone).
  UNIQUE (owner_user_id, block_name) from migration 013.

exercises: exercise_id (PK), user_id (FK auth.users.id), name (text),
  notes (text), prescribed_min (integer), prescribed_max (integer),
  muscle_groups (text[]), is_compound (boolean), is_bodyweight (boolean from
  migration 009). UNIQUE (user_id, name) from migration 002 / Slice 2's seed
  keying.

block_lifting_items: block_id (FK), exercise_id (FK), display_order (integer).
  PK (block_id, exercise_id) — verified in 7b migration 017.

cardio_activities: activity_id (PK), owner_user_id (FK), name (text),
  cardio_format (cardio_format_enum: speed_run | endurance_run | basketball),
  cardio_distance (text NULL), cardio_target_zone (cardio_target_zone_enum:
  sprint | zone_2 | anaerobic | game_pace), description (text NULL),
  created_at, updated_at. UNIQUE (owner_user_id, name) from migration 015 +
  verified in 017.

recovery_activities: activity_id (PK), owner_user_id (FK), name (text),
  description (text NULL), created_at, updated_at. UNIQUE (owner_user_id,
  name) from migration 015 + verified in 017.

block_cardio_items: block_id (FK), activity_id (FK to cardio_activities),
  display_order (integer). PK (block_id, activity_id).

block_recovery_items: block_id (FK), activity_id (FK to recovery_activities),
  display_order (integer). PK (block_id, activity_id).

set_logs: set_logs.block_id is a FK to blocks. The block_type warning's count
  query is: SELECT COUNT(*) FROM set_logs WHERE block_id = $1 AND
  user_id = auth.uid().

ACCEPTANCE CRITERIA:
See SLICE_7B_LIBRARY_EDIT.md Section 2 — all 66 criteria.

DO NOT:

- Add files outside Section 3
- Build any feature beyond what's specified in Sections 4-6
- Add Delete affordances anywhere — 7b is Create + Update only
- Add drag-drop, animation libraries, or state management libraries
- Use Server Actions for mutations
- Integrate with the Slice 5 sync queue
- Modify migrations 001-016
- Modify spec docs (MASTER_SPEC, ARCHITECTURE, PROJECT_BRIEF, DECISIONS,
  KNOWN_ISSUES, FUTURE_WORK, AGENTS, CLAUDE)
- Modify wiki content (supabase/seed/wiki/*)
- Modify the seed pipeline (supabase/seed/* — Library editing replaces seed
  for day-to-day catalog maintenance)
- Modify Today / Plan / Logger / History / Sync / Auth files unless explicitly
  required by AC (AC #50-52 say these stay unchanged)
- Use polymorphic FKs at DB level beyond the documented exception
  (workout_blocks.preset_activity_id from 7a)
- Leave placeholder TODOs or stubbed functions
- Skip the muscle-group taxonomy (the locked 11-tag set from MASTER_SPEC §11
  + Slice 2 granular tags: Chest / Shoulders / Back / Arms / Legs / Core /
  Calves + Lats / Upper Back / Teres Major / Rear Delts)

OUTPUT:
Write the complete implementation. Do not explain — just produce the code. At
the end, list:

- Every column name referenced (so I can diff against the live schema)
- Every shadcn primitive added via pnpm dlx shadcn add
- Every dependency added to package.json with version
- Every file created or modified vs Section 3's allowlist (any deviations)
- Every assumption made that was not explicit in the prompt
- Confirmation that all 66 acceptance criteria are addressable in the produced
  code (mark any AC you couldn't address and why)
- Any DB-level constraint violations encountered during a self-test run
  (RHF refine failures, 23505 races, etc.)
```

## 8. Claude Code Quality Review Prompt (Phase 4B — MANDATORY after Codex)

```
CONTEXT:
Slice 7b of training-app — Library tab Create + Update affordances. Codex
just generated migration 017, the form library install (RHF + zod + shadcn
primitives), the Library data layer additions (schemas, mutations, uniqueness),
the new editing routes, and the form components. This is the project's first
multi-field cross-validated form surface. Form library precedent set here will
shape every later editing surface (Plan Editor in Slice 8, Nutrition logging,
etc.).

Spec sources:

- spec/slices/SLICE_7B_LIBRARY_EDIT.md (this slice doc)
- DECISIONS.md (locked decisions; Slice 7b entries to be added in post-slice
  sequence)
- AGENTS.md rule 8 (RHF + zod is project standard for multi-field forms)
- spec/MASTER_SPEC.md and spec/ARCHITECTURE.md (Library tab sections from 7a)

FILES CODEX TOUCHED (read every one):
[Full file list from Section 3 of SLICE_7B_LIBRARY_EDIT.md.]

REVIEW CHECKLIST:

1. Schema fidelity (Migration 017)

   - Migration 017 uses CREATE UNIQUE INDEX IF NOT EXISTS on every constraint
     creation. Idempotent if 015 / 002 already added them.
   - Index names follow the existing convention: idx_<table>_<columns>.
   - No edits to migrations 001-016.
   - Generated types regen step was run; src/lib/supabase/types.ts file
     modtime updated.

2. Form library install

   - react-hook-form, zod, @hookform/resolvers all in package.json with
     pinned versions. pnpm-lock.yaml committed.
   - shadcn primitives installed: form, sheet, input, textarea, select,
     checkbox, label, popover, command. Each file present at
     src/components/ui/.
   - No alternative form library (Formik, react-final-form, etc.) introduced.

3. Zod schemas (src/lib/library/schemas.ts) — HEAVIEST CHECK

   - Four schemas exported: blockSchema, exerciseSchema, cardioActivitySchema,
     recoveryActivitySchema.
   - Each has appropriate field validation per AC.
   - Each has async .refine() for name uniqueness, with own-id exclusion in
     edit mode (own_id field on the schema input).
   - blockSchema's category-vs-type cross-field validation present (lifting
     requires block_type; cardio/recovery requires block_type IS NULL).
   - exerciseSchema's prescribed_max >= prescribed_min check present.
   - exerciseSchema's muscle_groups taxonomy uses the locked 11-tag set.
   - Type inference via z.infer preserved; no hand-rolled value types.

4. Mutation helpers (src/lib/library/mutations.ts)

   - All mutations use the supabase BROWSER client (createClient from
     @/lib/supabase/client), NOT the server client.
   - No Server Actions.
   - 23505 / 23514 / 42501 (RLS) translation to friendly errors present.
   - createCardioActivity and createRecoveryActivity wire the new activity
     to the user's single cardio/recovery block via block_cardio_items /
     block_recovery_items in a second statement; failure-mode toast
     handling per Edge case E7b.16.
   - updateBlock's bank-update is delete-then-insert against
     block_lifting_items; the function does NOT attempt a transactional
     upsert (no Postgres function call layer in 7b).
   - block_category is omitted from updateBlock's payload type — structurally
     unable to be edited.

5. Library routes

   - /library/exercises/page.tsx: Server Component, calls getExercises(),
     renders LibraryTabs activeTab="exercises" + AddExerciseButton +
     ExerciseListCard per row.
   - /library/lifting/blocks/new/page.tsx: Server Component shell, renders
     BlockForm mode="create".
   - /library/lifting/blocks/[block_id]/edit/page.tsx: Server Component shell,
     calls getBlockDetail + getHistoricalSetLogCount, renders BlockForm
     mode="edit" with pre-fills.
   - All three routes are Server Components at the page.tsx level.
   - Client Components ('use client') confined to the form-related components
     listed in Section 3.

6. Form behavior verification

   - BlockForm uses useWatch on block_category to drive conditional rendering
     of block_type Select and BankComposition section.
   - In edit mode, block_category renders as static text, NOT a Select.
   - block_type warning logic per AC #22: showWarning fires only when
     mode === 'edit' && historicalSetLogCount > 0 && currentType !== originalType.
   - DiscardChangesDialog triggered from Sheet onOpenChange when
     formState.isDirty and from any other close affordance (Cancel button,
     etc.).

7. Mutation flow verification

   - Form onSubmit calls into mutation helper, awaits, branches on { ok }.
   - Pessimistic pattern: button disabled during in-flight save (RHF
     formState.isSubmitting).
   - Success: Sheet closes / router.push (block create) / router.refresh
     (everything else).
   - Failure: setError on path (for field-specific errors like 23505) or
     toast (for non-field errors).

8. Inline-create flow (block edit context)

   - ExercisePicker renders nested ExerciseEditSheet on "+ Create new
     exercise" tap.
   - Nested Sheet's submit calls createExercise mutation; on success refreshes
     picker's list (router.refresh OR re-fetch hook).
   - New exercise auto-selected; both Sheets close; bank's append() runs.
   - Failure: nested Sheet stays open with error; picker stays open; no
     partial state.

9. Cross-link contract

   - exerciseDetailHref, blockEditHref, blockCreateHref all live in
     crossLinks.ts.
   - No hardcoded /library paths in form components or sub-tab pages outside
     crossLinks.ts.
   - Existing BlockLink, WorkoutLink, ExerciseLink unchanged.

10. Empty states

    - AC #11 Exercises sub-tab: "No exercises yet." with Add CTA.
    - 7a's existing empty states for Lifting, Cardio, Recovery preserved.

11. Module boundaries

    - src/lib/library/ has zero React imports.
    - Mutation helpers don't construct supabase clients internally — they
      take a SupabaseClient<Database> parameter from the caller (the form
      component creates and passes the browser client).
    - Schemas don't import React.

12. Strict TypeScript

    - tsconfig strict preserved.
    - No any. No widening casts.
    - z.infer derives form value types.
    - mutation helpers return discriminated unions ({ ok: true; data: T } |
      { ok: false; error: string }).

13. Performance + RLS

    - getExercises is one query (no N+1).
    - Zod async refine queries are scoped to the bare minimum (SELECT pk
      WHERE name = $value [AND pk != $own] LIMIT 2).
    - All RLS preserved — no table-level bypass via service role key.

14. Phase A surfaced findings to investigate (Phase A is yet to run for 7b).

AUTO-FIX vs FLAG:

Auto-fix (apply directly):
- Naming inconsistencies (rename to match contract)
- Missing error handling on queries / mutations
- Removed dead code, unused imports
- Removed leftover TODOs
- Schema drift on column names
- Removed 'use client' from Server Components that don't need it
- Hardcoded paths replaced with crossLinks.ts helpers
- 23505 / 23514 / RLS error code translations not in mutation helpers

Flag for approval (do not change without my response):
- Structural changes that affect more than this slice's allowlist
- Refactors that alter the API contract or folder structure
- Adding new dependencies beyond the spec'd RHF + zod + @hookform/resolvers
  + nine shadcn primitives
- Changes to spec docs
- Subjective styling preferences when the existing code is acceptable

CONSTRAINTS:

- Do not add features beyond the 66 ACs
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

- Did Codex correctly use the supabase BROWSER client for all mutations,
  not the server client?
- Is block_category strictly omitted from updateBlock's payload type?
- Does the inline-create-exercise flow correctly handle the picker refresh
  + auto-select sequence?
- Are async refine queries appropriately narrowed (SELECT pk ... LIMIT 2),
  not full row fetches?
- Is the muscle-group multi-select using the locked 11-tag taxonomy
  (Chest / Shoulders / Back / Arms / Legs / Core / Calves + Lats /
  Upper Back / Teres Major / Rear Delts)?
- Does the BlockForm correctly conditionally render based on useWatch on
  block_category?
- Is the historical-set-log count query using set_logs.block_id directly,
  not a join through block_lifting_items / exercises?
- Does Migration 017 use IF NOT EXISTS guards on every CREATE INDEX?
- Are all four sub-tab labels confirmed to fit at 375px without truncation?
```

## 9. Claude Code Debugging Prompt (Phase 4C — fill in CURRENT PROBLEM if tests fail)

```
CONTEXT:
Slice 7b of training-app — Library tab Create + Update affordances. Codex
generated, Claude Code quality review pass complete. Tests in Section 6 of
SLICE_7B_LIBRARY_EDIT.md are now being run.

CURRENT PROBLEM:
[Fill in: exact error message, screenshot transcription, or description of
which test is failing. Be specific — include the test number, browser console
output, server logs, network tab response (status + body), and the exact URL
/ action involved. For form validation issues, paste the form values that
were attempted + the resulting error path/message.]

RELEVANT FILES (default starting points for common failures):

- Migration apply failure → supabase/migrations/017_library_edit_uniqueness.sql
- Form validation failure → src/lib/library/schemas.ts +
  src/app/(app)/library/_components/{BlockForm | ExerciseForm |
  CardioActivityForm | RecoveryActivityForm}.tsx
- Async uniqueness refine failure → src/lib/library/uniqueness.ts +
  src/lib/library/schemas.ts (the .refine() call)
- Mutation failure → src/lib/library/mutations.ts +
  src/app/(app)/library/_components/{form file}.tsx (the onSubmit handler)
- Inline-create-exercise flow failure →
  src/app/(app)/library/_components/{ExercisePicker | ExerciseEditSheet |
  BankComposition}.tsx
- Sub-tab navigation failure →
  src/app/(app)/library/_components/LibraryTabs.tsx +
  src/app/(app)/library/{lifting | exercises | cardio | recovery}/page.tsx
- Discard-edit confirmation failure →
  src/app/(app)/library/_components/DiscardChangesDialog.tsx + the form
  component invoking it
- Bank reorder failure → src/app/(app)/library/_components/BankItemRow.tsx +
  BankComposition.tsx + MoveButton.tsx
- Cardio/recovery activity create failure (junction table not populated) →
  src/lib/library/mutations.ts (createCardioActivity / createRecoveryActivity)
- Database constraint violations on submit →
  supabase/migrations/017_library_edit_uniqueness.sql + the relevant 7a
  migration that established the constraint (013, 015)
- Type errors → src/lib/library/schemas.ts + src/lib/supabase/types.ts
  (regenerated post-017)
- Cross-link / routing errors → src/lib/library/crossLinks.ts +
  src/app/(app)/library/{...}/page.tsx

DEBUGGING APPROACH:

1. Reproduce the error with exact steps from the test case.
2. Inspect the network tab in browser devtools for the failed request:
   status code, response body, request payload.
3. Match the error against the AC. Is the failure a deviation from the spec,
   a Codex-generated bug, or a quality-review-introduced regression?
4. Check the relevant DECISIONS.md / locked Phase 0 lockdowns. Has the test
   case violated a lockdown? (e.g., are we testing a Delete affordance that
   was supposed to be out of scope?)
5. If the failure is in form validation: print zod's safeParse / safeParseAsync
   result. Is the schema error message what we expect?
6. If the failure is in mutation submit: log the mutation helper's input +
   output. Is 23505 being correctly translated?
7. If the failure is RLS-related: verify the user's auth.uid() matches the
   row's owner_user_id / user_id.

OUTPUT:

1. Root cause analysis (one paragraph)
2. Fix proposal (file + change description)
3. Whether the fix is in-scope for 7b or should be a 7b.5 corrective slice
4. Updated test plan if the fix changes any test's expected behavior
5. KNOWN_ISSUES.md entry if the underlying issue is a latent bug from a prior
   slice (in which case the entry is the work product, not the fix)
```
