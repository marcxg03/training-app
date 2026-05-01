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

## Workflow Improvement Candidates

Items that are not about training-app specifically but about the
Vibecoding Workflow itself. These are observations from running this
project that could improve the workflow's standard templates, rules,
or documentation in a future revision (v2.2 or later). At project
completion (after Slice 10), these get consolidated into a Workflow
v2.2 proposal.

(empty — entries will be added as they emerge in subsequent slices)
