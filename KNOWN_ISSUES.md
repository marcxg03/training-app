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

### 🟢 Low — Plan Editor doesn't edit blocks-within-a-workout or wire preset activities

**Resolved 2026-08-05 (adding cardio/recovery sessions):** the per-day editor now
adds & deletes **cardio and recovery** sessions, not just lifting — a Type picker
on new rows, a Cardio-format field for cardio, and `saveDay` writing the real
`workout_type` + `cardio_format` (mirrors the `workouts` CHECK). Verified end-to-end
by `e2e/verify-plan-blocks.mjs`.

Still deferred: editing a workout's block list (`workout_blocks` order/membership),
and attaching a specific **preset** cardio/recovery activity to a session (the
polymorphic preset wiring). Block catalogs remain editable in the Library (Slice
7b); wiring a specific activity into a day's session is the remaining piece.
Tracked in FUTURE_WORK.

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

## Slice 12 — Multiple plans

### 🟡 Medium — Active-plan switch is non-transactional (deactivate-then-activate)

`activatePlan` runs two statements (deactivate others, then activate the
chosen plan) with no transaction. If the second fails, the user is left with
**zero** active plans — Today/Plan/Nutrition render their empty states until
they re-pick (no data lost; recoverable). Deactivate-first is deliberate so a
partial failure can't leave _two_ active plans (which would crash every
`.eq("is_active",true).maybeSingle()` reader). `createPlan`'s "self-activate
when none active" is also a check-then-write (TOCTOU); negligible for a single
user. The clean fix is a Postgres RPC/transaction or a partial unique index
`(user_id) WHERE is_active` — tracked in FUTURE_WORK.

## Slice 13 — Macro ranges

### 🟢 Low — Deprecated single-value meal columns kept (nullable, unused)

Migration 018 added range columns to `meal_entries` and left the original
single columns (`protein_g`/`carbs_g`/`fat_g`/`calories`) in place — backfilled,
made nullable, and no longer written by the app. They're harmless dead schema
kept to avoid a destructive column drop on a table that may hold history. A
future cleanup migration could drop them once nothing references them (nothing
does today). The old `005` CHECK (`protein_g >= 0 AND …`) also remains but
passes on the NULLs new rows write.

## Slice 14 — AI photo macro estimator

### 🟢 Low — Live Claude-vision estimate unverified without an API key in this environment

The auth gate (401), env gate (503), input validation, build, and the no-key UI
path are all verified. The actual end-to-end vision estimate needs a real
`ANTHROPIC_API_KEY` in `.env.local`, which isn't present in the build
environment — so that path is verified by the user after adding their key. The
route degrades gracefully (button hidden) until then.

### 🟢 Low — No client-side request timeout on the estimate fetch

The "Estimate from photo" fetch has no `AbortController`; a hung Anthropic call
leaves the button on "Estimating…" until the socket/platform times out. The
`disabled` guard prevents double-submits in the meantime, so this is UX polish,
not a correctness bug. Could add a bounded timeout later. (Reviewer L4.)

### 🟢 Low — Estimates are rounded to whole grams

`sanitize()` rounds each macro to an integer even though the columns are
`numeric` and the manual form accepts decimals. Intentional (sub-gram precision
is meaningless for a photo estimate) and documented at `clamp()`; noted here so
the divergence from manual entry is visible. (Reviewer M2.)

## Slice 15 — Library delete

### 🟢 Low — Deletion guard has a TOCTOU window (no DB-level RESTRICT)

`deleteLibraryItem` re-checks `getDeletionImpact` immediately before deleting,
but the count-check and the `DELETE` are separate statements (no transaction).
A `set_log` inserted in the millisecond between the check and the delete would be
cascade-destroyed. For this single-user, single-session app the window is
negligible. A fully airtight fix would change the history FKs to
`ON DELETE RESTRICT` (or add a DB trigger) in a future migration — defense in
depth behind the app guard. (Reviewer L2.)

### 🟢 Low — `set_logs` retains UPDATE/DELETE RLS policies (pre-existing)

`set_logs` has `update_own` + `delete_own` policies (migration 010), which
deviates from the CLAUDE.md append-only rule that `pr_history` follows correctly
(SELECT/INSERT only). This is pre-existing (not introduced by Slice 15) and is
precisely why the cascade from a block/exercise delete would succeed at the RLS
layer — reinforcing that the app guard is load-bearing. Surfaced here because it
is adjacent to this slice's history-protection concern; a future migration could
tighten it.

## Slice 16 — Reusable Workouts catalog

### 🟢 Low — `update_own` RLS policies lack a `WITH CHECK` (project-wide)

