# DECISIONS

## Slice 1 — Project Scaffold + Auth

### Profile auto-creation lives in the auth callback, not in the (app) layout

The `/auth/callback` route handler runs the profile upsert
(`onConflict: "user_id", ignoreDuplicates: true`) immediately after
`exchangeCodeForSession`. The `(app)` layout treats a missing profile
as a recovery case and redirects back to `/auth/callback`, which
re-runs the upsert from the existing session and forwards to `/today`.

**Options considered**

1. Upsert in `/auth/callback` only (chosen).
2. Upsert in `(app)` layout on every request.
3. Upsert in a Postgres trigger on `auth.users` insert.

**Reasoning**
Option 2 runs an extra write on every authenticated request — wasteful
even with `ignoreDuplicates`. Option 3 couples the app to Supabase's
internal auth schema and makes the upsert invisible from the codebase,
which hurts onboarding for a personal-first project. Option 1 keeps the
write in one obvious place, the callback that already runs once per
sign-in, with a defensive recovery path in the layout for the edge case
where a session exists but the profile row was never written.

### Single-field forms use plain `useState`, not React Hook Form

The `LoginForm` is one email input. RHF + Zod is the project standard
for multi-field forms (per AGENTS.md rule 8) but adds dependency weight
and ceremony for a single field.

**Reasoning**
Personal-first project — keep dependencies and indirection minimal where
the simpler primitive is sufficient. RHF arrives in the slice that
introduces the first multi-field form (likely the workout/log forms in
later slices).

### Env-var getter duplication left in place across the three Supabase files

`getSupabaseUrl()` and `getSupabaseAnonKey()` are defined identically in
`src/lib/supabase/client.ts`, `server.ts`, and `middleware.ts`.

**Options considered**

1. Leave as-is (chosen).
2. Extract to a shared `src/lib/supabase/env.ts` helper.
3. Inline the env reads at point of use.

