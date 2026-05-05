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

### ✓ Closed — In-flight save lost on tab close (S4-M1)

Resolved by Slice 5's queue-on-failure pattern. Verified during
Slice 7a pre-test setup: a deliberate tab-close-mid-save test
showed the in-flight INSERT enqueueing to the localStorage outbox,
draining cleanly on next page load, and resume picking up from the
correct next-incomplete block. No data loss.

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

### ✓ Closed — Mobility PR detection path

Verified during Slice 6.1 Phase A. The mobility PR detection path
fires `set_log_id` correctly on `pr_history` INSERT — Lower ATG
Split Squat from May 2 produced two PR rows with populated FKs
that JOIN cleanly through the hybrid query in `getAllSessions`,
contributing PR count = 2 on the Lower ATG · May 2 row. The
failure-block path was already verified in Slice 5. Both code
paths converge on the same writer; no path-specific divergence.

Legacy-row FK gap (pre-Slice-4 historical data + Slice 2's three
seeded PRs with `set_log_id = NULL` by design) is handled by
`WHERE set_log_id IS NOT NULL` filters in the Slice 6 queries.
Backfill candidate logged in FUTURE_WORK.md; not a code issue.

## Slice 7a — Library Tab + Workouts Rename

### ✓ Closed — TS-level session\_\* identifiers half-renamed

Resolved by Slice 7a.5 (mechanical TS-rename PR). 88 substring
substitutions across 14 files plus the
`src/lib/methodology/session-state.ts` → `workout-state.ts`
file rename. The only remaining `session_*` reference is the
`Enums<"session_type_enum">` enum-type-name carryover, which
requires an `ALTER TYPE` migration; logged in FUTURE_WORK.md
under Schema cleanup.
