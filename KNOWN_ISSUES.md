# KNOWN_ISSUES

🟢 Low — Recovery activity type granularity. See
`spec/FUTURE_WORK.md` for the full structural item; this entry
exists so the issue is visible in the known-issues scan.

## Slice 1 — Project Scaffold + Auth

### 🟢 Low — Supabase free-tier email rate limit blocks rapid repeat sign-ins

Supabase free-tier email rate limit (~3-4 magic links per hour per
email address) can block testing with rapid repeat sign-ins. The
LoginForm surfaces "email rate limit exceeded" inline and returns to
idle state correctly. Workaround: wait ~1 hour, or use a different
email for repeat tests.

## Slice 2 — Plan Migration

### 🟢 Low — Migration 007 was briefly extended in Slice 2 but the changes did not take effect on the remote

Codex extended `007_rls_policies.sql` with policies for the new
Slice 2 tables and ran `supabase db push --include-all` to force-
apply. The CLI reported success but the remote DB never received the
new policies — the Supabase CLI does not re-apply tracked migrations
even with `--include-all`. The dashboard still showed RLS disabled or
zero policies on every Slice 2 table.

The immutability rule was applied immediately: 007 was reverted to
its Slice 1 form (profiles policies only) and the extended policies
moved to a new `008_extended_rls.sql`, which was applied cleanly via
`supabase db push`. Remote DB now has RLS enabled with correct
policies on all 10 tables.

## Slice 4 — Workout Logger

### 🟡 Medium — In-flight save lost on tab close

When the browser tab is closed mid-save, the in-flight set_logs
INSERT is cancelled and the set is not persisted. Resume correctly
identifies the next incomplete block based on persisted set_logs,
but the user has to re-enter the lost set. Slice 5 (Sync Layer)
addresses this via the queue-on-failure pattern.

### 🟢 Low — Volume tile shows 0 for bodyweight-only sessions

Session summary screen renders Total Volume = 0 kg for sessions
composed entirely of bodyweight exercises (Pull's Muscle Ups block,
for example). Mathematically correct (0 weight × N reps = 0 volume)
but UX-confusing. Cosmetic. Worth a "Bodyweight session" label or
hiding the tile in Slice 9 polish.

### 🟢 Low — No "Discard session" path

Once a `session_completion` row exists for today, the only ways to
remove it are End Session Early (which marks complete) or manual SQL
deletion. There is no in-app "throw away this session and start
over" button. Worth adding to Settings (Slice 9).

## Slice 4.5 — Display Unit Correction (lbs/kg)

### 🟢 Low — Slice 4 testing data inconsistency for bodyweight rows

Some Slice 4 testing rows were written with `weight_kg = NULL`
during the iteration where Codex's first SetEntryForm pass had
bodyweight saving as NULL (corrected to 0 mid-Slice-4.5 before any
new writes). The migration 012 `WHERE weight_kg > 0` guard correctly
skips both 0 and NULL, so display behavior is consistent
(`formatWeight` handles both via "Bodyweight" and "—"). Cosmetic
data shape only. No fix needed unless future analytics queries
explicitly require uniform 0-storage; if so, a one-shot
`UPDATE set_logs SET weight_kg = 0 WHERE weight_kg IS NULL` would
normalize.

## Slice 5 — Sync Layer

### 🟢 Low — Failure-block auto-advance writer gap (workflow improvement candidate, not a code issue)

🟢 Low — Failure-block auto-advance writer gap was a latent issue
surfaced during Slice 5 verification testing on the Pull session.
The explicit-button mobility path (verified in Slice 4 on Lower
ATG) was wired to the writer correctly and remains so. The
auto-advance path on failure blocks was never wired. Phase 4B
quality review checklist should be extended to include: "For any
auto-advance or synthetic-completion code path, verify the same
DB writes fire as on the corresponding explicit-button path."
This is a workflow improvement candidate, not a code follow-up —
the code is fixed.

### 🟢 Low — pr_history.set_log_id FK population on legacy rows only

🟢 Low — `pr_history.set_log_id` is populated correctly on both
the failure-block PR detection path (Slice 5 verification) and the
mobility PR detection path (Slice 6.1 Phase A Tests 1 + 8 — Lower
ATG Split Squat from May 2 produced two PR rows with correctly-
populated FKs that JOIN cleanly through the hybrid query in
`getAllSessions`, contributing PR count = 2 on the Lower ATG · May 2
row).

Remaining concern is scoped to legacy rows where the FK was never
populated (pre-Slice-4 historical data, Slice 2's three seeded PRs
with `set_log_id = NULL` by design). Slice 6's queries handle this
via `WHERE set_log_id IS NOT NULL` filters; legacy rows simply
don't appear in PR Timeline and don't contribute to All Sessions
PR counts. No production fix required. Backfill candidate logged
in FUTURE_WORK.md.

## Slice 7a — Library Tab + Workouts Rename

### 🟡 Medium — TS-level session\_\* identifiers half-renamed

~25 references across 11 files (logger components, plan day route,
page-level prop types, queue discriminated union kinds) still use
`session_id` / `session_name` / `session_type` / `session_completion_*`
as in-memory JS field and prop names. The DB layer is fully renamed
to `workout_*` and runtime is unaffected — these are cognitive-friction
mismatches, not functional risk. Mechanical cleanup deferred to Slice
7a.5, a focused TS-rename PR with no schema or behavioral changes.
Bundling the rename into 7a's Phase 4B review would have diluted
attention from the Calves block_type collision (the methodologically
important issue) and added rename-introduced-bug risk to a slice
already touching ~55 files.