**Reasoning**
Three small copies (~14 lines each) within one folder. Extraction would
add a fourth file to the supabase/ directory for marginal benefit;
inlining loses the explicit "Missing X" error message. Trigger for
extraction is the fourth Supabase file (likely Slice 2's seed script or
Slice 3's data-access helpers), at which point the duplication crosses
the threshold where a shared helper pays for itself.

### Package scripts use idiomatic form, not full Node paths

Scripts are `"dev": "next dev"`, `"typecheck": "tsc --noEmit"`, etc.,
relying on pnpm's `node_modules/.bin` resolution.

**Reasoning**
The full-path form (`node node_modules/next/dist/bin/next dev`) breaks
silently if Next ever moves its CLI entrypoint and is non-standard for
pnpm projects. The idiomatic form is the convention every contributor
expects.

## Slice 2 — Plan Migration

### Env-var getter consolidation triggered by the fourth Supabase client

Per the deferred Slice 1 decision, the env-var getters were extracted
into `src/lib/supabase/env.ts` once `supabase/seed/lib/supabase-admin.ts`
became the fourth Supabase client. `client.ts`, `server.ts`,
`middleware.ts`, and `supabase-admin.ts` all now import
`getSupabaseUrl`, `getSupabaseAnonKey`, and `getSupabaseServiceRoleKey`
from one place.

**Reasoning**
Three copies were tolerable; four crossed the threshold. The shared
helper is a foundational primitive (no React, no Supabase client
construction logic) so it does not violate the "supabase/seed/ stays
free of application logic" boundary — only build-time-safe code is
crossing.

### Env-var reads use literal `process.env.<NAME>` access, never dynamic bracket access

`src/lib/supabase/env.ts` reads each env var via the literal expression
`process.env.NEXT_PUBLIC_SUPABASE_URL` (etc.) and passes the resolved
value into a shared `requireEnv(name, value)` validator. Dynamic forms
like `process.env[name]` are never used.

**Reasoning**
Next.js's webpack DefinePlugin only inlines `NEXT_PUBLIC_*` env vars
into the client bundle when they appear as literal property accesses
on `process.env`. The earlier `process.env[name]` dynamic-access shape
(initial Slice 2 form of `env.ts`) compiled fine, type-checked fine,
and worked server-side — but in the browser bundle the var read
returned `undefined`, throwing "Missing NEXT_PUBLIC_SUPABASE_URL" at
module load. Static replacement requires the literal token in source.

This is a Next.js / webpack convention worth knowing: any future
helper that reads a `NEXT_PUBLIC_*` var for client-side code must use
literal access. Server-only env vars (`SUPABASE_SERVICE_ROLE_KEY`)
don't need static replacement, but using the same literal-access
pattern keeps the rule simple.

### shadcn Card primitive deviation caught in review

Codex initially skipped `pnpm dlx shadcn add card` and hand-rolled
card styling in `DayCard.tsx` and `SessionDetailPanel.tsx`. The
quality review installed Card and refactored both components to use
`Card` + `CardHeader` + `CardContent`.

**Reasoning**
The slice prompt explicitly required the Card primitive. Hand-rolled
styling drifts from the design system over time and forces every
future card component to re-derive the same Tailwind incantation.
Using shadcn's primitive keeps the Plan tab consistent with the
Button primitive already established in Slice 1.

### Synthetic recovery placeholder removed from `/plan/[day]`

Codex inserted a fake "Recovery — No recovery scheduled today" panel
into days that have no recovery session in the seeded plan. The
review removed it.

**Reasoning**
The Plan tab is a read-only view of the seeded data. Inventing UI
that contradicts the database (a "Recovery" session that doesn't
exist) is feature creep beyond the spec and would mislead the user
about their actual schedule. If a day has no recovery session, the
day card simply doesn't render one.

### Migration immutability rule

Migrations are append-only after first remote application. New
policies, new tables, new columns, or any schema change requires a
new sequentially-numbered migration file. Never edit a migration
that has been pushed to the remote, and never use
`supabase db push --include-all` to force-reapply a modified
migration.

**Options considered**

1. Strict immutability — every change goes in a new migration
   (chosen).
2. Allow edits to applied migrations when "small" — relies on
   discipline, breaks down silently.
3. Reset and re-push the whole migration sequence — destructive,
   only viable in solo-dev pre-prod.

**Reasoning**
Option 1 is the convention every Postgres-shop migration tool
enforces. Codex's first attempt to extend Slice 1's `007` in Slice 2
silently failed: the Supabase CLI does not re-apply tracked
migrations even with `--include-all`, so the file diverged from the
remote without anyone noticing until the test pass caught zero
policies on the new tables. The 008 file is the correct pattern;
007 was reverted to its Slice 1 form and the extended policies live
in `008_extended_rls.sql`.

The CLAUDE.md "Schema discipline" section now codifies this rule
so the next slice's quality review enforces it on Codex
automatically.

### `plan_templates` is append-only history; every content change creates a new version

The seed script writes a new `plan_templates` row whenever the
parsed `TrainingPlanSpec` snapshot differs from the latest version.
A no-op revert (rename → re-rename back) produces three rows: v1
(initial), v2 (after rename), v3 (after revert) — v3's
`snapshot_json` is byte-identical to v1's, but it is still a new
row.

**Options considered**

1. Append a new version on every content change (chosen).
2. Update the latest row in place when the snapshot changes.
3. Compare against any prior snapshot before inserting — skip if
   any version already matches.

**Reasoning**
Option 1 matches the "Train with Marcus" template intent from
Phase 4: the template is forward-compatibility history, not a live
mutable row. Anyone subscribing to a specific version gets stable
content even if Marcus iterates on the wiki. Option 2 collapses
history. Option 3 sounds clever but encourages drift between the
seeded snapshot and what subscribers actually loaded; "the rename
was reverted" is a real edit, even if the bytes match an older
version.

### Block upsert key is `(session_id, display_order)`, not `(session_id, block_name)`

The seed script's block sync looks up an existing block by
`(session_id, display_order)` and updates `block_name` in place
when the wiki rename. This makes a block rename a single
`UPDATE blocks SET block_name = ...` rather than a delete +
re-insert.

**Reasoning**
`block_exercises` joins reference `block_id`. If a rename did
delete + re-insert, the new row would get a fresh `block_id` and
the join rows would either orphan (FK with `ON DELETE CASCADE`
removes them — losing the bank wiring) or have to be re-created
(extra writes, more idempotency risk). Keying on
`display_order` keeps `block_id` stable across name changes, so
the bank survives the rename for free. Tested against Section 6
Test 17: rename Mid Chest → Mid Chest Anchor and back produced
exactly one `Updated` blocks row per direction, no
`block_exercises` churn, no orphans.

## Slice 3 — Today Dashboard

### `is_rest_day` is plan metadata, not a Today-render gate

The Today tab shows `RestDayEmpty` if and only if there are zero
sessions for today, OR there is no active training plan. The
`daily_schedules.is_rest_day` flag does NOT short-circuit session
rendering: a day with `is_rest_day=true` but one or more seeded
sessions still renders those sessions.

**Reasoning**
Marcus's seeded plan has Sunday with `is_rest_day=true` AND a
"Hot Yoga or Sauna" recovery session. Both states are valid: the
day is "rest" in the sense of no lifting/cardio prescription, but
the recovery session is real work the user might still log. Using
`is_rest_day` as a render gate would erase that recovery session
from Today, contradicting the Plan tab's Day Detail. The correct
contract is: presence of sessions decides what renders; the flag
is metadata for downstream displays (e.g., a future weekly summary
might count rest days separately from cardio days).

`/today/page.tsx` implements this as
`todaySchedule && todaySchedule.sessions.length > 0`.

## Slice 4 — Workout Logger

### `set_logs` unique constraint added in migration 011 mid-slice

Migration 011 adds `UNIQUE (user_id, session_id, block_id, set_index)`
on `set_logs` via
`ALTER TABLE set_logs ADD CONSTRAINT set_logs_user_session_block_set_index_key`.

**Reasoning**
Data integrity for the duplicate-tap scenario: a user taps Save twice
on the same set during a network blip and the client could otherwise
insert two rows with the same `set_index`. The `isBlockComplete`
helper masks the symptom (a `Set` of distinct `set_index` values
still completes the block correctly), but downstream consumers
(History tab volume math, future edit/delete affordances, Slice 5
sync layer) would see ghost rows. Constraint at the DB layer makes
the insert fail loud with `23505` so the client can show a clear
error rather than silently writing duplicates.

Caught during Slice 4 quality review and landed before Section 6
testing — the third validation of the migration immutability rule
(after the Slice 2 007→008 incident and the routine 010 split). It
also avoids Slice 5 having to dedupe in client code, since the DB
won't let the duplicates exist in the first place.

### Custom EndSessionDialog modal replaced with shadcn Dialog primitive in review

Codex initially built an in-scope modal inside `EndSessionDialog.tsx`
(card-based overlay, manual open state). The review pass installed
shadcn's Dialog primitive (`pnpm dlx shadcn@latest add dialog`) and
refactored the component to use it while keeping the same prop
signature (`disabled`, `onConfirm`).

**Reasoning**
Same pattern as the Slice 2 Card primitive review fix: install the
primitive once, reuse across slices. The hand-rolled modal worked,
but every future dialog in the app would have to re-derive the same
overlay/positioning/animation/focus-trap behavior from scratch. The
shadcn Dialog gives us Radix's accessibility (focus trap, esc-to-
close, scroll lock, aria roles) for free, and pulls in
`@radix-ui/react-dialog` once for the rest of the project.

