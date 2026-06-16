# CHANGELOG

## Slice 1 — Project Scaffold + Auth (2026-04-30)

### What was built

- Next.js 15 (App Router) project scaffolded with TypeScript strict mode,
  Tailwind 3.x, and shadcn/ui (new-york style, dark theme).
- Pure black + white + lilac (#9b7fd4) design tokens wired through CSS
  custom properties in `src/app/globals.css` and exposed as Tailwind
  utilities (`bg-background`, `text-foreground`, `bg-accent`, `text-danger`,
  `text-success`, `text-warning`, etc.). Inter font loaded via `next/font`.
  `tabular-nums` and `safe-pb` utilities defined for downstream slices.
- Supabase magic-link authentication via `@supabase/ssr`:
  - Browser client (`src/lib/supabase/client.ts`)
  - Server client (`src/lib/supabase/server.ts`) with cookie bridge
  - Session-refresh helper (`src/lib/supabase/middleware.ts`) called from
    `src/middleware.ts`
- `/login` page with a single-field magic-link form (plain `useState`,
  no React Hook Form). States: idle / sending / sent / error. Inline
  error surfacing on validation failures, Supabase errors, and the
  `?error=link_expired` / `?error=auth` query params from the callback.
- `/auth/callback` route handler exchanges the code for a session, then
  upserts the profile row idempotently
  (`onConflict: "user_id", ignoreDuplicates: true`) before redirecting
  to `/today`.
- `(app)` route group enforces auth: redirects to `/login` if unauthenticated,
  defensively redirects back to `/auth/callback` if the profile row is
  missing (recovery path that re-runs the upsert from the existing session).
- `BottomTabBar` with five tabs (Today, Plan, History, Nutrition, Settings),
  active state via `usePathname()` `startsWith` match, lucide icons,
  44px touch targets, single-source `tabs` array.
- `/settings` Sign out button calls `supabase.auth.signOut()` then
  routes to `/login`; surfaces inline errors if sign-out fails.
- SQL migrations:
  - `001_init_auth_profile.sql` — `goal_mode_enum`, `profiles` table,
    `set_updated_at()` trigger.
  - `007_rls_policies.sql` — SELECT, INSERT, UPDATE policies on
    `profiles` (no DELETE; `auth.users` cascade handles cleanup).
- Tooling: ESLint (next/core-web-vitals + next/typescript), Prettier
  (with `prettier-plugin-tailwindcss`), `.prettierignore` excludes
  `AGENTS.md`, `CLAUDE.md`, `spec/`. Scripts use idiomatic pnpm form
  (`next dev`, `tsc --noEmit`, `prettier --check .`).

### Deviations from the slice spec

- `src/lib/supabase/types.ts` was initially scaffolded as a placeholder
  (`Database = { public: { Tables: {} } }`) with a TODO note pending
  migration application. **Resolved within this slice**: types
  regenerated via `supabase gen types typescript --linked` after the
  migrations were applied to the Supabase project. The file now contains
  the full generated `Database` type including the `profiles` table
  shape and `goal_mode_enum`. No follow-up needed.
- `package.json` scripts were initially generated with full Node paths
  (`node node_modules/next/dist/bin/next dev`, etc.). Reverted to the
  standard form (`next dev`, etc.) during the quality review pass — the
  direct invocation was non-idiomatic and brittle if Next ever moves
  its CLI entrypoint.

### Bugs caught and fixed

- None during the quality review pass. Codex's initial output passed all
  checks; the only changes were the package.json script-style revert and
  the types.ts regeneration noted above.

## Slice 2 — Plan Migration (2026-04-30)

### What was built

- SQL migrations for the full plan / exercise / nutrition data model:
  - `002_plan_structure.sql` — `training_plans`, `daily_schedules`,
    `sessions`, `blocks`, `exercises`, `block_exercises`, plus the
    enums (`day_of_week_enum`, `session_type_enum`, `timing_enum`,
    `block_type_enum`, `cardio_format_enum`,
    `cardio_target_zone_enum`), the cardio-fields CHECK constraint
    on `sessions`, and the GIN index on `exercises.muscle_groups`.
  - `005_nutrition.sql` — `nutrition_targets` (single row per user
    with min/max ranges for cal/protein/carbs/fat) and
    `meal_entries` (per-meal log shell for later slices).
  - `006_plan_templates.sql` — `plan_templates` (versioned snapshot
    history, `is_public` defaulting to false) and `pr_history`
    (append-only, with `pr_type_enum` covering `weight` and
    `in_range_rep`).
  - `008_extended_rls.sql` — RLS enabled on all 10 new tables;
    SELECT/INSERT/UPDATE/DELETE for tables with direct `user_id` or
    `owner_user_id`, FK-chain policies for `daily_schedules` /
    `sessions` / `blocks` / `block_exercises`, SELECT+INSERT only
    for `pr_history` (append-only enforced at the DB layer).
- Env-var consolidation: `src/lib/supabase/env.ts` is now the single
  source for `getSupabaseUrl`, `getSupabaseAnonKey`,
  `getSupabaseServiceRoleKey`. `client.ts`, `server.ts`,
  `middleware.ts`, and `supabase/seed/lib/supabase-admin.ts` all
  import from it.
- Seed-from-wiki ingestion pipeline at `supabase/seed/`:
  - `seed-from-wiki.ts` — orchestrates a full plan upsert from six
    markdown files. Idempotent: every step keys on stable identity
    (`(user_id, name)` for exercises, `(plan_id, day_of_week)` for
    schedules, `(session_id, display_order)` for sessions and
    blocks). No-op re-run reports zero changes.
  - `lib/parser.ts` — generic markdown utilities (table extraction,
    H2/H3 sectioning, key-value parsing, exercise-name
    normalization). Zero domain knowledge.
  - `lib/methodology-rules.ts` — domain-specific parsing that turns
    wiki structure into typed `TrainingPlanSpec`. Encodes the
    `inferMuscleGroupsForExercise` rules including the Friday Pull
    sub-bank → granular tag mapping (lats / upper_back /
    teres_major / rear_delts).
  - `lib/supabase-admin.ts` — service-role client used only by the
    seed script. Bypasses RLS at seed time.
  - `lib/types.ts` — intermediate parsed types
    (`TrainingPlanSpec`, `ParsedDaySpec`, `ParsedBlock`, etc.).
- `src/lib/methodology/muscle-groups.ts` — pure helper exposing the
  high-level taxonomy (chest / shoulders / back / arms / legs /
  core / calves) and a `getPrimaryMuscleGroupLabel` formatter.
- `src/lib/utils/wiki-paths.ts` — shared constants for the six
  wiki file paths.
- `pnpm seed` script runs `tsx --env-file=.env.local` to load the
  service-role key.
- Plan tab UI:
  - Screen 2A (`/plan`) — server component renders 7
    `<DayCard />`s in week order, each showing the day's session
    summaries (lift/cardio/recovery), gym, AM/PM/Anytime timing,
    and a focus-muscle-group caption derived from the seeded
    exercise tags.
  - Screen 2B (`/plan/[day]`) — server component renders all
    sessions for the requested day. Lifting sessions show a
    `<BlockList />` with each block expandable to reveal the bank
    via `<ExerciseBankList />`. Cardio sessions show the structured
    distance/zone meta line; recovery sessions show their
    description.
  - All Plan-tab cards use the shadcn `Card` primitive
    (`src/components/ui/card.tsx`).
- Seeded data after `pnpm seed`:
  - 1 `training_plans` row (`Marcus base plan v1`, `is_active=true`)
  - 7 `daily_schedules` (Sunday `is_rest_day=true`)
  - 12 `sessions` (Mon 2, Tue 1, Wed 1, Thu 1, Fri 2, Sat 2, Sun 0,
    plus the recovery sessions on Thu/Sat/Sun)
  - 24 `blocks` across the lifting sessions (Mon Upper 8, Mon
    Lower-equivalent etc., Sat Lower ATG 10 with blocks 1-8 marked
    `block_type='mobility'`, Thu Push 7 including Lateral Raise
    twice)
  - 50+ deduplicated `exercises` (47 dedup events on a typical
    seed run, indicating shared exercises across multiple blocks)
  - All `block_exercises` join rows wiring exercise banks to blocks
  - 1 `nutrition_targets` row (cal 2400-2800, protein 150-175,
    carbs 200-280, fat 60-90)
  - 1 `plan_templates` row (`version=1`, `is_public=false`,
    `snapshot_json` carrying the full parsed plan)
  - 3 `pr_history` rows (Bench 235×1, OHP 185×3, Deadlift 435×1,
    all `pr_type='weight'`, `set_log_id=NULL`)
- `.gitignore` updated: `supabase/seed/wiki/*.md` is gitignored
  (external content); `.gitkeep` preserves the folder structure.

### Deviations from the slice spec

- **shadcn Card primitive deviation caught in review.** Codex
  initially skipped `pnpm dlx shadcn add card` and hand-rolled card
  styling in `DayCard.tsx` and `SessionDetailPanel.tsx`. The quality
  review installed Card and refactored both components.
- **Synthetic recovery placeholder removed in review.** Codex
  inserted a fake "Recovery — No recovery scheduled today" panel
  on `/plan/[day]` for days with no recovery session. Removed
  during the review; the Plan tab now renders only what the
  database has.
- **`SEED_TARGET_USER_ID` env var added.** Optional; the seed
  script falls back to looking up the single profile row when
  unset. Documented in `.env.example`.

### Bugs caught and fixed

- **Migration 007 force-apply silently failed.** Codex initially
  extended `007_rls_policies.sql` with policies for the new Slice 2
  tables and ran `supabase db push --include-all`. The CLI reported
  success but the remote DB never received the new policies — the
  Supabase CLI does not re-apply tracked migrations even with
  `--include-all`. Caught when verifying the dashboard showed RLS
  disabled / zero policies on the new tables. Fix: reverted 007 to
  its Slice 1 form and moved the extended policies into a new
  `008_extended_rls.sql` (applied cleanly). Established the
  migration immutability rule in `CLAUDE.md` and `DECISIONS.md`
  going forward.
- **`process.env[name]` dynamic access broke the client bundle.**
  The first `env.ts` shape used `process.env[name]`, which compiled
  and type-checked but threw "Missing NEXT*PUBLIC_SUPABASE_URL" at
  module load in the browser — Next.js's webpack DefinePlugin only
  inlines `NEXT_PUBLIC*\*`env vars when accessed via literal
property syntax. Refactored`env.ts`to use literal`process.env.NEXT_PUBLIC_SUPABASE_URL`(etc.) and pass the
resolved value into a private`requireEnv(name, value)`validator. Documented the rule in`DECISIONS.md`.
- **`pnpm seed` missing `.env.local` loading.** The first version
  of the seed script didn't load `.env.local`, so `pnpm seed`
  failed with "Missing NEXT_PUBLIC_SUPABASE_URL" before reaching
  any seed logic. Fixed by adding `--env-file=.env.local` to the
  `seed` script in `package.json`. tsx 4.19.x supports the flag
  natively, no dotenv dependency needed.

### Verification

- `pnpm seed` re-run idempotency: clean second run reports
  `Inserted 0, Updated 0, Deleted 0, Unchanged 173`, plus 47
  exercises deduplicated and three soft-rule warnings (cardio
  before lifting on Mon/Sat, recovery on a multi-session Sat).
  Verified across 5+ consecutive runs.
- Block-rename idempotency (Test 17): rename "Mid Chest" →
  "Mid Chest Anchor" produces `Updated 1` (`blocks` row) +
  `Inserted 1` (new `plan_templates` version). Revert produces
  another `Updated 1` + `Inserted 1` (third version, JSON-equal to
  v1). No `block_exercises` churn, no orphans.
- All 29 Section 6 tests pass.

## Slice 3 — Today Dashboard (2026-05-01)

### What was built

- Today tab landing (Screen 1A) at `/today` — Server Component
  computes today's `day_of_week` server-side via `Intl.DateTimeFormat`
  and a 3-letter map, fetches today's sessions in a single
  Supabase relational query
  (`daily_schedules → sessions → training_plans!inner`), renders
  `<TodayHeader />` (full day name + formatted date) plus
  `<TodaySessionList />`. Sessions are sorted post-fetch by
  `timing` (am → anytime → pm) then `display_order`.
- Today session detail (Screen 1B) at
  `/today/session/[session_id]` — Server Component fetches the
  session, its blocks, and the bank exercises in a single
  relational query, validates that the session belongs to today's
  active plan + day_of_week, redirects to `/today` on any
  mismatch. Renders the existing
  `<SessionDetailPanel />` from `src/components/plan/`; lifting
  sessions also render `<StartWorkoutButton />` at the top, plus
  a "Back to today" link mirroring Plan tab's "Back to week"
  pattern.
- Logger placeholder at `/log/[session_id]` — Server Component
  renders a centered Card with "Workout logger coming in Slice 4"
  and a "Back to today" link. No data fetching, no validation.
  The single intentional stub for this slice; Slice 4 replaces
  contents.
- Nine new files matching the Section 3 file list verbatim:
  - Routes: `(app)/today/session/[session_id]/page.tsx`,
    `(app)/log/[session_id]/page.tsx`
  - Components: `TodayHeader.tsx`, `TodaySessionList.tsx`,
    `TodaySessionCard.tsx`, `StartWorkoutButton.tsx`,
    `RestDayEmpty.tsx` (all under `src/components/today/`)
  - Helper: `src/lib/methodology/today.ts` exporting
    `getTodayDayOfWeek(date?: Date)`
  - Plus the in-place replacement of
    `src/app/(app)/today/page.tsx` (Screen 1A).
- Full reuse of Plan-tab session-detail components without
  duplication: `<SessionDetailPanel />`, `<BlockList />`,
  `<ExerciseBankList />`, `<SessionSummaryRow />` are all
  imported as-is from `src/components/plan/`. The shadcn `Card`
  primitive is reused from `src/components/ui/card.tsx`. No
  Today-specific shadow components ("TodayBlockList",
  "TodaySessionDetailPanel") were created.
- `<StartWorkoutButton />` is the only Client Component in the
  slice — uses `Link` to navigate to `/log/[id]` with a defensive
  `event.stopPropagation()` on click. All other Today components
  are Server Components.

### Deviations from the slice spec

- None. Codex's output matched Section 3's file list exactly. No
  new dependencies, no schema changes, no edits to files outside
  the create list.

### Bugs caught and fixed

- None during the quality review pass. All 14 review checklist
  items passed without modification. Documentation-only change:
  added the Slice 3 DECISIONS.md entry (see below) and verified
  Plan/Today parity on cardio field rendering.

### Notable design rule captured

- **`is_rest_day` is plan metadata, not a Today-render gate.**
  `RestDayEmpty` renders if and only if there are zero sessions
  for today OR no active training plan, independent of the
  `daily_schedules.is_rest_day` flag. Sunday in Marcus's plan
  has `is_rest_day=true` AND a Hot Yoga or Sauna recovery session
  — both states are valid; the recovery session must still
  render. Implemented as
  `todaySchedule && todaySchedule.sessions.length > 0`. Full
  rationale in DECISIONS.md.

### Plan-tab parity check (Observation B)

- The user's review note suggested the Plan tab's Day Detail
  surfaces `cardio_format` alongside `cardio_distance` and
  `cardio_target_zone`. Verified the Plan tab actually surfaces
  only `cardio_distance` + `cardio_target_zone` (the example
  "5×100m · sprint" is exactly those two fields; `cardio_format`
  is the structured taxonomy `'speed_run' | 'endurance_run' |
'basketball'` and is never rendered). Today tab matches that
  pattern exactly — no parity drift, no fix needed.

### Tracked future work

- New `spec/FUTURE_WORK.md` introduced. First entry tracks the
  **recovery activity type granularity** structural improvement
  (Slice 8 or earlier): Marcus wants `recovery_type` as an
  extensible enum on `sessions` (initial values `'hot_yoga'`,
  `'sauna'`; reserved future values for stretching, ice bath,
  mobility flow, etc.) so recovery activities can be logged,
  counted, and capped independently. Affects schema, seed parser,
  Logger (Slice 4), History (Slice 6), Plan Editor (Slice 8).
  Mirrored as a 🟢 Low entry near the top of `KNOWN_ISSUES.md`
  for visibility during scans. The file also reserves a
  "Workflow Improvement Candidates" section for v2.2 workflow
  observations as they emerge.

### Verification

- All 24 Section 6 tests pass.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check` all clean.
- No `pnpm-lock.yaml` change — Slice 3 added zero dependencies.

## Slice 4 — Workout Logger (2026-05-01)

### What was built

- Workout Logger with linear walkthrough across all 7 blocks for
  failure, mobility, and corrective block types.
- Set logging: WU/W1/W2 for failure blocks (W2 always marked
  `is_to_failure=true`); free-form sets for mobility/corrective.
- Bodyweight handling via new `exercises.is_bodyweight` column
  (migration 009); bodyweight exercises hide the Weight field in the
  form and store `weight_kg=0`.
- PR detection: Type A (first-ever-weight ladder) and Type B
  (in-range top-rep) — both fire on weighted set inserts only, never
  on bodyweight; idempotent via `UNIQUE (set_log_id, pr_type)`.
- Inline PR badges on logged set rows; bodyweight sets explicitly
  excluded.
- Resume support: reopening `/log/[session_id]` for an in-progress
  `session_completion` picks up at the last incomplete block; Block 1
  sets render read-only above the active Block 2 form.
- End session early flow with shadcn Dialog confirm; session summary
  screen with totals and PR list.
- Three new tables: `set_logs` (with `UNIQUE` on
  `user_id+session_id+block_id+set_index` per migration 011),
  `session_completions` (with `completed_block_ids uuid[]`),
  `exercises.is_bodyweight` column.
- Extended RLS policies (migration 010) for `set_logs` (4 policies)
  and `session_completions` (4 policies).
- Three migrations: 009 (schema), 010 (RLS), 011 (set_logs UNIQUE
  constraint added mid-slice during review pass).

### Deviations from the slice spec

- Codex initially used a custom modal for End Session Early; review
  pass swapped it to the shadcn Dialog primitive (added
  `@radix-ui/react-dialog` dep).
- `set_logs` UNIQUE constraint was not in the original Codex output —
  added during quality review pass via migration 011 to prevent
  duplicate-tap data corruption.
- Form library deferred to Slice 7 — Slice 4 uses local component
  state for forms, validates inline via simple boolean checks.

### Bugs caught and fixed during the build

- Migration 009 initial draft was missing extended RLS for the new
  tables (caught in review, addressed in migration 010).
- PR detection initially fired on bodyweight sets — fixed during
  review pass to require `weight_kg > 0`.
- EndSessionDialog originally trapped focus incorrectly on first
  paint — fixed during review pass after shadcn migration.

### Verification

- All Section 6 tests pass.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check` all clean.
- `@radix-ui/react-dialog ^1.1.15` added (transitive deps via shadcn
  install); `pnpm-lock.yaml` updated accordingly.

## Slice 4.5 — Display Unit Correction (lbs/kg) (2026-05-01)

### What was built

- UnitFormatter utility at `src/lib/units/index.ts`: `KG_PER_LB`,
  `LB_PER_KG`, `DISPLAY_UNIT`, `lbsToKg` (3-decimal-rounded for
  storage), `kgToLbs` (unrounded), `formatWeight` (whole-number lbs
  display, "Bodyweight" for 0, "—" for NaN/undefined/null).
- Form layer: `SetEntryForm` changed from "WEIGHT (KG)" to
  "WEIGHT (LBS)", restricts input to 1 decimal, converts on save via
  `lbsToKg`.
- Display layer: `SetLogRow` and `SessionSummary` use `formatWeight`
  everywhere a weight renders. Volume totals also through
  `formatWeight`.
- Schema layer: `weight_kg` columns altered from `numeric` to
  `numeric(7,3)` on both `set_logs` and `pr_history` for round-trip
  precision.
- Migration 012 backfills existing data: multiplies `weight_kg` by
  `0.45359237` for `set_logs.logged_at < '2026-05-01 16:30:00+00'`
  and `pr_history.achieved_at < '2026-05-01 16:30:00+00'`, with
  `WHERE weight_kg > 0` to skip bodyweight rows. Idempotent by
  construction.

### Deviations from the slice spec

- Codex's first pass assumed bodyweight storage should switch from
  `weight_kg = 0` (Slice 4 convention) to `weight_kg = NULL` going
  forward. Corrected via single-line follow-up before review pass;
  bodyweight stays as 0 to preserve the cross-slice convention.
- Bodyweight storage convention preserved without a migration to
  clean up Slice 4 testing rows that had been written as NULL during
  the bodyweight-form-handling iteration. Those NULL rows are
  skipped by the migration's `WHERE weight_kg > 0` guard but
  represent a small data-shape inconsistency. Acceptable; logged to
  KNOWN_ISSUES.md as 🟢 Low.

### Bugs caught and fixed during the build

- `DISPLAY_UNIT` type annotation: `'lbs' = 'lbs'`
  literal-type-annotation form caught by ESLint
  `@typescript-eslint/prefer-as-const`; fixed to `as const` form
  during quality review pass.
- supabase CLI install prompt corrupted `types.ts` during the regen
  step (npx interactive prompt redirected into the file). Resolved
  by installing supabase CLI via Homebrew and re-running. Documented
  as a Workflow Improvement Candidate.

### Verification

- All 10 Section 6 tests pass: UnitFormatter REPL checks (1-2),
  pr_history backfill (Bench 235 → 106.594 kg, OHP 185 → 83.915 kg,
  Deadlift 435 → 197.313 kg) (3), live SetEntryForm save with
  conversion (4), SetLogRow display (5), reload-preserved display
  (6), PR detection idempotency via UNIQUE constraint inherited from
  Slice 4 (7), Volume tile whole-number lbs (8), no false-positive
  PR on out-of-range corrected baseline (9), no `kg` in user-visible
  JSX (10).
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check` all clean.
- No new dependencies.

## Slice 5 — Sync Layer (2026-05-01)

### What was built

- localStorage-backed write queue catching retryable failures
  (network, 5xx, 408, 429) for `set_log` and `session_completion`
  writes. Queue rows live in localStorage under
  `training-app:queue:<user_id>:<row_id>` and survive page reloads,
  navigations, and sign-outs (queue persists per-user, not per-tab,
  not per-session).
- Eight new files in `src/lib/sync/` and `src/components/log/`:
  - `queue.ts` — `enqueue` / `dequeue` / `loadQueue` /
    `updateAttempt`, all emit a `queue-change` window CustomEvent.
    Discriminated `QueueRow` union over four kinds:
    `set_log_insert`, `session_completion_start`,
    `session_completion_block_complete`, `session_completion_end`.
  - `classify.ts` — `isRetryable(errorOrResponse)`. True for
    network errors, fetch aborts, 408, 429, 5xx; false for 4xx
    other than 408/429 (including 23505 unique-violation on first
    attempt).
  - `handlers.ts` — typed handler map per kind. Each handler
    treats Postgres 23505 / HTTP 409 on retry as
    `{ ok: true, retryable: false }` (idempotent re-application).
    `set_log_insert` handler also runs PR detection as a derived
    effect via `runPrDetectionForSetLog`, re-querying
    `exercises.is_bodyweight` and `pr_history` at drain time
    (fresh state, not stale from enqueue time).
  - `drain.ts` — `drainQueue(userId)` with module-scope re-entrancy
    guard (`drainState.inProgress`), iterates rows in
    `enqueued_at` ascending order, dispatches to handlers, runs
    PR detection on `set_log_insert` success only. Lock released
    in `finally`.
  - `triggers.ts` — `setupDrainTriggers(userId)` registers the
    `window.online` listener; LoggerShell mount-time and
    QueuePanel manual-retry triggers are wired directly by their
    callers.
  - `useQueueState.ts` — React hook returning
    `{ rows, drainState, pendingCount }`, subscribed to
    `queue-change` events with cleanup on unmount.
  - `QueueIndicator.tsx` — Logger header dot with three states:
    muted gray (idle), lilac with 1s CSS-keyframe opacity pulse
    (syncing), amber (pending). Tap toggles QueuePanel.
  - `QueuePanel.tsx` — expanded panel showing per-row labels
    ("Set 2 saved", "Block marked done", "Session started",
    "Session completed", "Session ended early") and a "Retry now"
    button.
- Four files modified to integrate the queue:
  - `SetEntryForm.tsx` pre-generates `set_log_id` via
    `crypto.randomUUID()` before insert (idempotent against the
    Slice 4 UNIQUE constraint on
    `(user_id, session_id, block_id, set_index)` if the same
    payload retries). On save failure, classifies the error: if
    retryable, enqueues a `set_log_insert` row and advances the
    UI as if locally-saved; if not, shows the existing Slice 4
    inline error.
  - `LoggerShell.tsx` registers drain triggers on mount, calls
    `drainQueue` directly on mount, renders `<QueueIndicator />`
    in the header. The "Done with this block" and "End session" /
    "End early" handlers all enqueue on retryable failure.
  - `SessionSummary.tsx` accepts a new optional `statusMessage`
    prop so the locally-saved-pending-sync state can surface in
    the rendered summary (the end-session action handlers live in
    LoggerShell per the structurally-correct relocation).
  - `signOut.ts` — new file. Checks `loadQueue(userId).length > 0`
    before calling Supabase `signOut`; if non-empty, shows a
    queue-aware confirmation dialog ("You have N unsynced sets.
    They'll be saved next time you sign in to this account on
    this device.") with Cancel / Sign out anyway. The queue is
    NOT cleared on sign-out — it persists in localStorage under
    its `user_id`-namespaced keys until that user signs back in.
- Sign-out wiring: `src/components/auth/SignOutButton.tsx` (added
  `userId: string` prop, routes through `signOut(userId)`,
  handles the `{ aborted: boolean }` return shape) and
  `src/app/(app)/settings/page.tsx` (converted to async server
  component, fetches session via `supabase.auth.getUser()`,
  passes `user.id` to the button). Both files were added to the
  Slice 5 allowlist mid-review to make AC 13 reachable from the
  user-facing button.
- shadcn Dialog primitive (already installed in Slice 4 review)
  reused for the sign-out confirmation via an inline `<dialog>`
  in `signOut.ts` — no new modal component file.

### Bug fix included in the same slice (not a corrective Slice 5.1)

- Failure-block auto-advance was bypassing the block-completion
  writer. `src/components/log/LoggerShell.tsx` — failure-block
  `onComplete` callback now calls
  `handleFreeFormComplete(block.block_id)` instead of
  `advanceToNextBlock(completedBlockIdsRef.current)`. Both failure
  and free-form protocols now converge on the same writer.

### Verification

- AC 1 verified: bodyweight muscle-ups block writes
  `completed_block_ids` on auto-advance (block_array_len went
  from NULL to 1 after Set 3 save).
- AC 2 verified: weighted Cable Lat Pulldown failure block also
  writes correctly (block_array_len = 2 after second block
  auto-advance). Failure protocol path was directly exercised,
  which is the exact code path the fix targeted.
- AC 4 verified: `set_logs` persistence path unchanged; six
  successful 201 POSTs across both blocks.
- AC 5 verified: no new console errors; only a pre-existing
  Next.js dev-mode CSS preload warning.
- AC 3 (mobility explicit-button path regression check):
  DEFERRED to next Lower ATG mobility session. Risk of regression
  is near-zero (explicit-button code path was untouched by the
  fix). Reminder logged in KNOWN_ISSUES.md to verify on next
  mobility session.

## Slice 6.1 — History Read Scaffold (2026-05-03)

### What was built

- History tab read scaffold: PR Timeline (`/history`) and All Sessions
  list (`/history/sessions`), both Server Components. Slice 6.2 ships
  Exercise Progress + Session Detail.
- Four data-layer modules under `src/lib/history/`:
  - `queries.ts` — `getPRTimeline` and `getAllSessions`. Multi-step
    server-side reads + in-memory bucketing via Maps; no N+1. Hybrid
    PR-count derivation (FK join + time-window filter) per
    ARCHITECTURE §16.4 Q2.
  - `projections.ts` — `PRTimelineRow` and `AllSessionsRow` types.
  - `displayName.ts` — `formatSessionDisplayName(name, startedAt)`
    using native `Intl.DateTimeFormat`. No date library.
  - `crossLinks.ts` — `exerciseProgressHref`,
    `sessionDetailHref`, `allSessionsHref`.
- Six route-scoped components under
  `src/app/(app)/history/_components/`: `PRTimelineRow`,
  `PRTimelineShowAllToggle` (the only Client Component in the slice),
  `AllSessionsRow`, `SessionStateBadge`, `PRTypeBadge`,
  `HistoryHeaderLink`.
- Two cross-link components in `src/components/shared/`:
  `ExerciseLink` and `SessionLink`. Single source of truth for the
  F6 cross-link contract; reusable by Slice 7's "Library" tab and
  Slice 6.2's surfaces.
- Two placeholder routes for Slice 6.2 cross-links:
  `/history/exercises/[exercise_id]` and
  `/history/sessions/[completion_id]`. No data fetching.
- Slice 1 `<h1>History</h1>` placeholder at `(app)/history/page.tsx`
  replaced with the full PR Timeline Server Component.

### Bugs caught and fixed during the build

- **Schema drift on `sessions.session_name`.** The slice doc,
  MASTER_SPEC §12.6, ARCHITECTURE §16.4, and Codex's generated queries
  all referenced a column named `name` on the sessions table. The
  live DB has the column named `session_name` (the table also has 9
  other columns out of Slice 6.1 scope). Caught at pre-test
  environment setup, before any browser test ran. Fixed: 6
  references in `queries.ts` rewritten to `session_name`; spec docs
  corrected with a one-line note in §7 of the slice doc that
  additional columns exist but are out of scope. Workflow
  improvement candidate logged.
- **PR Timeline tie-ordering on identical `achieved_at`.** Phase A
  Tests 1 + 2 surfaced that `getPRTimeline` ordered only by
  `achieved_at DESC` with no secondary sort key. Same-timestamp PR
  pairs rendered in incidental query-plan-stable order. Added
  `pr_id DESC` as deterministic tiebreaker.

### F8 partial delivery (ahead of Slice 6.2 schedule)

- AC #21 deferred F8 (PR-type visual distinction) to Slice 6.2.
  Codex's `PRTypeBadge` already implements distinct color schemes:
  `weight` uses the lilac `accent` token; `in_range_rep` uses
  `sky-400`/`sky-200` tokens. Both Tailwind theme tokens, no
  hardcoded hex. Zero additional complexity, makes the Show-all
  view immediately scannable. Retained; documented in DECISIONS.md.
  Slice 6.2 still owns F8 polish if deeper differentiation surfaces
  during testing.

### Notable design rules captured

- **PR Timeline overlap heuristic** for matching `pr_history` rows to
  `session_completions`: pick the most-recently-started qualifying
  completion. Implemented unambiguously in `findMatchingCompletion`
  via a descending-`started_at` sort + first-match scan. Logged in
  DECISIONS.md.
- **`pr_history (set_log_id, pr_type)` partial UNIQUE constraint**
  provenance traced to migration `009_workout_logger.sql:50–52`.
  Test 2 fixture's "duplicate weight PR for same set_log_id" attempt
  was correctly rejected — the partial unique index does its job.
  No immutability violation; documented for the audit trail.

### Verification

- Phase A manual tests: 10 of 13 passed end-to-end. Tests 3, 5, 9
  (empty-state copy variants) deferred per Path B because running
  them required wiping `pr_history` and `session_completions`.
  Empty states verified by code inspection: copy matches AC #6 and
  AC #13 verbatim; Show-all toggle renders in both PR Timeline
  empty variants (edge case 11). Logged to FUTURE_WORK for
  end-to-end verification at first integration milestone.
- Inspection-verified ACs: #6, #7, #13, #15, #20, #21.
- TTFB on `/history` measured 300–572 ms in dev mode (under the
  1s 🟡 threshold; spec target is 200ms). Dataset was
  under-realistic (4 PRs vs spec's ≥5). FUTURE_WORK entry filed
  for production re-benchmark post-Slice 6.2.
- `pnpm exec tsc --noEmit` ✓, `pnpm lint` ✓,
  `pnpm format:check` ✓ (Slice 6.1 files only).
- No new dependencies. Recharts deferred to Slice 6.2.
- No schema/RLS/migration changes.

## Slice 7a — Library Tab + Workouts Rename (2026-05-04)

### What was built

- **Schema cascade rename: `sessions` → `workouts`.** Migration 013
  renames the table and three columns (`session_id` → `workout_id`,
  `session_name` → `workout_name`, `session_type` → `workout_type`),
  cascades through `set_logs.session_id`, renames `session_completions`
  → `workout_completions`, and renames `block_exercises` →
  `block_lifting_items`. Opens with a Step 0 test-data wipe (Slices
  4-6 verification data) so the subsequent UNIQUE-index step commits
  cleanly. Slice 2's three seeded historical PRs (`set_log_id IS NULL`)
  are preserved.
- **Blocks promoted to a global per-user catalog.** Migration 013 drops
  `blocks.session_id`, adds `blocks.owner_user_id`, adds
  `block_category_enum` (`lifting` / `cardio` / `recovery`), makes
  `block_type` nullable for cardio/recovery, adds CHECK constraint
  `blocks_lifting_has_type`, and adds
  `UNIQUE (owner_user_id, block_name)`.
- **`workout_blocks` junction table** (migration 014) wires workouts
  to blocks with `display_order` + polymorphic
  `(preset_activity_id, preset_activity_type)` for cardio/recovery
  preset wiring.
- **Cardio + recovery catalogs** (migration 015): `cardio_activities`,
  `recovery_activities`, `block_cardio_items`, `block_recovery_items`,
  and a polymorphic `activity_completions` table (schema-only in 7a;
  UI defers to a future slice).
- **Comprehensive RLS extension** (migration 016): blocks +
  block_lifting_items policies recreated with direct
  `auth.uid() = owner_user_id` scoping (was FK-chain through sessions);
  4-policy patterns added on all five new tables; `workout_blocks` uses
  FK chain through `workouts → daily_schedules → training_plans`.
- **Library tab as 6th bottom-nav surface** (Today / Plan / Library /
  History / Nutrition / Settings). Labels resized 11px → 10px to fit
  six tabs at 375px viewport. `Library` lucide icon. `startsWith`
  match preserved so `/library/lifting/blocks/[id]` keeps the tab
  highlighted.
- **Library sub-tab IA** with URL-segment routing:
  `/library` redirects to `/library/lifting`. Three sub-tabs
  (`/library/lifting`, `/library/cardio`, `/library/recovery`) render
  as Server Components; each fetches only its own data. `LibraryTabs`
  is the slice's only Client Component (uses shadcn `Tabs` primitive
  for the sub-tab navigator, derives active sub-tab from
  `usePathname()`).
- **Lifting sub-tab**: lists user's lifting blocks alphabetically as
  `BlockListCard`s (block name, block_type badge, exercise count).
  Tap → `/library/lifting/blocks/[block_id]` block detail page (block
  header + exercise bank in `display_order` with prescribed range,
  muscle-group caption, bodyweight tag, per-exercise notes).
- **Cardio sub-tab**: single cardio block always-expanded inline; lists
  cardio activities (name, format badge, distance, target zone). No
  drill-in.
- **Recovery sub-tab**: single recovery block always-expanded inline;
  lists recovery activities (name + description). No drill-in.
- **`BlockLink` cross-link component** (`src/components/shared/`)
  extends the F6 contract from Slice 6.1's `ExerciseLink` /
  `SessionLink` (renamed to `WorkoutLink` here). Single source of href
  truth in `src/lib/library/crossLinks.ts` (`blockDetailHref`,
  `liftingHref`, `cardioHref`, `recoveryHref`).
- **Wiki rewrite** (`supabase/seed/wiki/current-plan.md`): four block-
  name uniqueness edits to satisfy the new global UNIQUE constraint —
  Mid Chest → Bench Press Focus, Lateral Raise → Shoulder Burnout,
  Hot Yoga/Sauna split into Saturday Sauna + Sunday Hot Yoga, and
  Saturday Lower ATG's Calves → ATG Calves. Cross-workout reuses
  (`Vertical Pull` etc.) intentionally retained — the catalog model
  working as designed.
- **Seed parser rewrite** (`supabase/seed/lib/methodology-rules.ts`,
  `seed-from-wiki.ts`, `lib/types.ts`): new `parseLiftingBlocksGlobal`
  helper deduplicates by `(owner_user_id, block_name)` into the global
  catalog; `workout_blocks` rows wire workouts to blocks; new
  `parseCardioActivities` and `parseRecoveryActivitiesCatalog` helpers
  populate the activity tables; `workout_blocks.preset_activity_id`
  populated for cardio + recovery workouts (NULL for lifting). Re-seed
  remains idempotent (Inserted 0 / Updated 0 / Deleted 0 on second
  run).
- **Rename-adaptation pass across existing surfaces**: Today, Plan,
  Logger, History, and Sync layer all updated to reference renamed
  DB columns. `today/session/[session_id]` → `today/workout/[workout_id]`,
  `log/[session_id]` → `log/[workout_id]`. `SessionSummary` →
  `WorkoutSummary`, `EndSessionDialog` → `EndWorkoutDialog`,
  `SessionLink` → `WorkoutLink`, `getAllSessions` → `getAllWorkouts`.

### Deviations from the slice spec

- **TS-level `session_*` identifiers half-renamed.** ~25 references
  across 11 files (logger components, plan day route, page-level prop
  types, sync queue discriminated-union kinds) still use `session_id` /
  `session_name` / `session_type` / `session_completion_*` as in-memory
  JS field and prop names. DB layer is fully renamed and runtime is
  unaffected. Edge Case 17 said the quality-review pass should rewrite
  these; bundling the mechanical rename into 7a was deemed riskier
  than helpful (would have diluted attention from the Calves issue and
  added rename-introduced-bug risk to a slice already touching ~55
  files). Deferred to Slice 7a.5 — a focused mechanical-rename PR
  with no schema or behavioral changes. Logged 🟡 in KNOWN_ISSUES.md.

### Bugs caught and fixed during the build

- **Calves block_type collision.** Codex's first-pass parser hit a
  same-name + different-block_type collision on "Calves" (Tuesday
  Lower Compound = `failure`; Saturday Lower ATG block 8 = `mobility`
  per Slice 2 spec). Resolved at first pass by hard-coding an override
  forcing all "Calves" to `failure`, silently flipping Saturday's
  classification. Caught in Phase 4B. Fix: renamed Saturday's "Calves"
  → "ATG Calves" in the wiki (mirroring the Phase 0 rename pattern
  for Mid Chest / Lateral Raise) and reverted the parser override.
  Restored Slice 2's mobility classification. Verified end-to-end via
  re-seed: `ATG Calves` → `mobility`, `Calves` → `failure`.
- **Migration 013 UNIQUE-index conflict (caught pre-Codex).** The
  initial spec applied `UNIQUE (owner_user_id, block_name)` against a
  populated blocks table with cross-workout name duplicates. Would
  have failed with 23505. Pre-hardened with a Step 0 test-data wipe
  before Codex generation (committed at 9ce6839, documented in
  DECISIONS.md).
- **Migration 014 in-place RLS dependency.** Old policies on `blocks`
  and `block_lifting_items` referenced `session_id` via FK chain
  through sessions; once 013 renamed `session_id` → `workout_id`,
  those policies became orphaned. 014 correctly drops them before
  `ALTER TABLE blocks DROP COLUMN session_id`; 016 recreates them
  with direct `auth.uid() = owner_user_id` scoping.

### Verification

- Phase 5 manual tests T25 + T26 (cross-link contract enforcement):
  pass. `next/link` imports confined to `BlockLink.tsx`,
  `WorkoutLink.tsx`, `ExerciseLink.tsx`, and `LibraryTabs.tsx`. Zero
  hardcoded `/library/...` paths anywhere outside `crossLinks.ts` +
  `BlockLink.tsx`. `crossLinks.ts` is the single source of href
  truth.
- `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm format:check` ✓.
- Re-seed idempotent (Inserted 0 / Updated 0 / Deleted 0 on second
  run).
- Migrations 001-012 untouched (immutability rule held). All schema
  work in 013-016.
- `phase-5b-drafts/`, `workflow-v3.md`, `setup-guide-v2.md` added to
  `.prettierignore` (Marcus-owned drafts, not version-controlled
  deliverables).

## Slice 7a.5 — TS-level session\_\* rename cleanup (2026-05-04)

### What was built

- Mechanical TS-rename PR closing the 🟡 KI from Slice 7a. 88
  substring substitutions across 14 files: snake*case fields
  (`session_id` → `workout_id`, `session_name` → `workout_name`,
  `session_type` → `workout_type`, `session_completion*{start,
  block*complete, end}`→`workout_completion*\*`), camelCase
identifiers (`sessionId`→`workoutId`, `sessionType`→`workoutType`— cascades to`sessionTypeLabel`→`workoutTypeLabel`—`sessionCompletion`→`workoutCompletion`,
`targetSessionId`→`targetWorkoutId`), and type/function names
(`SessionCompletionRecord`→`WorkoutCompletionRecord`,
`getOrCreateSessionCompletion`→`getOrCreateWorkoutCompletion`,
`LoggerSession`→`LoggerWorkout`).
- File rename: `src/lib/methodology/session-state.ts` →
  `src/lib/methodology/workout-state.ts`. Seven import paths
  updated.
- `Enums<"session_type_enum">` references intentionally retained
  — the underlying Postgres enum type still carries the old name;
  renaming requires `ALTER TYPE session_type_enum RENAME TO
workout_type_enum` paired with `supabase gen types`. Logged in
  FUTURE_WORK.md under Schema cleanup; bundle with the FK
  constraint name carryovers in a future cosmetic-cleanup pass.

### Closed during this slice

- 🟡 Slice 7a TS-level session\_\* half-rename
- 🟡 Slice 4 S4-M1 (in-flight save lost on tab close) — verified
  resolved by Slice 5's queue-on-failure pattern during Slice 7a
  pre-test setup
- 🟢 Slice 5 mobility-PR detection path — verified during Slice
  6.1 Phase A; both code paths converge on the same writer

### Verification

- `pnpm typecheck` ✓ (clean on first try after the sed pass),
  `pnpm lint` ✓, `pnpm format:check` ✓.
- Residual grep: zero matches for renamed identifiers anywhere in
  `src/` outside `src/lib/supabase/types.ts` (DB-generated) and
  the documented `Enums<"session_type_enum">` carryover.
- No schema changes. No migrations. No dependency changes.
- No spec, no Phase 5 — pure mechanical rename per scope.

## Slice 7b — Library Edit (2026-06-16)

### What was built

- **Create + Update across all four Library surfaces** — lifting
  blocks, exercises, cardio activities, recovery activities. Delete
  stays out of scope (deferred to a future slice).
- **Migration 017** (`017_library_edit_uniqueness.sql`): idempotent
  `CREATE UNIQUE INDEX IF NOT EXISTS` on `cardio_activities`
  (owner_user_id, name), `recovery_activities` (owner_user_id, name),
  and `block_lifting_items` (block_id, exercise_id). No-op against the
  constraints migration 015/002 already established; migrations 001-016
  untouched. Types regenerated.
- **Form library adoption** (executes the Slice 1/4 deferred decision):
  `react-hook-form` 7.75.0 + `zod` 4.4.2 + `@hookform/resolvers` 5.2.2,
  plus nine shadcn primitives (`form`, `sheet`, `input`, `textarea`,
  `select`, `checkbox`, `label`, `popover`, `command`) and their
  transitive deps (`@radix-ui/react-{checkbox,label,popover,select,slot}`,
  `cmdk`). No other new dependencies.
- **Exercises sub-tab** added as the 4th Library section
  (`/library/exercises`). Lists the user's exercises alphabetically as
  `ExerciseListCard`s (name, primary muscle-group caption, prescribed
  range, bodyweight tag, per-row pencil). Four sub-tab labels fit at
  375px without truncation.
- **Block create/edit** as full-page routes (`/library/lifting/blocks/new`,
  `/library/lifting/blocks/[id]/edit`). `BlockForm` is lifting-only:
  block name (async-unique), Protocol Select (block_type, no default),
  and a bank-composition section with reorder (↑/↓, disabled at
  boundaries), remove, and add-via-`ExercisePicker`. The picker supports
  inline-create of a new exercise (nested Sheet → auto-select → append).
  Edit mode pre-fills, shows a static "Lifting block" label, and renders
  the historical-set-log `block_type` warning per AC #22.
- **Sheet-modal create/edit** for exercises, cardio, and recovery
  activities, with a per-row pencil affordance (`EditPencilButton`).
  `MuscleGroupMultiSelect` exposes the locked 11-tag taxonomy in two
  grouped sections (Primary 7 + Specific 4). `DiscardChangesDialog`
  fires on dirty Sheet close.
- **Data layer:** `schemas.ts` (four zod schemas with async uniqueness
  refines), `mutations.ts` (one helper per entity/action, discriminated
  `{ ok }` results, 23505/23514/42501 → friendly errors), `uniqueness.ts`
  (`nameConflicts`). Extended `queries.ts` (`getExercises`,
  `getHistoricalSetLogCount`), `projections.ts` (`ExerciseListItem`),
  `crossLinks.ts` (`exerciseDetailHref`, `blockEditHref`,
  `blockCreateHref`).
- All Library writes use the supabase **browser client** directly — no
  Server Actions, no Slice 5 sync queue. Cardio/recovery create
  auto-wires the new activity to the user's single block via
  `block_{cardio,recovery}_items` with `display_order = MAX + 1`.

### Deviations from the slice spec

- **BlockForm is lifting-only with `block_category` derived from the
  route** (AC #16 revision / Q5b correction locked in Phase 0). No
  category Select renders in create or edit — so the legacy wording of
  test cases T6/T9 (a "3-option category Select" and a cardio structural
  toggle) is **superseded**; verification ran against the revised
  lifting-only behavior, confirmed correct.
- `src/app/layout.tsx` (outside the Section 3 allowlist) gained
  `suppressHydrationWarning` on `<body>`. Cosmetic; no behavioral change.
- The existing 7a `ExerciseListItem` is reused on the block-detail page
  for notes rendering; the new `ExerciseListCard` (per Section 3) backs
  the Exercises sub-tab list.

### Bugs caught and fixed during the build

- **ExerciseForm reps inputs bound `value={NaN}`** when cleared (React
  controlled-input warning). Guarded — caught in the line-by-line
  quality review.
- **T7 — submit button stayed enabled while the async name-uniqueness
  error was showing.** Fixed `BlockForm` to disable the submit button on
  `formState.isSubmitting || Object.keys(formState.errors).length > 0`
  (keying off `errors` rather than the async-lagging `isValid`). Verified
  live: button disables on a duplicate name, re-enables once corrected,
  and does not over-disable the still-untouched Protocol field.

### Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` all
  clean. Migration 017 applied (Local 017 | Remote 017).
- **Authenticated browser E2E at 375px** across the T1-T54 plan. Live
  PASS on every high-value flow: 4 sub-tabs render/fit; block create →
  redirect to detail with DB-verified `block_lifting_items`
  (display_order = 0); inline-create exercise auto-selects and appends;
  reorder boundary disabling; bank update via delete-then-insert
  (DB-verified order); exercise validation trio (muscle-required /
  max ≥ min / async uniqueness); notes propagation to block detail;
  cardio/recovery junction `display_order = MAX + 1` (DB-verified);
  discard-changes dialog (Cancel keeps / Discard closes); no console
  errors; 7a read flows + Today/History/nav regression clean.
- block_type warning (T20/T21) verified by code (logic + copy match
  AC #22) plus the live negative case (T22); the positive case was
  deliberately **not** simulated to avoid fabricating rows in the
  append-only `set_logs` table.
- Verification harness (authenticated-session cookie injection via
  `@supabase/ssr`, wiki-catalog seed, cleanup) kept local under
  `e2e/_setup/` — untracked, not a slice deliverable. The seeded test
  user and catalog were fully cleaned up afterward (0 residual rows).

## Slice 8 — Nutrition (Dashboard + Log Meal + Targets) (2026-06-16)

> Solo-built (Claude Code as drafter) with an independent reviewer-subagent
> cross-check standing in for the Codex↔Claude two-model loop, per the
> 2026-06-16 decision to complete the app without the Codex web session.

### What was built

- **Nutrition tab promoted from a 3-line stub to a working surface.** Spec:
  `spec/slices/SLICE_8_NUTRITION.md`.
- **4A Dashboard (`/nutrition`):** an auto-contextual day-type meal-framework
  card (derived from today's active-plan schedule × goal mode), four macro
  progress bars (calories / protein / carbs / fat) against the user's target
  ranges with under/in/over status shown by **both** color and a text label
  (accessibility), today's logged meals + totals, and a Log Meal CTA. Shows a
  "Set targets" prompt instead of bars when no targets exist, and an empty
  state when no meals are logged.
- **4B Log Meal:** a bottom-Sheet form (reusing the Slice 7b RHF + zod +
  shadcn standard) — free-form meal type, protein/carbs/fat in grams, a **live
  auto-derived calories preview** (4P + 4C + 9F), and an optional note. Insert
  refreshes the dashboard in place.
- **5D Targets editor (`/nutrition/targets`, subset):** full-page form, eight
  fields (cal/protein/carbs/fat min+max) with strict `min < max` validation
  mirroring the DB CHECK, a **macro-to-calorie consistency check** that flags
  when the entered calorie range diverges >±10% from the macros' implied
  range, and **goal-mode default seeding** when the user has no targets yet.
  Upserts the single per-user row.
- **No new migration:** `nutrition_targets` + `meal_entries` already existed
  (migration 005, RLS 008). Confirmed columns/constraints match and reused
  them. No new dependencies.
- **Module layout:** pure math/defaults/framework in
  `src/lib/methodology/nutrition.ts`; IO in `src/lib/nutrition/{queries,
mutations,schemas,projections}.ts` (browser-client writes, no Server
  Actions, no Slice 5 queue); presentation in
  `src/app/(app)/nutrition/_components/`. `MacroProgressBar` is built reusably
  so the Today dashboard's macro mirror can adopt it later.

### Deviations / scope

- Goal Mode selector + 5E.1 recommendation flow deferred to the Settings
  slice (goal_mode is read from `profiles` to seed target defaults).
- Mirroring the macro bars onto the Today dashboard deferred to the Today
  slice (component built reusably).
- Meal entries are append-only **via UI** (no edit/delete affordance), per
  MASTER_SPEC; the DB retains UPDATE/DELETE policies.

### Reviewer-subagent findings (fixed)

- **M1:** `translateMutationError` was missing the 23505 mapping the spec
  requires — added (unreachable for the targets upsert, but spec-complete).
- **M2:** recovery-only training days were mislabeled "Cardio day"; now they
  fall through to "rest" guidance (nutritionally closer). Reviewer also
  verified macro-math agreement across preview/insert/dashboard, schema
  fidelity, module boundaries, and server/client date consistency.

### Verification

- `pnpm typecheck` / `lint` / `format:check` / `build` all clean (the
  `/nutrition` and `/nutrition/targets` routes compile).
- **Authenticated browser E2E at 375px:** rest-day framework card renders;
  no-targets prompt → Targets editor seeded with maintain defaults →
  consistency check shows green "~2270–2890 kcal" → save → dashboard shows the
  four bars (all "Under"); Log Meal preview computes 535 kcal for P40/C60/F15
  → save → bars + meal list update live; a second meal pushes protein to
  170/160–200 and the bar flips to green **"On target"**. DB verified:
  one `nutrition_targets` row + `meal_entries` rows with derived `calories`.
  No console errors. (The "over"/danger status uses the identical
  status→color map as the verified "under"/"in" cases.)
- A one-time Next.js **dev-mode** first-compile 500
  (`__webpack_require__ ... reading 'call'`) appeared on the very first
  `/nutrition` request and immediately recovered (200, no recurrence); the
  production build compiles the route cleanly, confirming it was an HMR
  transient, not a code defect.
- Test user + seeded data fully cleaned up afterward (0 residual rows).

## Slice 9 — Settings + Profile + Goal Mode Recommendation (2026-06-16)

> Solo-built (Claude Code drafter) with an independent reviewer-subagent pass.
> Spec: `spec/slices/SLICE_9_SETTINGS.md`. No new migration.

### What was built

- **5A Settings menu (`/settings`):** replaced the sign-out-only stub with a
  hub — rows linking to Profile, Nutrition targets, and the Exercise library,
  plus the existing Sign out. (Plan Editor row omitted until that slice ships.)
- **5E Profile (`/settings/profile`):** RHF + zod form for display name,
  bodyweight (kg), height (cm), and goal mode. Bodyweight/height accept a
  positive number or blank (→ null); display name optional. Upserts `profiles`
  via the browser client.
- **5E.1 Goal Mode Recommendation:** when goal mode changes and the profile
  saves, a Sheet opens showing each macro/calorie range as "current →
  recommended" (recommended = the Slice 8 `goalModeDefaultTargets(newMode)`)
  with a per-group Apply toggle (default on when the values differ, or when no
  targets exist yet). "Apply selected" writes only the toggled groups to
  `nutrition_targets` (others keep current values); "Keep current" leaves them
  untouched. Closes the nutrition goal-mode loop end to end.
- **Reused, no new schema:** `profiles` already had all four columns
  (migration 001); the recommendation reuses Slice 8's `goalModeDefaultTargets`
  - `upsertTargets`. New pure helper `applyTargetToggles` in
    `methodology/nutrition.ts`. No new dependencies, no migration.

### Key invariant (5E.1)

- Apply toggles are **per macro group** (a toggle flips both `_min` and `_max`
  together), so `applyTargetToggles` always takes a group's min and max from
  the **same** source — a mixed result that could violate the DB
  `CHECK(min < max)` is structurally impossible. With no existing targets, the
  recommended set is the merge base, so every field resolves to a valid integer
  (no null/NaN can reach the NOT-NULL columns).

### Reviewer-subagent findings (fixed)

- Defaulted each Apply toggle on only when its values differ (spec intent), and
  keyed the recommendation Sheet on the mode so it remounts fresh per change;
  dropped a redundant `router.refresh`. Reviewer confirmed the central
  min<max / no-null invariant holds in both has-targets and no-targets cases,
  plus schema fidelity, module boundaries, and the nullable-number handling.

### Verification

- `pnpm typecheck` / `lint` / `format:check` / `build` all clean
  (`/settings` + `/settings/profile` compile).
- **Authenticated browser E2E:** menu renders with working links; profile form
  pre-fills; filled name/bodyweight/height and changed goal mode to Lean bulk →
  save opened the recommendation Sheet ("no targets yet", all rows
  "— → recommended") → Apply seeded the lean_bulk defaults. DB verified:
  `profiles` = {Marcus, 82, 180, lean_bulk} and `nutrition_targets` =
  2800–3200 / 170–210 / 320–400 / 80–100. No console errors. (Same benign
  dev-mode first-compile 500 transient as Slice 8 on the first `/settings`
  hit; recovered immediately; production build is clean.)
- Test user + data fully cleaned up afterward (0 residual rows).

## Slice 10 — Plan Editor (non-destructive v1) (2026-06-16)

> Solo-built (Claude Code drafter) with an independent reviewer-subagent pass.
> Spec: `spec/slices/SLICE_10_PLAN_EDITOR.md`. No new migration.

### What was built

- **Edit a training day in-app** (`/plan/[day]/edit`, with an "Edit day" button
  on the day detail): toggle rest day, rename / re-time (AM·Anytime·PM) /
  re-gym the day's sessions, reorder them (↑/↓), add a new lifting session, and
  remove a session.
- **Schedule validation on save:** a hard rule (the week must keep ≥ 1 rest
  day) disables save with an inline error; a soft rule (cardio scheduled before
  lifting on the same day) warns and flips the button to "Save anyway —
  overriding N warning(s)".
- **Data layer:** pure validation in `src/lib/methodology/plan-schedule.ts`;
  `src/lib/plan/{queries,mutations,schemas,projections}.ts`. Browser-client
  writes, no Server Actions, no Slice 5 queue.

### Two data-integrity guardrails (the reason v1 is scoped this way)

`workouts` rows are referenced by logged history and a CHECK constraint:

- **History is never destroyed.** `set_logs`, `workout_completions`, **and**
  `activity_completions` all FK `workout_id → workouts ON DELETE CASCADE`.
  Plan Editor is non-destructive: a session with any logged history can't be
  removed — the UI disables its remove control and `saveDay` re-checks all
  three tables server-side and refuses the save if a removed id has history.
  Edits are diff-based (UPDATE existing / INSERT new), never delete-then-insert,
  so existing sessions' `workout_blocks` and history are never cascade-touched.
- **Cardio CHECK preserved.** `saveDay` never changes `workout_type` (the form
  has no type control) and new sessions are always `lifting` with no cardio
  fields, so the `cardio` CHECK (migration 002) can't be violated.

No migration needed — these are scoping choices.

### Reviewer-subagent findings (fixed)

- **Critical (fixed):** the history guard originally checked only `set_logs` +
  `workout_completions`; the reviewer caught that `activity_completions`
  (migration 015) is a **third** `ON DELETE CASCADE` table, so a completed
  cardio/recovery session could have been removed and its activity history
  silently cascade-deleted. Added `activity_completions` to **both** guards
  (the UI `has_history` query and the mutation re-check). Reviewer also verified
  the diff/removed-id computation, the cardio-CHECK safety, and the validation
  logic.

### Verification

- `pnpm typecheck` / `lint` / `format:check` / `build` all clean
  (`/plan/[day]/edit` compiles).
- **Authenticated browser E2E:** opened `/plan/mon/edit` (seeded plan) →
  pre-filled with Speed Run (cardio, AM) + Upper (lifting); the
  cardio-before-lifting soft warning rendered and the button read "Save anyway
  — overriding 1 warning"; renamed Upper → "Upper Body" and saved → redirected
  to the day detail showing the new name with its blocks intact. DB verified:
  Monday still has exactly two workouts (no loss/duplication), types preserved,
  display_order renormalized — confirming the diff update, not delete-insert.
  No console errors.
- The history-disabled-remove and hard-rest-day-block paths are verified by the
  reviewer + code (couldn't fabricate logged history live without writing to
  append-only tables). Test user + seeded data cleaned up (0 residual rows).

## Slice 11 — PWA (installable + offline shell) (2026-06-16)

> Solo-built (Claude Code). Spec-light. No new migration, **no new dependency**.

### What was built

- **Installable PWA, dependency-free** (no next-pwa / workbox):
  - `src/app/manifest.ts` → `/manifest.webmanifest` (name "Training",
    standalone, `start_url:/today`, scope `/`, black background/theme, SVG
    icons any + maskable).
  - `public/icon.svg` + `public/icon-maskable.svg` — a lilac dumbbell mark
    (maskable variant keeps the glyph in the safe zone).
  - Root-layout metadata: `applicationName`, `appleWebApp` (status bar +
    title), icons, and a `viewport` export with `themeColor` + `viewportFit:
cover`.
- **Offline support:**
  - `public/service-worker.js` — hand-rolled, network-first for navigations
    with a cached `/offline` fallback. Deliberately does NOT cache Supabase
    API responses or app data (auth/training data must stay fresh); it only
    serves an offline shell.
  - `src/app/offline/page.tsx` — a static, auth-free offline page.
  - `src/components/pwa/ServiceWorkerRegistrar.tsx` — a client island that
    registers the SW on load, mounted once in the root layout.

### Notes / decisions

- Used `public/service-worker.js` (not `public/sw.js`, which `.gitignore`
  reserves for next-pwa-generated output) so the hand-authored worker is
  committed as source. Chose a dependency-free worker over next-pwa to avoid
  Next 15 App Router build-integration risk — see DECISIONS.
- Icons are SVG (any + maskable). Installable in modern Chromium; a future
  pass can add rasterised PNG sizes for stores / older tooling (FUTURE_WORK).

### Verification

- `pnpm typecheck` / `lint` / `format:check` / `build` all clean
  (`/manifest.webmanifest` + `/offline` build as static routes).
- **Live (browser):** `/manifest.webmanifest`, `/service-worker.js`
  (application/javascript), `/icon.svg` (image/svg+xml), and `/offline` all
  serve 200. On the app, the service worker **registers and is active at root
  scope** (`navigator.serviceWorker.getRegistration()` → active, scope `/`),
  the manifest link is injected (`/manifest.webmanifest`), and the
  standalone/theme metas are present (`theme-color`, `mobile-web-app-capable`,
  `apple-mobile-web-app-title/status-bar-style`). All browser install criteria
  (manifest + active SW + icons + standalone + start_url) are met. No console
  errors.
- The offline-fallback path is verified by code + the cached `/offline` entry
  (toggling real network offline isn't scriptable here).

## Slice 12 — Multiple plans + active-plan switcher (2026-06-16)

> Solo-built (Claude Code) + reviewer-subagent pass. Spec:
> `spec/slices/SLICE_12_MULTIPLE_PLANS.md`. No migration, no new dependency.

### What was built

- A **plan switcher** on `/plan`: a Select of all the user's plans (active
  selected) plus "Rename" and "New plan". Switching activates the chosen plan;
  the active plan drives Today, the Plan week, the Plan Editor, and the
  Nutrition day-type.
- `createPlan` seeds an empty **7-day rest-day skeleton** (`daily_schedules`
  mon–sun); new plans are inactive unless the user has no active plan. A new
  plan is built out via the existing Plan Editor (Slice 10).
- `activatePlan` enforces **exactly one active plan** in app code; `renamePlan`
  with a friendly duplicate-name (23505) message.
- `src/lib/plan/plan-mutations.ts` + `PlanControls.tsx`; `page.tsx` gains
  `getPlans()` and handles the zero-plans / no-active states.

### Reviewer-subagent findings (fixed / accepted)

- **Fixed:** `createPlan` no longer self-activates on a count-query error (which
  could have stolen active status); a failed skeleton insert now
  compensating-deletes the orphan plan; friendly 23505; the switcher refreshes
  on activate-failure to resync, disables Rename when there's no active plan,
  and clears stale errors.
- **Consciously accepted (🟡, see KNOWN_ISSUES):** the activate is two
  non-transactional statements. Deactivate-first is deliberate — a partial
  failure degrades to _zero_ active (graceful empty state, recoverable) rather
  than _two_ active (which would crash every `maybeSingle()` reader). A truly
  atomic switch (RPC / partial unique index) is in FUTURE_WORK.

### Verification

- typecheck / lint / format:check / build clean (`/plan` rebuilt with controls).
- **Live (browser):** created "Cut Phase v1" → it appeared in the switcher →
  switched active → the week became the empty rest skeleton; reset to base.
  DB verified: 2 plans, **exactly 1 active**, and the new plan got its 7-day
  mon–sun skeleton. No data deleted (no delete affordance in this slice).

## Slice 13 — Macro ranges + edit/delete meals (2026-06-17)

> Solo-built (Claude Code) + reviewer-subagent pass. Migration 018. Spec:
> `spec/slices/SLICE_13_MEAL_RANGES.md`.

### What was built

- **Meals are now range-based.** Migration 018 adds min/max columns for each
  macro + calories to `meal_entries`, backfills existing rows (min=max=value),
  deprecates the old single columns (nullable, no longer written), and adds
  `max >= min AND min >= 0` CHECKs.
- **Log Meal reworked:** an **exact/range toggle** — exact mode shows one input
  per macro (saved as min=max); range mode shows Low/High. Leaving range mode
  collapses max→min so the single-input view is WYSIWYG. Live calorie preview
  shows a single value or a range (e.g. "535–660 kcal"). Calories derive as a
  range from the macro bounds.
- **Edit + delete logged meals:** per-row pencil (re-opens the sheet prefilled;
  range meals open in range mode) and trash (with a confirm dialog).
- **Dashboard shows ranges:** totals sum to a range; each `MacroProgressBar`
  renders a band — solid fill to the lower bound, lighter band to the upper —
  with status via `rangeStatusForRange` (on-target when the logged range
  overlaps the target band).

### Bug caught + fixed during verification

- **Runtime error (caught live, not by typecheck):** the macro _group_ heading
  used `<FormLabel>`, which requires a `<FormField>` context, throwing
  "useFormField should be used within <FormField>". Swapped to the plain
  `Label` primitive.

### Reviewer-subagent findings (fixed)

- **M1:** toggling an existing range meal back to exact mode _without editing_
  could silently persist the stale max. Fixed — leaving range mode now collapses
  each max→min. Reviewer also confirmed the migration ordering is safe (backfill
  before CHECKs; new range-only inserts don't trip the old single-column CHECK
  since NULL passes), the calorie min/max envelope is correct/monotonic, and the
  totals/status math is sound.

### Verification

- `pnpm typecheck` / `lint` / `format:check` / `build` clean. Migration 018
  applied to remote; types regenerated.
- **Live (browser):** logged a range meal (P 40–50 / C 60–70 / F 15–20 →
  live "535–660 kcal"); dashboard showed range bands per macro and
  "535–660 kcal" on the meal; deleted it via the confirm dialog → totals reset
  to 0. No console errors. Demo data cleaned up.

## Slice 14 — AI photo macro estimator (Claude vision) (2026-06-17)

### What was built

- Photograph a meal → Claude estimates protein/carbs/fat as min–max gram
  ranges that prefill `LogMealSheet` in range mode. Builds directly on
  Slice 13's ranges (an estimate is inherently a range).
- `nutrition/macro-estimate.ts` — pure shared contract (only imports zod):
  `macroEstimateSchema` (meal_type + six macro numbers + notes),
  `MacroEstimate`, `ACCEPTED_IMAGE_TYPES`, `MAX_IMAGE_BYTES`. Imported by both
  the server route and the client form so the payload is typed identically.
- `app/api/estimate-macros/route.ts` — server-only POST handler. Gate order is
  **auth (401) → env key (503) → input validation (400/413)**, then
  `claude-opus-4-8` vision via `messages.parse()` with
  `output_config.format = zodOutputFormat(macroEstimateSchema)`. `sanitize()`
  clamps each macro to whole grams 0–1000 and enforces max ≥ min (mirrors
  `gramsField` + the migration 018 CHECK), and falls back to "Meal" if the model
  returns a blank name. Refusal / null `parsed_output` → 422; SDK/network error
  → 502 (logged server-side, never leaked to the client).
- `LogMealSheet` — new `aiEnabled` prop renders an "Estimate from photo" button
  (hidden file input, `capture="environment"` for the phone camera). On success
  `applyEstimate` flips to range mode, fills the six macro fields outright, and
  fills name/note only when still blank (never clobbers typed input). `estimating`
  disables the button; errors surface inline. `MealsSection` / `page.tsx` thread
  `aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}` — a boolean, so the key
  never reaches the client bundle.
- Fully env-gated: with no `ANTHROPIC_API_KEY` the button is hidden and entry is
  manual. Added `ANTHROPIC_API_KEY` to `.env.example` (server-only, optional,
  with a note that uploaded photos are sent to Anthropic).
- Added dependency `@anthropic-ai/sdk` 0.104.2.

### Deviations from the slice spec

- None.

### Bugs caught and fixed

- Reviewer M1: a blank `meal_type` from the model would have left the prefill
  name empty (the form requires `min(1)`). `sanitize()` now falls back to "Meal".
- Reviewer M2: documented that `clamp()` rounds estimates to whole grams
  intentionally (the columns are `numeric` and accept decimals elsewhere).

### Verification

- `pnpm typecheck` / `lint` / `format:check` / `build` clean. Route compiles and
  registers; an unauthenticated `POST /api/estimate-macros` returns 401 (auth
  gate runs before any Anthropic call). Reviewer-subagent pass: no Critical
  findings; safe proxy, no key leak, module boundaries respected.
- The live Claude-vision estimate requires a real `ANTHROPIC_API_KEY` in
  `.env.local` (not present in this environment), so the end-to-end estimate is
  verified by the user after adding their key; the auth gate, env gate, build,
  and no-key UI path are verified here.
