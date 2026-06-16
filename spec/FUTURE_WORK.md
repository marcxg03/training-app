# FUTURE_WORK

## Methodology / Product Improvements

Items that affect what the app does, the schema, or the methodology
being modeled. Defer to a specific slice when known; otherwise note
"unscheduled."

### Recovery activity type granularity (Slice 8 or earlier)

Surfaced during Slice 3 verification. Currently the seeded plan
models "Hot Yoga or Sauna" as a single recovery session with the OR
semantic in the description text. Marcus wants distinct recovery
activity types so they can be logged, counted, and scheduled
independently. Hot yoga and sauna are concrete examples; the schema
should be extensible to additional activities (stretching, ice bath,
mobility flow, etc.) without re-migration.

Schema change required:

- Add a `recovery_type` enum column to `sessions`: extensible enum,
  not boolean. Initial values: `'hot_yoga'`, `'sauna'`. Reserved for
  future: `'stretching'`, `'ice_bath'`, `'mobility_flow'`, and so on.
- Update the seed parser to map per-day recovery activity into the
  new field.
- Update `current-plan.md` wiki to express the choice as separate
  scheduled sessions per day rather than a single "Hot Yoga or Sauna"
  entry, with each having a distinct `recovery_type`.

Affected layers:

- Schema (new migration in or before Slice 8)
- Seed pipeline (parser update + wiki rewrite)
- Logger (Slice 4) — log against the specific type
- History (Slice 6) — analytics count hot yoga separately from sauna;
  weekly sauna cap rule (max 2/week per MASTER_SPEC) enforces against
  sauna count only
- Plan Editor (Slice 8) — recovery activity selection in the editor
  UI

Estimated scope: ~half a slice. Natural fit during Slice 8 since the
editor needs structured recovery types anyway. Could also be a
dedicated mid-project slice (e.g., Slice 7.5) if Slice 4-7 surface a
stronger reason to land it earlier.

### PR detection query optimization (defer until Slice 6 or later)

Surfaced during Slice 4 review. SetEntryForm currently fetches the
full pr_history for (user_id, exercise_id) and computes max weight /
max reps client-side. Acceptable for Marcus's scale (3 historical PRs
at slice start, ~10-20 per exercise over years of use) but
inefficient for long-term growth. Optimization path: replace full-
history fetch with two server-side queries using
`.order('weight_kg', { ascending: false }).limit(1)` for Type A and
`.order('reps', { ascending: false }).eq('weight_kg', candidate_weight).limit(1)`
for Type B. Defer until pr_history per (user, exercise) reaches ~1000
rows or until other PR detection refactors happen for unrelated
reasons (multi-user, additional PR types, etc.).

### Display unit — lbs vs kg (CRITICAL — fix before Slice 6 History)

The schema column is `weight_kg` but the user trains in lbs. All
weights entered through Slice 4 testing were intended as lbs but
stored as kg, making them functionally wrong. Slice 2's seeded
historical PRs (Bench 235, OHP 185, Deadlift 435) similarly were
intended as lbs. Slice 6 will surface PR weight values prominently
in the History tab and PR Tracker — the unit mismatch must be
resolved before that.

Recommended approach: keep schema column name as `weight_kg`
(canonical internal storage); add a `UnitFormatter` utility that
converts at display time and form input/output; default new users to
lbs display; add a Settings (Slice 9) toggle for kg display; write a
one-shot SQL migration to multiply existing `weight_kg` values by
`0.45359237` to correct the mis-stored Slice 2 + Slice 4 testing
data.