Codex was correct to defer the install — `src/components/ui/` was
outside the original allowed edit surface. The review pass is the
right place for primitive-install decisions because it weighs the
refactor against the broader pattern.

### Form library deferred until Slice 7-8 (react-hook-form + zod)

`SetEntryForm` uses local `useState` validation. The repo does not
have react-hook-form or zod installed.

**Reasoning**
The Slice 4 forms are single-row weight/reps entries — a form library
is overkill. Multi-field cross-validated forms arrive in Slice 7
(Nutrition Tracking) and Slice 8 (Plan Editor); evaluation defers to
that point. `spec/FUTURE_WORK.md` tracks the decision. Current
`SetEntryForm` is small enough that even after a form library lands,
keeping it on plain `useState` is fine.

### Quality review pass earned its keep this slice

The mandatory Claude Code quality review after every Codex pass
produced four substantive corrections in Slice 4: shadcn Dialog
migration, `set_logs` UNIQUE constraint (migration 011), bodyweight
exclusion in PR detection, EndSessionDialog focus trap fix. None
would have been caught by a passing test alone — the unique
constraint surfaces only under double-tap, the bodyweight exclusion
only on a Muscle Ups PR check, the focus trap only via screen
reader / keyboard navigation.

**Reasoning**
Worth logging as a recurring data point — the v2.1 workflow change
(Step 5 mandatory review) is paying off in practice. Slice 4 alone
prevented at least one data-integrity bug (duplicate set_logs) and
at least one wrong-PR-history bug (bodyweight false positives) from
landing in the test pass.

