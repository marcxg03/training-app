# SLICE_4_WORKOUT_LOGGER.md

## 1. Goal

Build the Workout Logger — the first write-side slice. Per-session logging UI at `/log/[session_id]` with linear block-by-block walkthrough, support for failure / mobility / corrective block protocols, exercise picker from bank, set logging with prescribed range pinned at write time, PR detection (Type A weight + Type B in-range rep) with inline badge feedback, abandoned-session resume, and a session-complete summary screen.

## 2. Acceptance Criteria

### Schema and migrations
1. New migration `009_workout_logger.sql` creates `set_logs`, `session_completions`, and adds `is_bodyweight` column to `exercises` (default false). Migration is append-only — does not modify any existing migration file.
2. Migration `010_extended_rls.sql` adds RLS policies for `set_logs` (4-policy pattern: select_own, insert_own, update_own, delete_own) and `session_completions` (4-policy pattern). RLS enabled on both tables. `pr_history` policies remain unchanged from migration 008 (still SELECT + INSERT only).
3. Seed script updated to mark known bodyweight exercises (Muscle Ups, Dips, Push-Ups, Pull-Ups, Chin-Ups, etc.) as `is_bodyweight=true`. Idempotent re-run produces zero changes after first apply.
4. Generated `src/lib/supabase/types.ts` reflects the new schema.

### Logger entry and routing
5. `/log/[session_id]` (replacing the Slice 3 placeholder) loads, validates that the session exists and belongs to the current user (RLS handles the latter; explicit defensive check redirects to `/today` on null result).
6. Logger validates that today's `day_of_week` matches the session's parent `daily_schedules.day_of_week` — sessions are logable only on their scheduled day. If mismatch, redirect to `/today` (no error toast).
7. On entry, Logger checks for an existing `session_completions` row for this `(user_id, session_id, started_at>=today)` — if found and `completed_at IS NULL`, it's an in-progress session; resume at the last incomplete block. If found and completed, redirect to `/today` (already done). If not found, create a new `session_completions` row with `started_at = now()` and start at Block 1.

### Block-by-block walkthrough (linear)
8. Logger opens at the first incomplete block (resume position, or Block 1 if fresh start).
9. Header shows session name + block N of M progress indicator + "End session early" link in the corner.
10. Body shows the current block's name, block_type badge (failure / mobility / corrective), and the exercise picker from the block's bank.
11. User selects one exercise from the bank. The picker is a tappable list; selecting commits the exercise for this block and reveals the set entry UI.
12. Once an exercise is selected for a block, it cannot be changed in this slice (Slice 4.5 polish: allow swap before any sets are logged).
13. After the last set of a block is logged and confirmed, Logger automatically advances to the next block. Smooth transition (Next.js navigation or in-page state).

### Failure block protocol (WU + W1 + W2)
14. For `block_type='failure'`: prompts for exactly 3 sets in order — WU, W1, W2.
15. WU set entry: weight + reps fields. `is_to_failure=false`. Saves on submit.
16. W1 set entry: same fields. `is_to_failure=false`. Saves on submit.
17. W2 set entry: weight + reps fields + a "to failure" checkbox (default checked). `is_to_failure` reflects the checkbox state. Saves on submit.
18. After W2, block is marked complete; Logger advances.

### Mobility / corrective block protocol (free-form)
19. For `block_type='mobility'` or `block_type='corrective'`: free-form set entry. User taps "Add set" repeatedly to add sets. Each set has weight + reps fields. `is_to_failure=false` always. No "WU/W1/W2" labels — sets are numbered 1, 2, 3, etc.
20. User taps "Done with this block" to advance.
21. Mobility/corrective blocks can have any number of sets ≥ 1.

### Exercise picker
22. Picker lists every exercise in the block's bank (joined via `block_exercises`).
23. Each row shows: exercise name, prescribed range (`prescribed_min × prescribed_max` reps, formatted as e.g., "6–8 reps"), muscle group caption (high-level group from `muscle_groups[0]`), and a "bodyweight" tag if `is_bodyweight=true`.
24. Tapping a row selects that exercise for the block. The other rows hide; only the selected exercise remains visible above the set entry UI.

### Set logging — write contract
25. On submit of a set, the following fields are written to `set_logs`:
    - `set_log_id` (uuid, generated)
    - `user_id` (current auth user)
    - `session_id` (current session)
    - `block_id` (current block)
    - `exercise_id` (selected exercise)
    - `set_index` (1, 2, 3 for failure; 1, 2, 3, ... for mobility/corrective)
    - `weight_kg` (numeric, nullable if `is_bodyweight=true` for the exercise)
    - `reps` (int)
    - `is_to_failure` (bool — only true for W2 of failure blocks when checkbox is checked)
    - `prescribed_min` (int — pinned from `exercises.prescribed_min` at write time)
    - `prescribed_max` (int — pinned from `exercises.prescribed_max` at write time)
    - `notes` (text, nullable)
    - `logged_at` (timestamp, default now())