Possible landing slots: Slice 4.5 (dedicated mini-slice), Slice 5
(fold into the sync layer's write path), or as a pre-Slice 6
prerequisite.

### Discard session feature

No in-app way to throw away an in-progress `session_completion`.
Currently only End Session Early (which marks complete) or manual
SQL. Belongs in Settings (Slice 9) or as a secondary action on the
Logger page itself.

### Volume = 0 UX for bodyweight-only sessions

Session summary's Total Volume tile shows 0 for bodyweight-only
sessions like Pull's Muscle Ups block. Replace with "Bodyweight
session" label or hide the tile when total volume is zero.

### Settings tab kg/lbs display toggle (Slice 9)

`formatWeight` currently hardcodes lbs as the display unit via
`DISPLAY_UNIT = 'lbs' as const`. When Slice 9 (Settings) lands, this
constant should be replaced with a profile-level preference lookup.
The display unit toggle UI lives in Settings; `formatWeight` reads
from a context or session-scoped value rather than the hardcoded
constant. The conversion utilities (`lbsToKg`, `kgToLbs`) stay
unchanged — they're pure math and don't care about user preference.
Estimated scope: 2-3 hours during Slice 9.

### gen:types script and supabase CLI installation (DX, low priority)

`package.json` has no script for regenerating Supabase types. The
raw CLI command
(`supabase gen types typescript --linked > src/lib/supabase/types.ts`)
was needed during Slice 4.5 and surfaced two friction points: (1)
no shorthand command, (2) `npx supabase` prompts interactively to
install the package on first use, and the prompt text gets
redirected into the output file. Recommendation: add a `gen:types`
script to `package.json` once Slice 5+ stabilizes, AND add a setup-
guide note recommending `brew install supabase/tap/supabase` (Mac)
or equivalent local install over `npx` invocation.

### Backfill Edge Cases section in MASTER_SPEC with E1.x–E4.x from prior slice docs

The new `## 9. Edge Cases` section in `spec/MASTER_SPEC.md` was
introduced during the Slice 5 spec update and currently contains
only E5.1–E5.8 under a `### Slice 5 — Sync queue` subsection. Slices
1–4 each have their own Section 5 "Edge Cases to Handle" lists in
the per-slice docs that were never lifted into MASTER_SPEC. Backfill
those into MASTER_SPEC §9 as `### Slice N — ...` subsections with
E*N*.x numbering, in the order they were authored. Project-end
documentation pass; not blocking any subsequent slice.

### Cardio and Recovery activity completion tracking

**Status:** Open. Surfaced May 2, 2026 during Slice 5 verification on
Lower ATG mobility session.

**Problem:** The Today tab currently shows three card types — LIFT,
CARDIO, RECOVERY. Only LIFT cards have an action affordance ("Start
Workout"). Cardio and Recovery cards are read-only with no way to mark
the activity completed and no visible state indicating the user did the
activity today. This breaks the consistency of the Today tab as a
"daily plan you act on" surface and means cardio/recovery completion
data is invisible to History.

**Proposal:** Add completion-acknowledgment for Cardio and Recovery
activities. Minimal logging:

- Start timestamp (when user taps "Start" or equivalent)
- End timestamp (when user taps "Mark complete")
- Optional notes field
- Optional perceived-intensity field (RPE-style 1-10 or simple
  Easy/Moderate/Hard tag — to be decided in spec)
- Optional duration auto-calculated from timestamps

UI: Today card shows a "Mark Complete" or "Log Activity" button when
incomplete; shows a checkmark/completed-state with brief summary when
done.

**Open data-model question (must resolve before Slice 6 finalizes
History tab schema):** Do cardio and recovery completions UNION with
`session_completions`, or live in a separate `activity_completions`
table?

Tradeoffs:

- UNION with `session_completions`: cleaner History tab query (one
  source), but requires schema flexibility —
  `session_completions` assumes block-based structure
  (`completed_block_ids` array) which doesn't apply to
  cardio/recovery. Would need nullable block columns, or a
  discriminator column distinguishing session types.
- Separate `activity_completions` table: cleaner schema (no nullable
  block-related columns for non-block activities), but History tab
  needs to UNION across both at query time.

**Recommendation pending:** Likely separate `activity_completions`
table — schema cleanliness is worth the History query complexity, and
cardio/recovery completions have their own natural fields (duration,
perceived_intensity) that don't fit `session_completions`' shape.

**Estimated delivery:** Slice 7 (Plan tab — week-ahead view, where
incomplete cardio/recovery becomes most visible) or Slice 9 (Settings
/ profile).

**Blocking decision:** Slice 6 (History tab) cannot finalize its query
shape without resolving the data-model question. Suggested: spend 15
minutes during Slice 6 Discovery to lock the data-model decision, even
though Slice 6 itself will only display the LIFT-derived data.

### "Library" tab — unified training catalog

**Status:** Open for Slice 7 Phase 0 Discovery. Surfaced May 3, 2026.

**Proposal:** Add a new top-level bottom-nav tab — "Library" — that
consolidates all reusable training content into one catalog surface.
The tab houses four categories of content:

1. **Exercises** — lifting movements with per-exercise notes (was v0
   Exercise Bank under Settings 5C; promoted here)
2. **Blocks** — named containers that group exercises with a protocol
   type (failure | mobility | corrective). First-class user-visible
   objects in this tab; previously implicit in Logger only.
3. **Cardio activities** — Speed Run, Endurance Run, Basketball, etc.
   With type, structure, and optional descriptions. Previously had no
   catalog home in v0.
4. **Recovery activities** — Hot Yoga, Sauna, etc. (with the separation
   from the Recovery cleanup entry above). Previously had no catalog
   home in v0.

**Relationship to other surfaces:**

- Plan Editor under Settings composes plans by pulling from this catalog
- Today tab cardio/recovery cards reference rows from cardio_activities
  and recovery_activities (or whatever the schema names land on)
- Logger continues to read exercises and blocks as it does today —
  but the user-facing edit surface for both moves here

**Five-tab → six-tab navigation:** The bottom nav grows from
Today / Plan / History / Nutrition / Settings to
Today / Plan / Library / History / Nutrition / Settings (or similar
ordering — IA decision in Slice 7 Discovery).

**Conscious deviation from v0:** v0 had Exercise Bank under Settings 5C
and no home for cardio/recovery activity definitions. This promotes
exercise catalog to a tab and gives cardio/recovery their first real
catalog home.

**Why now (before Slice 7):** Consolidating all four catalog surfaces
pre-Slice 7 is structurally cheap. Doing it post-Slice 7 means Plan
Editor, Today cardio/recovery cards, and Settings 5C would have already
ossified into three separate code paths. Logging the consolidation
intent in FUTURE_WORK ensures Slice 7 Phase 0 Discovery starts from
this scope, not from v0's scope.

**Open questions for Slice 7 Discovery:**

1. Is the catalog tab itself in scope for Slice 7, or does it ship as
   a Slice 7.5 / 8 alongside Plan Editor? Probably the catalog ships
   first, since Plan Editor depends on it.
2. Schema implications — `cardio_activities` and `recovery_activities`
   tables need to be created. Decided alongside the activity_completions
   table from the existing FUTURE_WORK entry.
3. IA: are blocks browsed alongside exercises, or in a separate sub-view?
   Blocks are referenced by exercises (one block has many candidate
   exercises) so the relationship matters.
4. Tab ordering in bottom nav.

**Supersedes:** The "Exercise Bank as standalone surface" question in
the prior Plan editing entry is resolved by this entry — the catalog
tab is the answer, and it's broader than just exercises.

### Slice 6.1 empty-state copy verified by inspection only

🟢 Low — surfaced May 3, 2026 during Slice 6.1 Phase A. Tests 3, 5,
and 9 (the three empty-state variants for PR Timeline windowed,
PR Timeline all-history, and All Sessions) were deferred per Path
B because running them required wiping `pr_history` and
`session_completions`, which would have destroyed the verification
dataset. Empty-state copy was verified by code inspection
instead — all three strings match AC #6 / AC #13 verbatim, and
the Show-all toggle correctly renders in both PR Timeline empty
variants per edge case 11. Verify end-to-end with a fresh user
account at the first integration milestone (e.g., when seeding a
test account for Slice 7's "Library" tab Discovery, or when
running a clean-install dry-run).

### Re-benchmark History TTFB on production with realistic dataset

🟢 Low — surfaced May 3, 2026 during Slice 6.1 Phase A Test 13.
TTFB on `/history` measured 300–572 ms in dev mode against an
under-realistic dataset (4 PRs vs spec's ≥5 PRs / ≥50 set_logs).
Under the 1s 🟡 known-issue threshold but above the 200ms spec
target. Re-benchmark on production after Slice 6.2 lands and the
dataset has grown via real usage. If `/history/sessions` exceeds
500ms with realistic dataset, evaluate replacing the per-row PR-
count subquery in `getAllSessions` with a single GROUP BY rollup
that counts PRs by `session_id` in one pass, then bucketed in
JS. The current shape (one query per session is NOT what's
implemented — the implementation already buckets in JS) is
acceptable; the question is whether the underlying SQL needs
optimization.

### pr_history.set_log_id backfill on legacy rows

🟢 Low — surfaced May 3, 2026 during Slice 6.1 Phase A. Slice
6.1's queries filter `WHERE set_log_id IS NOT NULL` to handle
legacy rows where the FK was never populated. Three seeded
historical PRs from Slice 2 (Bench 235, OHP 185, Deadlift 435)
intentionally have `set_log_id = NULL` because they predate the
set_logs table. Other potentially-NULL rows from pre-Slice-4
testing exist but have no production impact since they don't
appear in any user-facing surface.

When convenient (no urgency), write a one-shot backfill that
either (a) creates synthetic set_log rows for the three Slice 2
PRs and points their FK at them, or (b) accepts the historical
gap and documents the ~5-10 untraceable rows as expected. Option
(b) is probably correct — the seed PRs are chronologically real
but their set context is genuinely lost. Defer until History tab
analytics surface the gap as user-visible.

### Schema cleanup — cosmetic carryovers from Slice 7a workouts rename

🟢 Low — surfaced May 4, 2026 during Slice 7a Phase 4B. Two
cosmetic items survived the `sessions → workouts` cascade rename and
are bundled here for a future one-shot cleanup landing (likely
alongside Slice 7a.5's TS-level rename PR):

- `session_type_enum` enum type name. The column was renamed to
  `workout_type` but the underlying Postgres enum type is still
  named `session_type_enum` (`src/lib/supabase/types.ts:758,894`).
  Cosmetic only; doesn't affect queries. Fix:
  `ALTER TYPE session_type_enum RENAME TO workout_type_enum`
  paired with `supabase gen types`.
- FK constraint name carryovers. Postgres FK constraints from
  migrations 005-006 still carry the old names
  (`block_exercises_block_id_fkey`, `block_exercises_exercise_id_fkey`,
  `set_logs_session_id_fkey`, `session_completions_session_id_fkey`).
  Constraint names aren't user-facing; cosmetic only.

Both can be bundled with Slice 7a.5's TS-rename PR for one
mechanical cleanup landing — keeps the noise consolidated.

### Nutrition tab — AI-powered photo + text meal logging (with multiple input methods)

**Status:** Open. Surfaced May 4, 2026 during Slice 7a Phase 5b
forward-look.

**Proposal:** Ship a Cal-AI-style logging flow as the primary nutrition
input UX. Photo + optional text description → LLM (Claude vision API) →
extracted calories + macros + auto-generated meal name → pre-filled review
form → user adjusts as needed → save.

**Multiple input methods supported:**

1. **Photo + optional text description** — primary AI flow. Single or
   multiple photos per meal (e.g., overhead + side angle for portion
   estimation, or multiple plates for a multi-course meal). Text augments
   the photo, doesn't replace it.
2. **Barcode scan** — direct product lookup. Scan barcode → product
   database (USDA, OpenFoodFacts, or similar) → structured nutrition data.
   Different code path from LLM analysis; needs a barcode scanner library
   + product DB integration.
3. **Nutrition label photo** — dedicated label-reading mode. LLM vision
   with label-reading prompt extracts the nutrition facts panel directly.
   Distinct from meal photos.
4. **Manual entry** — fallback for AI failure / low confidence / private
   meals. Plain form fields for calories + macros.
5. **Choose from saved meals** — template reuse. Pick from recently-logged
   meals (or a curated meal templates list) without re-running AI. Common
   case: "I had the same lunch as yesterday."

**Methodology alignment:**

Meal blocks/types (already in `meal_type text` field on `meal_entries`)
function as the catalog organizing primitive, mirroring the lifting
block / cardio block / recovery block pattern from Slice 7a. Each meal
block has guidelines (existing `nutrition.md` wiki content: protein
targets, carb timing, etc.) but allows free choice at log time. AI
handles structured extraction so logging stays low-friction; the
methodology stays unique to Marcus.

**Saved per meal entry:** meal block/type, AI-generated meal name,
optional brief description (user-edited or AI-suggested), calories,
protein/carbs/fat. Photos are ephemeral — never persisted in DB or
locally. AI raw response not stored.

**Schema additions to meal_entries:**

- `meal_name text NOT NULL` — AI-generated or user-edited
- `description text` — optional brief description (user-editable)
- `is_ai_generated boolean NOT NULL DEFAULT true` — distinguishes AI
  logs from manual entry; useful for future analytics
- `ai_confidence numeric` — optional; AI's confidence in macros (0-1
  range); informs whether to flag for user review

**Possible new tables:**

- `meal_templates` (template_id, owner_user_id, name, calories,
  protein_g, carbs_g, fat_g, default_meal_type, description) — for
  saved meals / favorites pattern. Mirrors cardio_activities /
  recovery_activities catalog model from Slice 7a. Could defer to a
  later sub-slice and bootstrap with a "recent meals" query against
  meal_entries (DISTINCT ON meal_name).
- `meal_blocks` (block_id, owner_user_id, name, guidelines text) — if
  meal blocks become a Library catalog peer (4th or 5th sub-tab in
  Library, depending on Slice 7b's IA). Could defer.

**Implementation considerations (lock at Phase 0):**

- LLM provider: Claude vision API (default — project affinity, strong
  vision performance, Anthropic privacy policy)
- Photo persistence: ephemeral (default). No DB storage, no local
  persistence beyond the active form session. Optional persistence as
  a future Settings toggle if user wants audit trail.
- AI override workflow: form pre-fill with AI's analysis; user reviews
  + adjusts; save commits user-edited values, not raw AI output. AI is
  a starting point, not authoritative.
- Queue-on-failure integration: AI call failure (network, rate limit,
  server error) → queue the meal-log attempt with photo + description
  preserved → retry on reconnect. Slice 5's pattern.
- Fallback path: AI returns "couldn't analyze" or low confidence →
  surface manual entry with the photo still attached as a visual aid.
- Input flexibility: photo-only, text-only, photo+text, barcode-only,
  label-only, manual-only, template-pick. UX accommodates the user's
  natural flow per meal.
- Cost ceiling: per-day soft cap (e.g., 10 AI analyses/day) as a
  Settings toggle. Realistic usage ~150-200 calls/month/user at
  ~$0.003-0.015 per call.
- Privacy: Document data flow in user-facing Settings → Privacy.
  Photos sent to Anthropic for inference, not stored on our servers,
  not used to train AI. Settings toggle to disable AI logging entirely
  (forces manual entry path) for users who prefer.

**Probable slice split (TBD at Phase 0):**

- Nutrition 1 (read scaffold + manual logging): nutrition_targets read
  display, meal_entries history view, manual logging UI, basic schema
  additions (meal_name, description). No AI.
- Nutrition 2 (AI logging): photo capture + LLM call + analyze flow +
  override UI. Nutrition label photo + multi-photo support.
- Nutrition 3 (extended inputs): barcode scanner + product DB lookup,
  saved meals / templates flow, meal_templates table (if pursued).

Or single substantial Nutrition slice if scope discipline holds. Slice
size will rival Slice 7a's; defer the call to Phase 0.

**Sequencing:** Lands after Slice 7b (Library editing) + Slice 8 (Plan
Editor) by current sequencing. Could shift earlier if methodology rollout
priorities change.

### Form library — react-hook-form + zod (Slice 7-8 evaluation) — ✓ EXECUTED in Slice 7b

Surfaced during Slice 4 implementation. SetEntryForm uses local state
validation since the repo doesn't have react-hook-form + zod
installed. This is fine for simple weight/reps forms but multi-field
forms with cross-field validation (Nutrition Tracking, Plan Editor)
will benefit from a form library. Decision deferred until Slice 7
begins; if Slice 7 surfaces multi-field validation pain, evaluate
adding react-hook-form + zod as devDeps. Current SetEntryForm pattern
is fine to keep even after the library lands — it's a small simple
form.

**Resolved 2026-06-16 (Slice 7b):** Adopted `react-hook-form` 7.75.0 +
`zod` 4.4.2 + `@hookform/resolvers` 5.2.2 (runtime deps, not devDeps —
they ship in client form components) + nine shadcn primitives. Pattern
and conventions recorded in DECISIONS.md ("Form-library standard").
SetEntryForm intentionally left on local state. Plan Editor + Nutrition
logging should reuse the Slice 7b schema/resolver/uniqueness pattern.

### Delete affordance for the Library catalog (with in-use guard)

Deferred from Slice 7b (Phase 0 lockdown 3 — 7b shipped Create + Update
only). A future slice adds Delete to blocks, exercises, cardio
activities, and recovery activities. The open design question is the
**in-use guard**: an exercise referenced by `block_lifting_items`, or a
block/activity referenced by `workout_blocks` /
`block_{cardio,recovery}_items`, cannot be hard-deleted without either
(a) blocking with an "in use by N blocks/workouts" message, (b) cascade
with confirmation, or (c) a soft-delete/`archived` flag that hides it
from pickers while preserving historical references (set_logs,
completions). Soft-delete is likely correct given the append-only
history model — hard delete would orphan `set_logs.exercise_id` /
`block_id` FKs. Decide the guard semantics before implementing; pair
with the bulk-operations question (multi-select delete) which is also
out of scope for 7b.

## Workflow Improvement Candidates

Items that are not about training-app specifically but about the
Vibecoding Workflow itself. These are observations from running this
project that could improve the workflow's standard templates, rules,
or documentation in a future revision (v2.2 or later). At project
completion (after Slice 10), these get consolidated into a Workflow
v2.2 proposal.

### Save-on-close race condition validates Slice 5 scope

During Test 17 (resume verification) the Cable Lat Pulldown WU was
lost when the browser tab closed mid-save. This was correctly
identified as a Slice 5 (Sync Layer) concern rather than a Slice 4
bug — the spec promises resume of *successfully-saved* set_logs, and
Slice 4 delivers that. The queue-on-failure pattern from MASTER_SPEC
is the right home for crash-resilient writes. Worth logging as
evidence that the slice boundaries in MASTER_SPEC were drawn
correctly.

### Bypass project chat for small corrective slices

Slice 4.5's slice doc was written outside the project chat and saved
directly to Claude Code via the conversation. The reasoning: the
design was fully locked through a 4-question Q&A in conversation,
the migration timestamp was the only late-binding value, and the
chat would have just regenerated what was already written. The
Workflow doc currently assumes every slice doc is produced by the
project chat — in practice, corrective half-slices that emerge from
a parent slice's testing phase don't always need the full
chat-driven Phase 0-2 ceremony.

Workflow addition candidate: a Workflow doc note on "corrective
slices" defining when slice N.5 is appropriate (representation bugs,
data corrections, small refactors that emerge from slice N's
testing) and what discipline can be relaxed (project chat ceremony)
vs preserved (slice doc, two-agent discipline, post-slice
automation, mandatory quality review). Could land as a new section
in v2.2 alongside the existing Phase 4 slice loop.

### Quality review must check auto-advance / synthetic-completion parity

Slice 5's failure-block testing surfaced a latent gap from earlier
slices: the failure-block auto-advance handler in `LoggerShell`'s
`<FailureProtocol onComplete={...}>` callback was wired to
`advanceToNextBlock` directly, bypassing the
`session_completions.completed_block_ids` writer that the
free-form / mobility "Done with this block" button correctly went
through. Slice 4's quality review missed the gap because the test
pass exercised only the explicit-button path, not the synthetic
auto-advance path. The DB symptom was silent: `set_logs` persisted
correctly, the UI advanced to the next block, but
`completed_block_ids` stayed empty.

Workflow addition candidate: a Phase 4B quality-review checklist
item that says "for any auto-advance / synthetic-completion path,
verify the same DB writes fire as the explicit-button path." The
generalization beyond this specific bug: any time a UI infers
"the user is done with X" without an explicit gesture (terminal-set
detection, last-step inference, idle-timeout completion), the
inferred-completion handler must converge on the same write path as
the explicit-completion handler. Two paths to the same conceptual
event should share one writer, or the review must check that both
writers exist and stay in sync.

Could land as a new bullet in the Phase 4B prompt template's review
checklist alongside the existing "every Codex deviation flagged"
and "every column reference matches live schema" items.

### CLI tools that prompt interactively don't compose with stdout redirection

During Slice 4.5,
`npx supabase gen types typescript --linked > src/lib/supabase/types.ts`
corrupted the output file by writing the npx install prompt text
("Need to install the following packages: supabase@2.98.0 Ok to
proceed? (y)") into the redirect target. Cause: stdin/stdout
interleaving when the CLI is being installed for the first time via
npx.

Workflow addition candidate: a Setup Guide note that any CLI used in
shell pipelines (`>`, `|`, `$()`) should be locally installed
(Homebrew on Mac, scoop on Windows) rather than invoked through
`npx` or `pipx`. The pattern generalizes beyond supabase: any time a
tool's first-run install path can pollute its own output stream,
redirection breaks. Local installation is the discipline-preserving
fix.

### Pre-slice wiki-grep should enumerate all same-name collisions, not the mentally-cataloged subset

Surfaced May 4, 2026 during Slice 7a Phase 4B. The pre-Slice-7a
wiki-edit pass renamed three known same-name-across-workouts
collisions (Mid Chest → Bench Press Focus, Lateral Raise →
Shoulder Burnout, Hot Yoga/Sauna split) but missed `Calves`,
which appears in both Tuesday Lower Compound (`failure` protocol)
and Saturday Lower ATG (`mobility` protocol — block 8 of the ATG
mobility flow). The collision was caught post-seed when Codex
hard-coded a parser override forcing `block_name = "Calves"` to
`failure`, silently flipping Saturday's methodology classification.
Resolved by renaming Saturday's "Calves" → "ATG Calves" in the
wiki and reverting the parser override.

Workflow addition candidate: pre-slice wiki-rewrite instructions
that introduce a new uniqueness constraint should require an
explicit grep pass enumerating ALL same-name occurrences across
workouts, not just the ones the spec author has mentally
catalogued. Concrete check for slice docs that introduce
catalog-style UNIQUE constraints:
`grep -E '^\| [0-9]+ \| ' wiki/current-plan.md | sort -t'|' -k3 | uniq -c -f2`
or equivalent — surfaces every block-name + exercise-name that
repeats across the wiki. Catches the "I forgot Calves was in two
workouts" failure mode by mechanical enumeration rather than
recall.

### Goal Mode selector + 5E.1 recommendation (Settings slice) — ✓ EXECUTED in Slice 9

Deferred from Slice 8. `profiles.goal_mode` exists and Slice 8 reads it to
seed target defaults, but there is no in-app selector to change it, and no
5E.1 "Goal Mode Recommendation" flow (show current vs recommended ranges
per the new mode, with per-field "apply default" toggles). Build alongside
the Settings tab (5A/5E). When the mode changes, only toggled fields should
update; past meal logs and target history stay unchanged.

**Resolved 2026-06-16 (Slice 9):** Profile editor includes the goal-mode
selector; changing it opens the 5E.1 recommendation Sheet with per-group
apply toggles that write only the selected ranges to `nutrition_targets`.
Implemented via the pure `applyTargetToggles` merge. Remaining nuance: the
toggles are per macro group (min+max together) rather than per individual
field — a deliberate choice so the result can't violate `CHECK(min < max)`.

### Today dashboard macro mirror

MASTER_SPEC §1A wants the four macro bars + a Log Meal CTA on the Today
dashboard too. Slice 8 built `MacroProgressBar` and the nutrition queries
reusably; wiring them into `/today` (sharing the same totals/targets
computation as `/nutrition`) is a small follow-up. Extract the bar-building
logic from `nutrition/page.tsx` into a shared helper when doing this.

### Richer day-type meal framework

Slice 8 ships a fixed guidance card (day type × goal mode). A future
iteration could generate suggested meal slots / macro splits across the day
(e.g. pre/post-training carb timing), and personalize off bodyweight and
training load rather than a static table.

### Meal-entry correction UI

`meal_entries` is append-only via the Slice 8 UI. If corrections become
painful in daily use, add an edit/delete affordance (the DB RLS already
permits UPDATE/DELETE on `meal_entries`), or decide to keep it append-only
and drop those policies in a migration for consistency with `set_logs`.

### Plan Editor — blocks-within-a-workout + cardio/recovery sessions

Deferred from Slice 10 (5B v1, which edits day-level workouts only). Add: (1)
editing a workout's block list via `workout_blocks` (add from the user's block
catalog, reorder, remove) including "block order"; (2) adding cardio/recovery
sessions to a day (needs the cardio CHECK fields and the polymorphic
`workout_blocks.preset_activity_id/type` wiring). Build on the non-destructive
guards already in `src/lib/plan/`.

### Plan Editor — full methodology schedule-validation engine

Slice 10 ships two validation rules (≥1 rest day/week; cardio-before-lifting).
Add the rest as a proper engine over the week's exercises/activities: 48h
muscle-group recovery, push/pull weekly balance, max 2 sauna/week, no
yoga+sauna same calendar day (hard); compound recovery 24h, recovery timing on
two-session days (soft). Needs muscle-group resolution per workout (via
block_lifting_items → exercises.muscle_groups) and recovery-activity detection.

### Plan Editor — transactional save (RPC)

`saveDay` currently writes sequentially without a transaction (see
KNOWN_ISSUES 🟡). Wrap the rest-day update + guarded deletes + workout
update/insert in a single Postgres function / RPC so a mid-save failure can't
leave a half-applied schedule. Same atomicity pattern would also benefit the
Library bank update (Slice 7b) and the cardio/recovery activity two-step
(Slice 8).

### PWA — rasterised icons + richer offline + push

Slice 11 shipped a dependency-free installable PWA (manifest + SVG icons +
hand-rolled service worker with an offline shell). Follow-ups: (1) rasterised
PNG icons at 192/512 + a real apple-touch-icon (needs an image asset or a build
step) for store/older-tooling compatibility; (2) richer offline via app-shell
precaching or read-only cached views (currently navigations fall back to a
static `/offline` page, no data caching by design); (3) optionally adopt
Serwist (the maintained next-pwa successor) if Workbox-grade caching/runtime
strategies are wanted; (4) web push notifications for workout reminders.

### Plans — atomic active-switch, delete, and clone

Slice 12 added multiple plans + an active-plan switcher. Follow-ups: (1) make
the active-plan switch atomic — a Postgres RPC `set_active_plan(target)` that
flips both updates in one transaction, or a partial unique index
`CREATE UNIQUE INDEX ... ON training_plans (user_id) WHERE is_active` so the DB
rejects a second active row (replaces the current non-transactional
deactivate-then-activate; see KNOWN_ISSUES 🟡). (2) Delete a plan — guarded,
because it cascades `daily_schedules → workouts → set_logs`/completions; block
deletion of a plan that has logged history, or require an explicit
"this deletes N logged sessions" confirmation. (3) Clone a plan (deep-copy
schedules/workouts/`workout_blocks`) to spin up a variant quickly.
