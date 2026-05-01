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