### Save-on-close race condition deferred to Slice 5

Slice 4 does not guarantee crash-resilient writes for sets in flight
when the browser tab closes. If a save request is mid-flight when
the tab closes, the set is lost. The user has to re-enter the lost
set on resume.

**Reasoning**
Solving this in Slice 4 would require localStorage queueing
infrastructure that overlaps significantly with Slice 5 (Sync Layer).
The Slice 4 spec's resume contract — "prior set*logs visible on
resume" — is satisfied for \_successfully-saved* set_logs, which the
implementation correctly delivers. Slice 5's queue-on-failure
pattern (per MASTER_SPEC) is the right home for crash-resilient
writes; it will retain unsaved writes and replay on next mount.
Tracked in `KNOWN_ISSUES.md` as 🟡 Medium for visibility until
Slice 5 lands.

## Slice 4.5 — Display Unit Correction (lbs/kg)

### Storage canonicalization with display-layer conversion

Keep schema column as `weight_kg` (canonical kg storage). Convert at
form input boundary (`lbsToKg` on save) and at display boundary
(`formatWeight` on render). Two boundaries, one canonical storage.

**Options considered**

1. Keep `weight_kg` canonical, convert at form/display boundaries
   (chosen).
2. Rename to `weight_value` + add `weight_unit` enum.
3. Flip canonical to `weight_lbs`.

**Reasoning**
Standard pattern. PR detection, volume calculations, and aggregations
all run on raw kg without conversion mid-compute. Option 2 forces
every aggregation to normalize across rows. Option 3 abandons SI
units, hurting any future research/dataset interoperability.

### Bodyweight storage convention preserved across slices

Bodyweight sets continue to store `weight_kg = 0` (Slice 4
convention). Future bodyweight writes will NOT switch to
`weight_kg = NULL`.