`workout_defs` / `workout_def_blocks` `update_own` policies use only `USING`, no
`WITH CHECK` — mirroring the existing `blocks`/`block_lifting_items` policies
(migration 016). In principle an UPDATE could move a row to another owner; not
exploitable today because no mutation sets `owner_user_id` on update. A future
migration could add `WITH CHECK` to the whole family at once. (Reviewer Low #2.)

### 🟢 Low — `replaceWorkoutDefBlocks` is non-transactional (project-wide pattern)

Block replacement deletes then inserts in two statements (no transaction), so a
failed insert after a successful delete would leave a workout with zero blocks.
This is the same pattern as `replaceBlockBank`; acceptable for a single-user app.
Surfaced here as it's now used by a second feature. (Reviewer Low #3.)

## Slice 17 — Plan editor

### 🟡 Medium — `savePlan` is not atomic (partial save on mid-loop failure)

The weekly save is a sequence of statements with no enclosing transaction. If a
day's update/insert/materialize fails partway, earlier days are already committed
while later days are not, and a retry can duplicate the new (workout_id-less) rows
the failed attempt inserted. Acceptable for a single-user app; a future hardening
would wrap `savePlan` in a Postgres RPC/transaction. (Reviewer Medium-2.)

### 🟢 Low — plan activation is procedural, not constraint-enforced

`activatePlan` / `deletePlan` maintain "exactly one active plan" with
read-modify-write updates, not a DB constraint. Concurrent activations (multi-tab)
could momentarily leave zero or two active plans. Academic for single-user,
single-tab use. (Reviewer Low-2.)

## Redesign — "Instrument" (2026-06-30)

### 🔴 Critical — Coaching is UI-only; no backend exists yet

The coach + coached-client surfaces (Frames 38–48, routes under `/coach`) render
entirely from `src/lib/coach/*` **mock** data. There are no `coach_clients` /
`coach_notes` / assignment tables, no roles, no RLS, and the persona switcher
does not change any real auth/permission state. Onboard/assign/targets/notes
forms do not persist. This is intentional (deferred to a Codex backend slice),
but the coaching feature is **not functional** until that slice lands. Do not
ship coaching to real users before the backend exists. Replace each mock getter
in `src/lib/coach/mock.ts` with a Supabase-backed query when wiring it up.

### 🟡 Medium — Redesign not yet visually QA'd in a running browser

The redesign passed the static gate (format/typecheck/lint/build) after every
phase, but has not been run against live Supabase data in a browser. Layout/
spacing fidelity vs. the frames, real-data overflow (long names, many sessions,
empty states), and the logger's live PR-toast/sync micro-interactions should be
manually verified before merging `redesign/instrument` to `main`.

### 🟢 Low — Persona switcher hides the athlete BottomTabBar on `/coach`

`BottomTabBar` early-returns `null` on `/coach` paths so the coach shell's own
tab bar doesn't stack with it. Presentation-only and athlete routes are
unaffected, but it couples a shared layout component to a route prefix; revisit
when the real coach shell/layout is built with the backend slice.

### 🟢 Low — Deferred: optional open-licensed exercise "seed" library

Considered integrating an open exercise dataset (e.g. yuhonas/free-exercise-db,
public domain) as an opt-in autocomplete/seed source when creating exercises —
NOT animations (licensing + coverage gaps for unconventional lifts, and it
fights the fast-logging UX). Deliberately deferred; revisit post-redesign as a
separate slice. Keeps exercises free-text and unconstrained.

## Coaching removed (2026-06-30)

Coaching was removed from this app — it is now personal-only, and client-facing
coaching will be a separate app. The issues below are **obsolete** (no coaching
code ships); retained struck-through for history. There is nothing to verify or
enable.

### ~~🔴 Critical — Coaching is NOT verified against a live database~~ (obsolete — removed)

Migration `021_coaching.sql` has not been applied here, types were
hand-extended (not regenerated), and RLS / multi-tenant access has not been
exercised as two users. Do NOT set `NEXT_PUBLIC_COACHING_ENABLED=true` in
production until the checklist below passes. Build, typecheck, and lint are
green, but those do not prove RLS correctness.

**Required live-DB verification before enabling coaching:**

1. Apply `supabase/migrations/021_coaching.sql` to the remote.
2. Regenerate `src/lib/supabase/types.ts` from the live schema and diff it
   against the hand-written additions (the three coaching tables + the
   `link_pending_coach_invites` function) to confirm they match.
3. As coach A, onboard an invite; as user B (with that email), open
   `/coach/my-coach` and confirm the invite links and the relationship
   activates.
4. Confirm coach A sees B's roster card, notes, targets, and review metrics;
   confirm a third user C sees NONE of B's data through any coach route or
   direct query.
5. Confirm `coach_notes` rejects UPDATE/DELETE (append-only), and that a
   client can read only `client_visible` coach notes + their own.
6. Confirm the service-role admin reads in `src/lib/coach/queries.ts` are
   never reachable without a verified relationship (spot-check
   `assertCoachClient`).

### 🟡 Medium — Assign-training does not materialise the plan into the client account

`assignTraining` records the selected plan's id + name on the relationship
but does not deep-copy the coach's plan/schedules/workouts into the client's
own `training_plans`. The client sees the assigned plan's name but follows/
logs from their own plan. Deep-copy-on-assign is the next coaching slice.

### 🟢 Low — Fuel adherence is a days-logged proxy

`getClientProgress` computes fuel adherence as the share of the last 14 days
with any meal logged, not true in-range macro adherence. Swap for a
range-vs-target computation (reuse `src/lib/nutrition/*`) when wiring the
client's nutrition history into coach review.

### 🟢 Low — Invite linking writes during a GET render

`/coach/my-coach` and `/coach/client-today` call `linkPendingInvites()`
(an idempotent UPDATE) during render to attach pending invites. It is safe
and idempotent but performs a write on a read path; consider moving it to an
explicit accept action or login hook if it becomes noisy.

## Workout logger — week-2 lockout (2026-08-04)

### 🔴 Critical — Repeating a weekly workout marked it complete and locked the logger — FIXED, awaiting live verification

Reported live: on Monday of week 2, `/today` showed Monday's lifting workout
as already **Completed** and opening it bounced straight back. Week 1 worked.

**Cause:** `set_logs` was keyed to `workout_id`, which a weekly plan reuses
every week, so the logger loaded week 1's sets as the current session's.
`isBlockComplete` counts `set_index` values for `failure` blocks (the default
block type), so every block read as finished, `findLastIncompleteBlock`
returned `-1`, and the page wrote `completed_at` during its GET render.

**Escalation mechanism worth remembering:** the write-during-render at
`/log/[workout_id]` is what turned a read-side display bug into persisted bad
data. A page that only _rendered_ wrong would have been cosmetic and
self-healing; because it wrote, the bad state outlived the request and had to
be repaired by hand. Treat writes on a GET path as a defect class, not a
shortcut. (See also the 🟢 entry above on invite linking during render.)

**Fixed by:** migration `023_set_logs_completion_scope.sql` +
`completion_id` scoping through the logger, the offline queue, and the
summary. Pinned by `scripts/verify-logger.ts`.

**Remaining action:** the fix is code-complete and GREEN on the static gate,
but has NOT been verified against the live database — this bug only
reproduces with week-old data.

**Rollout order is load-bearing here.** Migration 023 is NOT backward-
compatible with the deployed code in either direction, unlike 021/022:

- _Migration applied, old code still live:_ the old logger still selects
  `set_logs` by `workout_id`, so it re-derives "every block complete" and
  re-writes `completed_at` the moment the workout is opened — silently undoing
  the repair. Any set logged in that window also goes in with a NULL
  `completion_id`.
- _New code deployed, migration not applied:_ `.eq("completion_id", …)` returns
  `42703`, so `/log/[workout_id]` and the summary both 500, and
  `SetEntryForm`'s insert fails as a non-retryable 4xx — the set is neither
  saved nor queued.

Do it in exactly this order, and do not open the app between steps 1 and 2:

1. Apply migration 023.
2. Merge and push; wait for the Vercel production deploy to report Ready.
3. Run `scripts/repair-023-bogus-completions.sql` — step 0 backup, step 1
   diagnose, review, paste the reviewed ids into step 2.
4. Drive a real workout end to end: confirm no `23505`, that
   `set_logs.completion_id` matches the session, and that the summary and the
   `/history` session detail both show only that session's sets.

**ROLLED OUT 2026-08-05.** Steps 1-3 executed against production in order:
migration 023 applied via `supabase db push` (clean); merged to `main` as
`dc89800`, Vercel production deploy `dpl_HSFGnmJfTF…` READY; repair run.

Backfill measured on live data: 238 set logs, 139 linked, 99 NULL — and all 99
NULL rows belong to the e2e test user, whose seed writes set logs with no
completions. Every one of the owner's set logs linked correctly.

The diagnose found exactly one phantom: the owner's 2026-08-03 "Upper",
`d274afc6-…`, duration **0.114s**, `was_ended_early = false`, zero sets — the
reported lockout. It was reopened (`completed_at = NULL`). The e2e user's other
0.1s completion was correctly skipped (it has 9 linked sets), and the owner's
2026-05-04 genuinely-ended-early session was protected by the
`was_ended_early = false` predicate. Full pre-repair backup of all 9
`workout_completions` rows was taken before any write.

This also explains why week 1 worked: the owner's "Upper" recurs several times
a week, and each session's `failure` blocks accumulated `set_index` values
across sessions. Aug 3 was simply when the _last_ block crossed the ≥3
threshold, flipping `findLastIncompleteBlock` from a valid index to `-1`.

### 🟢 Low — One orphaned open session remains at 2026-08-03 (artifact of the repair)

Reopening the phantom cleared the false "Completed", but `getAllWorkouts` does
not filter on `completed_at`, so the row now shows in `/history` as an OPEN
session with zero sets, and it can never be resumed — the logger's
`findLatestForToday` only considers completions started today.

Deleting it is the cleaner end state (a phantom row records "the logger was
opened", not a workout). `scripts/repair-023-bogus-completions.sql` carries the
guarded DELETE. Left in place pending the owner's call.

### 🟢 Low — 99 set logs carry a NULL `completion_id` (all e2e fixture data)

The 023 backfill assigns each set to the most recent completion of the same
workout that had already started when the set was logged. Sets with no such
completion keep `completion_id = NULL` and will not appear in a session summary
or the `/history` session detail.

Measured on the live database immediately after applying 023: 238 set logs
total, 139 linked, 99 NULL — and **all 99 belong to
`e2e-slice7b@trainingapp.test`**, seeded by `e2e/_setup/seed-analytics-data.mjs`,
which creates set logs without any `workout_completions` rows. The owner's real
training history backfilled completely — every one of their set logs is linked
to its session. No action needed.

Offline-queue rows queued by a pre-023 build are handled separately and do NOT
land in this state: `handleSetLogInsert` resolves their session with the same
rule the backfill uses, and refuses the write (leaving the row visible in the
QueuePanel with an explanatory error) rather than inserting an unreachable set
log if no session matches.

### 🟡 Medium — `set_logs` has UPDATE and DELETE RLS policies, contradicting the append-only rule — FLAGGED, not changed

`CLAUDE.md` states that append-only tables (`set_logs`, `pr_history`) must have
only SELECT and INSERT policies. `pr_history` complies. `set_logs` does not:
`010_extended_rls.sql:10-14` grants `update_own` and `delete_own` to the anon
client. Nothing in `src/` updates or deletes `set_logs`, so no code depends on
them, but any holder of the session (including an XSS payload) can rewrite or
delete training history over PostgREST — and after 023, `completion_id` is a
rewritable column, so history can be re-pointed at a different session.

Not changed here: dropping RLS policies is a structural change outside the
scope of this bug fix and needs an explicit decision. The fix is a new
migration dropping both policies.

### 🟢 Low — Auto-completed sessions record no `completed_block_ids`

The auto-complete branch in `/log/[workout_id]` writes `completed_at` without
`completed_block_ids`, so a session finished that way shows `0/N blocks` in
`/history`. Reachable only when every block was genuinely completed in-session,
so the count is wrong but the session itself is real.

### 🟢 Low — `/history` workout-list PR counts are attributed by time window

`countPrsByCompletion` (`src/lib/history/queries.ts`) maps PRs to a session by
`workout_id` plus a `[started_at, completed_at]` window on `achieved_at`, not
by `completion_id`. Correct in practice (sessions of the same workout are days
apart) but it is the same inference 023 removed elsewhere; worth switching to
`completion_id` if that query is touched again.

## Plan editor — session content (2026-08-05)

### 🟡 Medium — The block rewrite is delete-then-insert and not transactional

`syncSessionBlocks` (`src/lib/plan/mutations.ts`) replaces a session's
`workout_blocks` by deleting them and re-inserting, over the browser client.
If the insert fails after the delete succeeds (network drop mid-save on the
PWA, an RLS hiccup, or a `23503` if a block was deleted in another tab), the
session is left with **no blocks** and the only copy of the intended list is
the in-memory form.

Mitigated, not solved: the rewrite no-ops when the stored membership already
matches, so an unrelated edit (rename, gym, timing) never puts the list at
risk; and a failure now reports which sessions were inserted so a retry
updates rather than duplicates. The user is told the save was partial.

This is the third copy of the same non-transactional pattern — the others are
`materializeBlocks` (same file) and the Library's `replaceWorkoutDefBlocks`.
The correct fix is one `SECURITY INVOKER` Postgres function
`set_workout_blocks(workout_id, rows jsonb)` doing DELETE + INSERT in a single
statement body (RLS still applies under invoker rights, so the
browser-client/no-server-actions constraint holds), called via `supabase.rpc()`
from all three. Deferred as a dedicated slice rather than smuggled into this
change.

### 🟢 Low — A cardio/recovery session cannot be given content without a category block

`SessionContentEditor` needs a block whose `block_category` matches the session
type to hang the preset activity on. If the Library has no cardio (or recovery)
block, the picker shows "Add one in the Library first" and the session stays
empty. The schema permits an empty cardio/recovery session, so it saves — and
an empty session bounces out of the logger. Seeded accounts always have both
blocks, so this only bites a hand-built Library.

## Slice B1 — Adjustable Set-Scheme

### 🔴 High — types.ts is hand-edited; `supabase db push` migration 025 BEFORE any `supabase gen types` regen (D14)

`src/lib/supabase/types.ts` was hand-edited to add `warmup_sets` /
`working_sets` / `to_failure` to the `blocks` Row/Insert/Update because the
worktree has no live DB. This is a pre-push stopgap: migration 025 MUST be
`supabase db push`ed before anyone runs `supabase gen types`, or the regen —
reading a DB that lacks the columns — deletes `warmup_sets` / `working_sets` /
`to_failure` from the generated types. `blockSetCount` then computes
`undefined + undefined = NaN`, `isBlockComplete`'s failure branch compares
`>= NaN` (always false), and failure blocks never auto-complete — the same
lockout class as migration 023. Push the migration first, then regen.

## Slice T2-A — Exercise catalog + media

### 🔴 High — types.ts hand-edited AGAIN for migration 026; push 026 before any `supabase gen types` regen (D14 pattern)

`src/lib/supabase/types.ts` now also carries hand-written `media_path` /
`media_type` / `source_slug` on the `exercises` Row/Insert/Update (migration
`026_exercise_media.sql`), for the same reason as 025: no live DB in the
worktree. Same rule, same failure mode — **`supabase db push` migration 026
BEFORE any `supabase gen types` regen**, or the regen silently deletes the three
fields and `scripts/enrich-exercises.ts` stops typechecking (and any media UI
built on top reads `undefined`). The columns are all NULLABLE and additive, so
the migration itself is safe to apply to the populated production table.

### 🟡 Medium — `is_compound` is stale DATA until `scripts/classify-compounds.ts --apply` runs (D28)

Migration 002 gave `exercises.is_compound` a `DEFAULT false` and nothing ever
backfilled it, so **every** exercise row reads as isolation. `buildE1rmSpotlights`
and (after this slice) the per-exercise detail page both gate e1RM on the flag,
which means the Strength/e1RM surfaces render EMPTY until the classification
script is run against Marcus's user with `--apply`. Dry-run first. Until then
the gate is "correct but starved" — no wrong e1RM is shown, but no right one is
either.

## Owner-gate is UI-only until the community/admin-hub build (D24)

**Status:** deferred by design (not a regression, not a cross-user breach). The S0 owner-gate (`requireOwner()`) hides the authoring PAGES from non-owners, but library/plan **mutations** are client-side Supabase calls under per-user RLS (`auth.uid() = owner_user_id`) — so an authenticated non-owner can still write **their own** private library by invoking a mutation directly. RLS silos every user (nobody can reach Marcus's data), and no "follower" users exist this build (Community is a placeholder). The product rule "followers do not author" must be enforced at the **data boundary** in the future community/admin-hub build: move authoring mutations to server actions/route handlers that `await requireOwner()`, and/or add an owner-allowlist to the write RLS policies. See DECISIONS.md D24/D25.

## activatePlan is non-atomic — a partial failure can leave ZERO active plans (S4 roast F2)

**Status:** deferred (pre-existing, rare, self-healing on retry). `src/lib/plan/plan-mutations.ts` `activatePlan` runs two writes — UPDATE is_active=false on all other plans, then UPDATE is_active=true on the target — with no transaction. If the second write fails, the DB has no active plan → Today (`.eq(is_active,true).maybeSingle()`) returns null and the app looks empty. Recovery is one tap (re-tap Load re-runs deactivate-all + activate; the selector surfaces the error + guards double-submit). Proper fix: a transactional Supabase RPC that flips both in one statement (or `SELECT ... FOR UPDATE`). Not fixed in S4 (presentational slice; a prod migration should be a deliberate backend change). See FUTURE_WORK.