26. `prescribed_min` and `prescribed_max` are read from `exercises` once at write time and snapshotted onto the set_log row. Future edits to `exercises.prescribed_min/max` do NOT retroactively change historical set_logs.
27. Set submission is a single Supabase insert. If insert fails (network error, RLS rejection, etc.), surface a clear error to the user and do NOT advance the protocol — the set must be re-submitted.

### PR detection
28. After every successful set insert, run PR detection in this order:
    a. Skip if `is_bodyweight=true` for the exercise (Type A doesn't apply; Type B logic also gated since rep ranges for bodyweight are different in nature — defer to FUTURE_WORK.md).
    b. Skip if reps < 1 (no zero-rep PRs).
    c. **Type A — Weight PR ladder**: if this set's `weight_kg` is strictly greater than the highest `weight_kg` ever recorded for this `(user_id, exercise_id)` in `pr_history` where `pr_type='weight'`, insert a new `pr_history` row with `pr_type='weight'`, `weight_kg`, `reps`, `set_log_id` (the new set_log), `achieved_at = logged_at`.
    d. **Type B — In-Range Rep PR**: if this set's `reps` falls within `[prescribed_min, prescribed_max]` (inclusive both ends, using the pinned values from this set_log) AND this set's `reps` is strictly greater than the highest `reps` ever recorded for this `(user_id, exercise_id)` in `pr_history` where `pr_type='reps'` AND `weight_kg = this_set.weight_kg`, insert a new `pr_history` row with `pr_type='reps'`, the weight, reps, set_log_id, achieved_at.
    e. Both A and B can fire on the same set (e.g., a new heaviest weight that also falls in range).
29. If a PR is detected, the just-saved set in the UI shows a small lilac "PR" badge inline. The badge is non-blocking — Logger continues normally.
30. PR detection failure (e.g., pr_history insert rejection) does NOT block protocol advancement. The set is logged; the PR is missed. Log to console and continue. (Slice 5 sync layer will retry.)

### Abandoned-session resume
31. If user closes the browser / loses network / navigates away mid-block, the next time they open `/log/[session_id]` for an in-progress session_completion (today, completed_at IS NULL), Logger resumes at the last incomplete block.
32. "Last incomplete block" = the lowest-display-order block that does NOT have all required sets logged. For failure blocks, "all required sets" = 3 (WU, W1, W2). For mobility/corrective blocks, the block is considered complete only if the user explicitly tapped "Done with this block" (which is recorded — see criterion 33).
33. To track "block done" for mobility/corrective blocks (which have no fixed set count), `session_completions` includes a `completed_block_ids: uuid[]` array column. When user taps "Done with this block" on mobility/corrective, append the block_id to this array. Failure blocks are inferred complete from set count (3 sets logged).
34. Already-logged sets remain visible when resumed. User can scroll back to see prior blocks (read-only on the resume view; current incomplete block is interactive).

### "End session early" path
35. The "End session early" link is available at any time during logging.
36. Tapping it shows a confirmation dialog ("End session now? Any incomplete blocks will be marked as skipped"). On confirm: write `completed_at = now()` and `was_ended_early = true` on the `session_completions` row. Navigate to the session-complete summary screen.

### Session-complete summary
37. When user finishes the last block (failure W2 of last block, OR explicit "Done" on last mobility/corrective block, OR "End session early"), Logger writes `completed_at = now()` to `session_completions` and navigates to the summary screen.
38. Summary screen shows:
    - Session name + completion timestamp
    - Total sets logged across all blocks
    - Total reps logged
    - Approximate total volume (sum of weight_kg × reps for non-bodyweight sets)
    - PR list — every PR detected during this session, with exercise name, weight, reps, type (A or B)
    - "Back to today" button → navigates to `/today`
39. Summary is read from `set_logs` and `pr_history` joined for this session. Server Component, single round trip if possible.

### Edge cases
40. Logger does not allow logging on a day that doesn't match the session's day_of_week (criterion 6).
41. Logger does not allow logging when the session_completions row is already `completed_at IS NOT NULL` (criterion 7).
42. Set submission with empty reps field shows an inline validation error; does not submit.
43. Set submission with weight=0 for a non-bodyweight exercise shows an inline validation error ("Enter a weight or mark this exercise as bodyweight in your plan").
44. Set submission with weight populated for a bodyweight exercise: weight is ignored / overridden to null (graceful).
45. PR detection runs on the just-inserted set, even on resume after a crash (in case the session was interrupted before PR detection completed). Idempotency: pr_history insert with the same `set_log_id` and `pr_type` is a no-op (handled via unique constraint or explicit pre-check).

### Other tabs
46. Plan tab, Today tab, History tab, Nutrition tab, Settings tab continue to render their existing content. Slice 4 does not modify any of those routes' logic.
47. Today tab's existing "Start Workout" button (Slice 3) navigates to `/log/[session_id]` and now lands in the real Logger instead of the placeholder.

### Code quality
48. `pnpm lint` clean
49. `pnpm typecheck` clean
50. `pnpm format:check` clean
51. `git status` shows only expected new and modified files

## 3. Files to Create or Modify

**Create:**
- `supabase/migrations/009_workout_logger.sql` — set_logs table, session_completions table, is_bodyweight column on exercises
- `supabase/migrations/010_extended_rls.sql` — RLS policies for set_logs and session_completions
- `supabase/seed/lib/bodyweight-exercises.ts` — list of known bodyweight exercise names (Muscle Ups, Dips, Push-Ups, Pull-Ups, Chin-Ups; extensible)
- `src/app/(app)/log/[session_id]/page.tsx` — REPLACE the Slice 3 placeholder with the real Logger entry point
- `src/app/(app)/log/[session_id]/summary/page.tsx` — session-complete summary screen
- `src/components/log/LoggerShell.tsx` — wraps the linear walkthrough flow, handles resume logic
- `src/components/log/BlockHeader.tsx` — current block name, type badge, progress N of M
- `src/components/log/ExercisePicker.tsx` — bank list, tappable selection
- `src/components/log/FailureProtocol.tsx` — WU/W1/W2 set entry for failure blocks
- `src/components/log/FreeFormProtocol.tsx` — free-form set entry for mobility/corrective blocks
- `src/components/log/SetEntryForm.tsx` — single set entry form (weight, reps, optional failure checkbox); used by both protocols
- `src/components/log/SetLogRow.tsx` — display of a logged set (read-only after submit)
- `src/components/log/PRBadge.tsx` — small lilac "PR" indicator
- `src/components/log/EndSessionDialog.tsx` — confirmation dialog for ending early
- `src/components/log/SessionSummary.tsx` — summary screen content (used by /log/[session_id]/summary)
- `src/lib/methodology/pr-detection.ts` — Type A and Type B detection logic, pure functions, server-side
- `src/lib/methodology/session-state.ts` — helpers for reading session_completions, determining last incomplete block, etc.

**Modify:**
- `supabase/seed/seed-from-wiki.ts` — call into bodyweight-exercises.ts to mark `is_bodyweight=true` on the appropriate exercise rows during upsert
- `src/lib/supabase/types.ts` — regenerated to include set_logs, session_completions, exercises.is_bodyweight
- `package.json` — no new deps expected; verify no addition needed

**Files NOT to touch:**
- `src/components/plan/`, `src/components/today/`, `src/components/ui/`, `src/lib/supabase/env.ts`, `src/lib/supabase/client.ts/server.ts/middleware.ts`, `src/middleware.ts`, all prior migrations 001–008, all prior seed files except seed-from-wiki.ts, CLAUDE.md, AGENTS.md, ARCHITECTURE.md, MASTER_SPEC.md, PROJECT_BRIEF.md.

## 4. Component / Function Contracts

### `getOrCreateSessionCompletion(sessionId, userId): SessionCompletion`
- Input: session_id and user_id
- Output: existing or newly-created session_completions row for today
- Behavior: query for `(user_id, session_id, started_at >= today_midnight, completed_at IS NULL)`. If found, return. If not, insert new row with `started_at = now()` and return.
- Side effects: may insert a row.

### `findLastIncompleteBlock(sessionId, userId): Block | null`
- Input: session_id, user_id
- Output: the lowest-display-order block in the session that is NOT yet complete, or null if all blocks are complete
- Logic per block_type:
  - failure: block is complete iff there are exactly 3 set_logs with this block_id for this user (WU, W1, W2)
  - mobility / corrective: block is complete iff its block_id is in `session_completions.completed_block_ids[]`

### `detectPRs(setLog, userId): PRDetection[]`
- Input: a just-inserted set_log row, user_id
- Output: array of zero, one, or two PR detections (Type A weight, Type B in-range reps)
- Logic:
  - Skip if exercise is bodyweight, skip if reps < 1
  - Type A: query max weight_kg from pr_history for (user_id, exercise_id, pr_type='weight'). If setLog.weight_kg > max, return Type A detection.
  - Type B: check if setLog.reps in [setLog.prescribed_min, setLog.prescribed_max]. If yes, query max reps from pr_history for (user_id, exercise_id, pr_type='reps', weight_kg = setLog.weight_kg). If setLog.reps > max, return Type B detection.
- Pure logic (no side effects). Caller writes the pr_history rows.

### `insertPR(detection, setLogId): PRRow`
- Input: a PR detection + the set_log_id that triggered it
- Output: the inserted pr_history row
- Side effect: one insert to pr_history. If the set_log_id + pr_type combo already exists (idempotency), no-op.

### `LoggerShell` component
- Props: `{ session: Session, blocks: Block[], userId: string, sessionCompletion: SessionCompletion }`
- Renders: BlockHeader + ExercisePicker (if no exercise selected for current block) + Protocol component (FailureProtocol or FreeFormProtocol based on block.block_type)
- Manages: current block index, current selected exercise, advance-to-next-block logic
- Client Component (state-heavy)

### `FailureProtocol` component
- Props: `{ block: Block, exercise: Exercise, userId: string, onComplete: () => void, onPR: (pr) => void }`
- Renders: three SetEntryForm instances in sequence (WU, W1, W2) — each becomes interactive once the prior is submitted
- W2 includes the "to failure" checkbox
- Calls onComplete() after W2 is successfully logged

### `FreeFormProtocol` component
- Props: `{ block: Block, exercise: Exercise, userId: string, onComplete: () => void, onPR: (pr) => void }`
- Renders: list of SetEntryForm instances; "Add set" button to add another; "Done with this block" button to call onComplete()
- Sets numbered 1, 2, 3, ... no failure checkbox

### `SetEntryForm` component
- Props: `{ exercise: Exercise, blockId: string, sessionId: string, userId: string, setIndex: number, isToFailure: boolean (default false), showFailureCheckbox: boolean, onSaved: (setLog, prDetections) => void }`
- Renders: weight input (hidden if exercise.is_bodyweight=true), reps input, optional failure checkbox, optional notes textarea, Save button
- On Save: insert to set_logs, run PR detection on result, call onSaved with both
- Validation: reps required, weight required for non-bodyweight

## 5. Edge Cases to Handle

1. **Session not on today's day**: redirect to /today (criterion 6)
2. **Session already completed** (completed_at is not null): redirect to /today (criterion 7)
3. **No active training plan / no sessions found**: should not be reachable since Today tab gates entry, but if user manually navigates to /log/<id> for an invalid id, redirect to /today
4. **Network failure on set insert**: surface error inline, don't advance protocol, allow retry
5. **Network failure on PR insert**: log warning, advance protocol anyway (PR is missed; Slice 5 sync layer can retry)
6. **Bodyweight exercise with weight populated**: silently override weight to null on insert; don't error
7. **Non-bodyweight exercise with weight=0 or empty**: inline validation error
8. **Reps=0 or empty**: inline validation error
9. **User taps "End session early" before logging any sets**: confirm, write completed_at + was_ended_early=true, navigate to summary (which will show empty stats but works)
10. **User logs a set, navigates away, returns**: resume at correct block; logged set remains
11. **User logs all sets in all blocks**: auto-advance through summary
12. **Network restored mid-session after offline edit**: out of scope for Slice 4 (Slice 5 problem)
13. **PR detection race condition** (two sets logged near-simultaneously): unlikely in single-user app, but the unique constraint on (set_log_id, pr_type) makes double-inserts safe
14. **Mobility block with zero sets logged + "Done" tapped**: allow it (user might want to skip a mobility exercise); block is marked complete in completed_block_ids

## 6. Test Cases

### Phase 1 — Schema verification (3 tests)
1. Run pnpm seed; verify migration 009 and 010 applied. Check via Supabase Studio that set_logs, session_completions tables exist with expected columns and RLS enabled.
2. Verify pr_history still has exactly 2 RLS policies (select_own, insert_own); migration 009/010 did not modify pr_history policies.
3. Verify exercises.is_bodyweight column exists, defaults false. Run a query: `SELECT name, is_bodyweight FROM exercises WHERE name IN ('Muscle Ups', 'Dips')` — both should return is_bodyweight=true after seed re-run.

### Phase 2 — Failure block end-to-end (5 tests)
4. Sign in. Navigate to today's lifting session via /today's "Start Workout" button. Logger opens at Block 1.
5. Pick an exercise from Block 1's bank. Picker collapses, set entry UI appears.
6. Log WU set: weight=135, reps=10. Save. Set appears as logged.
7. Log W1 set: weight=185, reps=8. Save. Set appears as logged.
8. Log W2 set: weight=205, reps=6, "to failure" checked. Save. Block marked complete; Logger advances to Block 2 automatically.

### Phase 3 — Mobility block end-to-end (3 tests, requires Saturday or temporary day-flip)
9. Setup: temporarily flip today's session to Saturday's Lower ATG OR navigate to a mobility-block session manually. Open Logger at Block 1 (ATG Split Squat).
10. Add 2 sets free-form: weight=0/bodyweight, reps=10. Tap "Done with this block". Block marked complete, advances to Block 2.
11. Verify session_completions.completed_block_ids contains the mobility block's block_id.

### Phase 4 — PR detection (4 tests)
12. Pick an exercise where you've never logged anything (e.g., Bench Press if Slice 2 only seeded 235×1 historical). Log a set: weight=240, reps=1. Verify "PR" badge appears inline, verify pr_history row inserted with pr_type='weight'.
13. Log another set on Bench Press: weight=240, reps=2. Verify Type B fires (since 2 reps > 1 historical at 240 weight... wait, this needs more careful test design — write it out)
14. Log a set within the prescribed range that beats prior reps at that weight: verify Type B PR fires.
15. Log a bodyweight exercise (Muscle Ups): verify NO PR badge appears (bodyweight exclusion holds).

### Phase 5 — Resume after abandonment (3 tests)
16. Start logging a session. Log Block 1 fully. Begin Block 2, log WU, then close the browser tab.
17. Reopen, navigate to /today, click "Start Workout" again. Logger should resume at Block 2 with WU already shown as logged; W1 should be the active interactive form.
18. Verify session_completions row still has completed_at IS NULL.

### Phase 6 — End session early + summary (3 tests)
19. Mid-session, click "End session early". Confirm dialog appears. Confirm.
20. Verify navigation to summary screen. Summary shows correct totals (sets logged so far, reps, volume, any PRs).
21. Verify session_completions has completed_at populated and was_ended_early=true.

### Phase 7 — Edge cases (4 tests)
22. Try logging a set with reps=empty: inline validation error, no submit.
23. Try logging a set on a non-bodyweight exercise with weight=0: inline validation error.
24. Try logging on a session whose day_of_week doesn't match today: navigate manually to /log/<saturday_session_id> on a non-Saturday: redirect to /today.
25. Try logging on an already-completed session: redirect to /today.

### Phase 8 — Other tabs unaffected (2 tests)
26. Plan tab, Today tab, History tab, Nutrition tab, Settings tab all render correctly.
27. Today tab's Start Workout still navigates correctly.

### Phase 9 — Code quality (4 tests)
28. pnpm lint clean
29. pnpm typecheck clean
30. pnpm format:check clean
31. git status shows only expected new and modified files

## 7. Codex Generation Prompt

CONTEXT:
training-app — Next.js 15 App Router PWA, Supabase backend (Postgres + Auth + RLS), shadcn/ui on dark theme with lilac (#9b7fd4) accents. Slices 1-3 shipped: auth + scaffold, schema + seed + Plan tab, Today Dashboard. Repo at b737aa4 on main, working tree clean. /spec/MASTER_SPEC.md, /spec/ARCHITECTURE.md, prior slice docs, and /spec/slices/SLICE_4_WORKOUT_LOGGER.md are authoritative. /spec/FUTURE_WORK.md tracks the recovery_type item (Slice 8).

TASK:
Build Slice 4 — the Workout Logger. First write-side slice. Linear block-by-block walkthrough at /log/[session_id]. Failure blocks use WU+W1+W2 protocol with failure confirm on W2; mobility and corrective blocks use free-form set entry with explicit "Done with this block". Exercise picker from each block's bank. Set logging snapshots prescribed_min/max from exercises onto each set_log row at write time. PR detection (Type A weight ladder + Type B in-range reps) with inline lilac "PR" badge. Bodyweight exercises (is_bodyweight=true) are excluded from PR detection. Abandoned-session resume via session_completions table with started_at + completed_at + completed_block_ids[]. Session-complete summary screen at /log/[session_id]/summary.

FILES TO CREATE:

supabase/migrations/009_workout_logger.sql — new tables: set_logs (with prescribed_min/max snapshot columns), session_completions (with completed_block_ids uuid[] array column, was_ended_early bool); ALTER TABLE exercises ADD COLUMN is_bodyweight boolean DEFAULT false. Append-only — do not modify any prior migration.
supabase/migrations/010_extended_rls.sql — ENABLE RLS on set_logs and session_completions; 4-policy pattern (select_own, insert_own, update_own, delete_own) for both. pr_history policies are NOT modified (must remain 2-policy from migration 008).
supabase/seed/lib/bodyweight-exercises.ts — exported const array of bodyweight exercise names: Muscle Ups, Dips, Push-Ups, Pull-Ups, Chin-Ups, Pistol Squats, Handstand Push-Ups (extensible)
src/app/(app)/log/[session_id]/page.tsx — REPLACE Slice 3 placeholder. Server Component. Fetches session + blocks + exercise banks. Validates day_of_week, validates session not already completed, fetches or creates session_completions row, computes last incomplete block, renders LoggerShell with all data.
src/app/(app)/log/[session_id]/summary/page.tsx — Server Component. Fetches set_logs + pr_history for this session. Renders SessionSummary component.
src/components/log/LoggerShell.tsx — Client Component. State: current block index, currently selected exercise, mode (picker | protocol). Renders BlockHeader + (ExercisePicker if no exercise selected | Protocol component based on block_type). Handles advance-to-next-block.
src/components/log/BlockHeader.tsx — Server-renderable. Block name, block_type badge (failure/mobility/corrective), "Block N of M" progress, "End session early" link.
src/components/log/ExercisePicker.tsx — Client Component (selection state). Tappable list of exercises in the bank. On tap, calls callback with selected exercise.
src/components/log/FailureProtocol.tsx — Client Component. Renders three SetEntryForm in sequence (WU, W1, W2). W2 includes failure checkbox. On W2 saved, calls onComplete callback.
src/components/log/FreeFormProtocol.tsx — Client Component. Renders list of SetEntryForms; "Add set" button; "Done with this block" button. On Done, calls onComplete callback.
src/components/log/SetEntryForm.tsx — Client Component. Form: weight (hidden if exercise.is_bodyweight), reps, optional notes, optional failure checkbox. On Save: insert to set_logs, run detectPRs(), call insertPR() for each detection, call onSaved with the result.
src/components/log/SetLogRow.tsx — Server-renderable display of a logged set. Read-only.
src/components/log/PRBadge.tsx — Small lilac "PR" pill.
src/components/log/EndSessionDialog.tsx — Client Component. Dialog confirming early end. Uses shadcn Dialog primitive (install via pnpm dlx shadcn@latest add dialog if not already present).
src/components/log/SessionSummary.tsx — Server-renderable. Total sets, reps, volume, PR list, "Back to today" link.
src/lib/methodology/pr-detection.ts — Pure functions: detectPRs(setLog, userId). Returns PRDetection[] (empty, one, or two entries).
src/lib/methodology/session-state.ts — Helper functions: getOrCreateSessionCompletion, findLastIncompleteBlock, isBlockComplete.

FILES TO MODIFY:

supabase/seed/seed-from-wiki.ts — after exercises upsert, run a second pass setting is_bodyweight=true for any exercise whose name matches the bodyweight-exercises.ts list. Idempotent.
src/lib/supabase/types.ts — regenerate via supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts after migrations are applied.

CONSTRAINTS:

Tech stack: Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui. Server Components by default; "use client" only where state or event handling requires it (LoggerShell, ExercisePicker, FailureProtocol, FreeFormProtocol, SetEntryForm, EndSessionDialog).
Naming per /spec/ARCHITECTURE.md.
Use only literal process.env.NEXT_PUBLIC_* access (DefinePlugin requirement; see DECISIONS.md). New components don't directly read env vars — use createClient() from src/lib/supabase/server.ts (server) or src/lib/supabase/client.ts (client).
MIGRATION IMMUTABILITY RULE: 009 and 010 are NEW files. Do not modify any prior migration. Never use supabase db push --include-all to force-apply modifications to existing migrations. (See CLAUDE.md and DECISIONS.md.)
Reuse Card from src/components/ui/card.tsx. Install Dialog primitive if needed.
prescribed_min and prescribed_max snapshotted on set_log row at write time. Read from exercises.prescribed_min/max via the chosen exercise; never join at read time for PR detection.
pr_history is APPEND-ONLY at the DB layer (only select_own and insert_own policies). All UPDATE/DELETE on pr_history is forbidden — verify your code does not attempt either.
PR detection runs after every successful set insert. Idempotent: if a (set_log_id, pr_type) pair would duplicate, no-op (use a unique constraint or pre-check).
Use the regenerated Database types from src/lib/supabase/types.ts.
Server-side data fetching minimum round-trips. Logger entry: 1 query for session + blocks + exercises joined; 1 query for session_completions (with insert if not exists). Summary: 1 query for set_logs; 1 query for pr_history.
No new dependencies beyond shadcn Dialog primitive.
Authentication enforced by existing middleware. Routes do not re-implement auth.

ACCEPTANCE CRITERIA:

Migrations 009 and 010 apply cleanly. RLS verified on new tables.
Failure blocks: WU + W1 + W2 with failure checkbox on W2. Logger advances after W2.
Mobility/corrective blocks: free-form sets, "Done with this block" advances.
Exercise picker shows bank exercises with prescribed range, muscle group, bodyweight tag.
Set logs include prescribed_min/max pinned at write time.
PR detection (Type A + Type B) runs after every set; bodyweight exercises excluded; lilac PR badge inline.
Resume restores last incomplete block; prior set_logs visible.
End session early: dialog → summary screen with totals + PR list.
Day mismatch and already-completed redirect to /today.
pnpm lint, typecheck, format:check all pass.

DO NOT:

Modify any prior migration (001-008)
Modify files in src/components/plan/, src/components/today/, src/components/ui/
Modify any prior seed file other than seed-from-wiki.ts
Modify CLAUDE.md, AGENTS.md, MASTER_SPEC.md, ARCHITECTURE.md, PROJECT_BRIEF.md, FUTURE_WORK.md, KNOWN_ISSUES.md, DECISIONS.md
Add features beyond Slice 4's scope (no swap exercise mid-block; no toast on PR; no edit historical sets)
Add new dependencies beyond shadcn Dialog
Leave placeholder TODOs or stub functions
Use process.env[varName] dynamic access

OUTPUT:
Write the complete implementation. Do not explain — just produce the code. List at the end:

Every column name referenced from the database (including new columns introduced)
Every Supabase client method called
Every env var read (expected: none new)
Every assumption made about the schema, methodology, or PR semantics
Files modified outside the create-and-modify list (expected: none)


## 8. Claude Code Quality Review Prompt

CONTEXT:
Slice 4 of training-app — Workout Logger. First write-side slice. Codex just generated migrations 009 + 010, the seed update for is_bodyweight, the Logger UI (LoggerShell + protocols + picker + set entry + summary), PR detection logic, session-state helpers. Reuses Card primitive from /components/ui/. May install shadcn Dialog primitive.

FILES CODEX TOUCHED:
[Pull the actual list from Codex's output. Expected new files (~17):

supabase/migrations/009_workout_logger.sql
supabase/migrations/010_extended_rls.sql
supabase/seed/lib/bodyweight-exercises.ts
src/app/(app)/log/[session_id]/page.tsx (replaced Slice 3 placeholder)
src/app/(app)/log/[session_id]/summary/page.tsx
src/components/log/LoggerShell.tsx
src/components/log/BlockHeader.tsx
src/components/log/ExercisePicker.tsx
src/components/log/FailureProtocol.tsx
src/components/log/FreeFormProtocol.tsx
src/components/log/SetEntryForm.tsx
src/components/log/SetLogRow.tsx
src/components/log/PRBadge.tsx
src/components/log/EndSessionDialog.tsx
src/components/log/SessionSummary.tsx
src/lib/methodology/pr-detection.ts
src/lib/methodology/session-state.ts

Plus modified:

supabase/seed/seed-from-wiki.ts
src/lib/supabase/types.ts (regenerated)
possibly src/components/ui/dialog.tsx if shadcn Dialog was installed
possibly package.json + pnpm-lock.yaml if shadcn deps added]

REVIEW CHECKLIST:
Migration immutability rule (CRITICAL):

009 and 010 are new files (verify they do not exist in earlier history)
No prior migration (001-008) was edited
No supabase db push --include-all was used
010 RLS policies for set_logs and session_completions match the 4-policy pattern
pr_history policies NOT modified (still 2-policy from migration 008)



Schema fidelity:

set_logs has all columns from criteria 25 (prescribed_min/max as snapshot columns, set_log_id, user_id, session_id, block_id, exercise_id, set_index, weight_kg nullable, reps, is_to_failure, notes, logged_at)
session_completions has user_id, session_id, started_at, completed_at, was_ended_early, completed_block_ids uuid[]
exercises.is_bodyweight added with default false
All FKs have appropriate ON DELETE behavior (likely RESTRICT for user data integrity)
Unique constraint on pr_history (set_log_id, pr_type) for PR idempotency, OR explicit pre-check in insertPR()



PR detection correctness:

Type A: strict greater-than on weight_kg, scoped to (user_id, exercise_id, pr_type='weight')
Type B: reps strictly greater than prior max at SAME weight_kg, in-range filter using PINNED prescribed_min/max from the set_log row (NOT from current exercises table)
Bodyweight exclusion is at the top of detectPRs(); skip both Type A and Type B for bodyweight exercises
reps < 1 skip
Both types can fire simultaneously (e.g., new heaviest weight that's also in range)



Bodyweight handling:

SetEntryForm hides weight input when exercise.is_bodyweight=true
Insert path: weight_kg=null when exercise.is_bodyweight, regardless of what the form has
PR detection skips bodyweight (per criterion 28a)
Seed pass marks correct exercises as bodyweight (Muscle Ups, Dips, Push-Ups, Pull-Ups, Chin-Ups, etc.)



Resume logic:

findLastIncompleteBlock correctly identifies blocks with < required sets (failure: 3) or not in completed_block_ids (mobility/corrective)
Resume scoped to today's session_completion (started_at >= today_midnight)
Already-completed session redirects to /today
Session_completion is created on first entry, not duplicated on subsequent entries



Server vs client component discipline:

Logger entry page (page.tsx) is Server Component; fetches data and renders LoggerShell
LoggerShell is Client Component (state)
Protocol components are Client (form state, callbacks)
SetLogRow, BlockHeader, SessionSummary are Server-renderable (no client-only behavior)
No accidental server-side fetch within a Client Component



Immutable history:

prescribed_min and prescribed_max are read from exercises ONCE at write time and stored on the set_log row
PR detection reads from set_log.prescribed_min/max, NOT exercises.prescribed_min/max
Verify no code path joins blocks ↔ exercises at PR-detection time



Reuse over duplication:

SessionDetailPanel, BlockList, ExerciseBankList from /components/plan/ are NOT used here (Logger is a different surface)
But Card, Dialog primitives from /components/ui/ ARE reused
No log-specific reimplementation of basic primitives



Strict TypeScript:

No any
Database types from src/lib/supabase/types.ts (regenerated)
PR detection types defined as discriminated union if applicable
Session, Block, Exercise, SetLog types correctly used



Error handling:

Set insert failure surfaces to user, doesn't advance protocol
PR detection failure logs warning, advances anyway (criterion 30)
Session_completions queries handle null and conflict cases
Day mismatch and already-completed redirect cleanly (no exception)



Validation:

Reps required, > 0
Weight required for non-bodyweight, > 0
Bodyweight exercises ignore weight input (graceful, not error)
Failure checkbox only shown for W2 of failure blocks



Read-only verification (display-only zones):

SetLogRow shows logged set, no edit affordance
SessionSummary is read-only
Resumed view shows prior blocks/sets read-only



Other tabs unaffected:

No files modified in src/components/plan/, src/components/today/, src/app/(app)/today/, src/app/(app)/plan/
No middleware changes
No env.ts changes
Today tab's Start Workout button still navigates to the new Logger (works without code change since the route is /log/[session_id])



Slice scope:

17 expected new files + 2-3 expected modifications, no others
No new dependencies beyond shadcn Dialog
No schema changes outside 009/010



Performance:

Logger entry: 1-2 queries (session+blocks+exercises join, session_completions check)
Summary: 1-2 queries (set_logs, pr_history join with exercises for names)
No N+1 in PR detection (one query per detection check is acceptable; ideally batched)


AUTO-FIX vs FLAG:

Auto-fix: items 1-15 when fixes are local and unambiguous
Flag for approval: structural refactors, splits to /components/shared/, schema design changes, PR detection logic interpretation differences, dialog primitive choice if not shadcn

CONSTRAINTS:

Do not add features
Do not modify files in src/components/plan/, src/components/today/, src/components/ui/ (except adding Dialog primitive if needed), src/lib/supabase/ env/client/server/middleware
Do not modify prior migrations (001-008) or prior seed files (other than seed-from-wiki.ts)
Do not change folder structure from /spec/ARCHITECTURE.md
Minimal, surgical changes only

OUTPUT:
Summary with four parts:

Files changed and why (one line each)
Items flagged for user approval with reasoning
Issues logged for KNOWN_ISSUES.md
Ready-for-testing verdict (yes / no — if no, what's blocking)


## 9. Claude Code Debugging Prompt (template)

CONTEXT:
Slice 4 of training-app — Workout Logger. Codex generated, Claude Code reviewed, now testing.

CURRENT PROBLEM:
[Exact error message, browser console output, dev server log line, set log row mismatch, missing PR row, wrong redirect, etc. Be specific.]

RELEVANT FILES:
[Files involved — paths from project root]

WHAT CODEX BUILT / QUALITY REVIEW COVERED:
[Brief summary]

CONSTRAINTS:

Tech stack: Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui
Migration immutability: do NOT edit migrations 001-010; create 011 if a schema fix is needed
Do not refactor outside the current problem
Do not modify files in src/components/plan/, src/components/today/, src/components/ui/, src/lib/supabase/ env+client+server+middleware
pr_history is append-only — UPDATE and DELETE forbidden

ACCEPTANCE CRITERIA:
[Pull relevant criteria from Section 2]

DO NOT:

Rewrite files that are working
Add features outside the current fix
Change folder structure from /spec/ARCHITECTURE.md
Edit prior migrations
Generate a new slice from scratch — if needed, stop and tell me to take it to Codex

OUTPUT:
Fix the problem. Summarize what was changed, why, and list any follow-up issues for the next session.
