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

### Form library — react-hook-form + zod (Slice 7-8 evaluation)

Surfaced during Slice 4 implementation. SetEntryForm uses local state
validation since the repo doesn't have react-hook-form + zod
installed. This is fine for simple weight/reps forms but multi-field
forms with cross-field validation (Nutrition Tracking, Plan Editor)
will benefit from a form library. Decision deferred until Slice 7
begins; if Slice 7 surfaces multi-field validation pain, evaluate
adding react-hook-form + zod as devDeps. Current SetEntryForm pattern
is fine to keep even after the library lands — it's a small simple
form.

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
