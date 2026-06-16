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

### ✅ Resolved — In-flight save lost on tab close

When the browser tab is closed mid-save, the in-flight set_logs
INSERT is cancelled and the set is not persisted. Resume correctly
identifies the next incomplete block based on persisted set_logs,
but the user has to re-enter the lost set. Slice 5 (Sync Layer)
addresses this via the queue-on-failure pattern.

Verified resolved via Slice 7a Phase 5 pre-test setup (deliberate
tab-close-mid-save test). Slice 5's queue-on-failure pattern
correctly catches in-flight network failures including synchronous
tab close; lost set replays from queue on reopen. Closed
2026-05-04.

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

### ✅ Resolved — pr_history.set_log_id FK population on legacy rows only

`pr_history.set_log_id` is populated correctly on both the
failure-block PR detection path (Slice 5 verification) and the
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

Active paths verified populating set_log_id correctly (Slice 6.1
Phase A Tests 1 + 8). Legacy NULL-FK rows correctly excluded by
Slice 6.1's WHERE set_log_id IS NOT NULL filters. Backfill
candidate remains in FUTURE_WORK.md (no urgency). Closed
2026-05-04.

## Slice 7a — Library Tab + Workouts Rename

### ✓ Closed — TS-level session\_\* identifiers half-renamed

Resolved by Slice 7a.5 (mechanical TS-rename PR). 88 substring
substitutions across 14 files plus the
`src/lib/methodology/session-state.ts` → `workout-state.ts`
file rename. The only remaining `session_*` reference is the
`Enums<"session_type_enum">` enum-type-name carryover, which
requires an `ALTER TYPE` migration; logged in FUTURE_WORK.md
under Schema cleanup.

## Slice 7b — Library Edit

### 🟢 Low — Two-step activity create is non-transactional (cardio/recovery)

`createCardioActivity` / `createRecoveryActivity` insert the activity,
then wire the junction row (`block_{cardio,recovery}_items`,
`display_order = MAX + 1`) in a second statement. If step 2 fails after
step 1 succeeds, the activity exists in the catalog but is not wired to
the block; the helper surfaces a retry warning, but a retry then hits
the name-uniqueness refine (the activity already exists). Recovery path
is awkward. Acceptable for personal-first scope; the clean fix is to
wrap both writes in a Postgres function for atomicity. Echoes spec edge
case E7b.16. No live occurrence during verification.

### 🟢 Low — Block bank update is delete-then-insert (non-transactional)

`updateBlock` deletes all `block_lifting_items` for the block, then
re-inserts the new set. A failure between the two leaves an empty or
partial bank; the user recovers by re-editing the block. Same atomicity
caveat as activity create, same future fix (Postgres function).

### 🟢 Low — Sheet forms don't disable submit on async name error

The T7 fix (disable submit while a validation error is present) was
applied to `BlockForm` only. The Exercise / Cardio / Recovery Sheet
forms still show the inline "…already exists" error and block submit on
attempt, but the submit button is not visually disabled. Cosmetic —
duplicates cannot be created. Extend the `BlockForm` pattern to the
three Sheet forms if consistency is wanted.

### 🟢 Low — Muscle-group tags outside the 11-tag taxonomy are dropped on edit

If a seeded exercise carries a `muscle_groups` value outside the locked
11-tag taxonomy, `MuscleGroupMultiSelect` renders no checkbox for it and
the unrecognized tag is silently dropped when the exercise is saved.
Echoes spec edge case E7b.22. No such tag was present in the verification
catalog; cleanup (if ever needed) is a one-shot SQL update.

## Slice 8 — Nutrition

### 🟢 Low — Day-type meal framework is guidance-only

The dashboard's framework card is a fixed guidance string keyed off
(day type × goal mode), not a per-meal-slot plan. Day type is derived
from the active plan's schedule; recovery-only and plan-less days both
resolve to "rest" guidance. Intentional given the thin spec for this
feature — richer per-meal planning is logged in FUTURE_WORK.

### 🟢 Low — Macro bars not yet mirrored on the Today dashboard

MASTER_SPEC §1A calls for a 4-bar macro summary on Today as well. Slice 8
built `MacroProgressBar` reusably but only wired it into `/nutrition`;
adopting it on `/today` is deferred to the Today/Settings work. No
behavioral regression — Today is unchanged.

### 🟢 Low — `meal_entries` edit/delete is UI-omitted, not DB-enforced

Append-only-via-UI per spec: the UI exposes no edit/delete affordance,
but migration 008 left UPDATE/DELETE RLS policies on `meal_entries`
(unlike the truly append-only `set_logs` / `pr_history`, which are
SELECT/INSERT-only). A future correction-UI slice can use them, or a
migration can drop them to enforce append-only at the DB if desired.

## Slice 9 — Settings + Profile + Goal Mode

### 🟢 Low — Profile bodyweight/height are metric-only (kg / cm)

The Profile editor stores and displays bodyweight in kg and height in cm with
no imperial (lbs / ft-in) display toggle. Matches the kg storage decision from
Slice 4.5. A kg/lbs display toggle is already tracked in FUTURE_WORK
(Settings); when built it should cover both the workout-logger weight display
and these profile fields.

## Slice 10 — Plan Editor

### 🟡 Medium — Plan Editor save is non-transactional (sequential writes)

`saveDay` writes sequentially with no transaction: is_rest_day → deletes →
per-row UPDATE/INSERT loop, bailing on the first error. A mid-loop failure
leaves a partially-applied schedule (rest-day flipped, some rows updated,
others not) while surfacing an error as if nothing saved; the user recovers by
re-saving. **No history can be lost** in this path (deletes are still
history-guarded and run before the loop), so the worst case is a cosmetic
schedule inconsistency. The clean fix is a Postgres function / RPC wrapping the
writes in a transaction — tracked in FUTURE_WORK.

### 🟢 Low — Plan Editor v1 doesn't edit blocks-within-a-workout or add cardio/recovery sessions

Editing a workout's block list (`workout_blocks` order/membership) and adding
cardio/recovery sessions (which need cardio fields + polymorphic preset wiring)
are out of v1 scope. Block catalogs are editable in the Library (Slice 7b);
wiring them into a day's workout is the deferred piece. Tracked in FUTURE_WORK.

### 🟢 Low — Most methodology schedule-validation rules are deferred

v1 implements two rules (≥1 rest day/week hard; cardio-before-lifting soft).
The remaining rules (48h muscle-group recovery, push/pull weekly balance, max
2 sauna/week, no yoga+sauna same day, compound 24h, recovery timing on
two-session days) need a muscle-group / recovery-activity analysis engine and
are tracked in FUTURE_WORK.

## Slice 11 — PWA

### 🟢 Low — PWA icons are SVG only (no rasterised PNG sizes)

The manifest references `icon.svg` + `icon-maskable.svg`. Modern Chromium
installs fine from SVG, but some tooling (older Lighthouse, app stores, certain
Android launchers) prefers explicit 192/512 PNGs. Adding rasterised PNGs (and a
proper apple-touch-icon PNG) is tracked in FUTURE_WORK — needs a real image
asset / build step.

### 🟢 Low — Offline support is a shell fallback, not full offline

The service worker is network-first for navigations with a cached `/offline`
page; it intentionally does not cache app data or API responses (so auth and
training data never go stale). The app is therefore installable and degrades
gracefully offline, but is not usable offline. Richer offline (app-shell
precache, read-only cached views) is tracked in FUTURE_WORK.