**Reasoning**
Codex initially proposed NULL as more semantically correct ("not
applicable"), but two semantic representations for the same concept
(0 vs NULL bodyweight) creates exactly the cross-slice drift the
workflow tries to avoid. `formatWeight(0)` cleanly returns
"Bodyweight". The `is_bodyweight` column on `exercises` is the
canonical "is this a bodyweight exercise" flag — `weight_kg` doesn't
need to encode that twice.

General rule: storage conventions are spec-locked, not
Codex-discretionary. When Codex proposes a storage change between
slices, default is "preserve prior convention unless there's a
strong reason."

### Migration timestamp locked at write time, not apply time

Backfill migrations use a literal ISO timestamp hardcoded in the
WHERE clause, computed once at migration write time, generously
buffered against any future writes. Slice 4.5's migration 012 uses
`'2026-05-01 16:30:00+00'`.

**Reasoning**
Double idempotency. Supabase's migration tracker prevents
re-application; the WHERE clause filter prevents accidental ad-hoc
SQL re-runs from corrupting future data. Reusable across any future
"fix existing data" migration in any project.

## Slice 5 — Sync Layer

### handleFreeFormComplete kept under original name despite serving both protocols (Slice 5)

**Context:** The failure-block-writer fix consolidated two
auto-advance code paths onto a single block-completion writer,
`handleFreeFormComplete`. The function now services both failure
and free-form protocols, making its current name misleading.

**Options considered:**

1. Rename inline as part of the surgical fix to
   `handleBlockComplete`.
2. Keep the original name; schedule rename for a future cleanup
   pass.

**Decision:** Option 2.

**Reasoning:** The fix was scoped as a surgical one-line behavioral
change inside Slice 5. A rename touches every call site and would
expand the diff surface unnecessarily for a verification-day fix.
The rename is pure cosmetics — no semantic change — and is
scheduled as a 🟢 Low-priority cleanup. Logged in `FUTURE_WORK.md`.

**What would break if Option 1 was chosen:** nothing functionally,
but the surgical-fix discipline would be violated and the diff would
no longer be isolated to a single `onComplete` callback edit,
complicating any future `git revert` if the fix needs rollback.

## Slice 6 — History tab Discovery decisions (May 2, 2026)

Phase 0 Discovery for the History tab produced six decisions worth recording
durably. Each represents a conscious choice between viable alternatives.

### 1. Chronological PR Timeline as landing surface (departure from v0 plan)

Context: The v0 master plan (Screen 3A) specified a muscle-group-grouped
current-PR snapshot view as the History landing surface. Slice 6 ships a
chronological PR Timeline instead.

Reasoning: The primary use case is progressive-overload validation in a
5-second-glance pattern (open History → see most recent progress → close).
A chronological feed serves this directly; a muscle-group-grouped snapshot
is better for whole-body audit ("show me all my back progress") which is a
secondary, lower-frequency use case. v1 anchors on the daily-glance pattern;
the audit pattern can be added later if usage demand surfaces.

What would break if the alternative was chosen: A muscle-group-grouped
landing would over-elevate audit-style use over daily-glance use. The cross-
linked navigation pattern (PR row → exercise progress → session detail) also
works more naturally from a chronological feed than from a grouped snapshot.

### 2. LIFT-only scope; cardio/recovery deferred

Context: The app currently has no completion tracking for cardio or recovery
activities. History could either stay LIFT-only (consuming session_completions
and pr_history only) or wait for the activity_completions table to be designed
and shipped before History tab launches.

Reasoning: Cardio and recovery completion is a binary "did it" log without
the metric depth that progressive overload requires (no "stronger over time"
chart for sauna sessions). Their data shape is small enough that Slice 7
(Plan tab) can absorb both the activity_completions table and the Today-tab
completion buttons, keeping that work close to where it's most user-visible.
Slice 6 ships the high-value LIFT data first.

### 3. Cross-linked landing navigation pattern (over sub-tabs or hub-and-spoke)

Context: Three plausible navigation patterns for History's three surfaces —
sub-tabs, hub-and-spoke, or single-landing-with-cross-links.

Reasoning: Sub-tabs put all three surfaces at equal nav weight, which is
wrong because the surfaces are not equally weighted (PR Timeline is daily-
glance, the journal is occasional). Hub-and-spoke adds a navigation step
with no information benefit because the surfaces are tightly coupled (a PR
row is also a data point in the exercise chart and also from a specific
session). Cross-linked landing — PR Timeline as default, with each row
cross-linking to exercise progress and session detail, plus a persistent
"All Sessions" header link — matches the actual usage hierarchy.

### 4. Single weight-over-time chart line, dot color distinguishes PR type

Context: pr_history has two PR types (weight, in_range_rep). The exercise
progress chart could render them as separate lines or as one line with
visual differentiation per dot.

Reasoning: Two lines doubles visual complexity for a distinction that is
meaningful but not the primary signal of the chart. A single weight-over-
time line preserves the strength-progress narrative; dot color-coding
preserves the PR-type distinction without forcing the reader to mentally
overlay two lines. Recharts handles this natively.

### 5. Incomplete sessions display in All Sessions list with state indicators

Context: The session_completions table has both completed_at NULL (in-
progress sessions) and was_ended_early flag (deliberately ended). The v0
plan implied "only days with at least one completed session appear" but
that schema only had a binary completed flag.

Reasoning: With richer state available, hiding incomplete sessions hides
real training data. Showing them with visual state indicators (e.g., a
muted style or "in progress" / "ended early" badge) preserves the audit
trail without misrepresenting completion status. This handles the verifica-
tion-data case (we currently have an incomplete Pull session in the DB
from May 1 verification) and the genuine real-world case where the user
ends a session early due to fatigue or time.

### 6. "All Sessions" routes to a list view, not most-recent-detail

Context: The "All Sessions" header link could either route to a list of past
sessions (each tappable into detail) or directly into the most recent session
detail with prev/next navigation.

Reasoning: List-then-tap-into-detail is more discoverable, less surprising,
and supports both "give me an overview of recent training" and "let me find
that specific session from two weeks ago" use cases. Direct-into-detail
optimizes for one use case at the expense of the other.
