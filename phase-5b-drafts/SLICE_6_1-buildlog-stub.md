<!--
ONE-TIME COWORK STUB FOR THE WIKI AGENT.
Generated 2026-05-03 alongside the Phase 5b reflection.
Going forward, the wiki agent owns this deliverable from scratch.
The stub exists this slice only because Cowork was carrying Phase A test
context (constraint provenance, gold-plating findings, KI closure,
tie-order fix observations) that would otherwise be reconstructed by the
wiki agent from CHANGELOG/DECISIONS reading.
-->

## Slice 6.1 — History Read Scaffold

_Completed: 2026-05-03_
_Commit: `e7b818e` on `main` (in sync with origin)_
_Status: ✅ Complete_

### What Shipped

- PR Timeline at `/history` (Server Component, default 90-day window + Show-all toggle to full history)
- All Sessions list at `/history/sessions` (Server Component, sorted by `started_at DESC`, full history)
- Cross-link contract via shared `<ExerciseLink>` and `<SessionLink>` components — single source for `/history/exercises/[id]` and `/history/sessions/[id]` URLs, reusable by Slice 6.2 + Slice 7's "Library" tab
- History data layer (`queries.ts`, `projections.ts`, `displayName.ts`, `crossLinks.ts`) with hybrid PR-count derivation (FK join + time-window filter) per ARCHITECTURE §16.4
- F8 PR-type visual distinction shipped ahead of Slice 6.2 (lilac for `weight`, sky for `in_range_rep`) — retained as conscious gold-plating, documented in DECISIONS
- Two placeholder routes for Slice 6.2 cross-links (`/history/exercises/[exercise_id]` and `/history/sessions/[completion_id]`) with no data fetching
- 23 files changed (16 new, 7 modified), 2,356 insertions, 23 deletions

### Files Created

```
src/app/(app)/history/
├── page.tsx                                      replaced Slice 1 placeholder; PR Timeline route
├── sessions/page.tsx                             All Sessions list route
├── exercises/[exercise_id]/page.tsx              placeholder for Slice 6.2 (no data fetching)
├── sessions/[completion_id]/page.tsx             placeholder for Slice 6.2 (no data fetching)
└── _components/
    ├── PRTimelineRow.tsx                         Server, presentational
    ├── PRTimelineShowAllToggle.tsx               Client (only client component in slice)
    ├── AllSessionsRow.tsx                        Server, presentational
    ├── SessionStateBadge.tsx                     Server, 3 state variants (complete / in_progress / ended_early)
    ├── PRTypeBadge.tsx                           Server, 2 variants with distinct color tokens (F8 partial)
    └── HistoryHeaderLink.tsx                     "All Sessions" header link

src/components/shared/
├── ExerciseLink.tsx                              cross-link wrapper for /history/exercises/[id]
└── SessionLink.tsx                               cross-link wrapper for /history/sessions/[id]

src/lib/history/
├── queries.ts                                    getPRTimeline + getAllSessions, multi-step + JS bucketing, no N+1
├── projections.ts                                PRTimelineRow + AllSessionsRow types
├── displayName.ts                                formatSessionDisplayName via native Intl.DateTimeFormat
└── crossLinks.ts                                 href builders, single source of truth for cross-link URLs

spec/slices/
└── SLICE_6_1_HISTORY_READ_SCAFFOLD.md            Phase 1 spec doc
```

**Modified:**
- `spec/MASTER_SPEC.md` — Slice 6.1 corrections (sessions.session_name spec drift fix)
- `spec/ARCHITECTURE.md` — Slice 6.1 corrections (sessions.session_name spec drift fix)
- `spec/FUTURE_WORK.md` — three new 🟢 Low entries (empty-state e2e at integration milestone, History TTFB production re-benchmark, pr_history.set_log_id legacy backfill)
- `CHANGELOG.md` — Slice 6.1 section
- `DECISIONS.md` — four new Slice 6.1 entries
- `KNOWN_ISSUES.md` — pr_history.set_log_id mobility-path entry rewritten to verified/closed-on-active-paths

### Design Decisions Made (Slice 6.1)

1. **PR Timeline overlap heuristic — pick the most-recently-started qualifying completion** when matching `pr_history` rows to multiple `session_completions` sharing a `session_id`; rejected earliest-start, longest-duration, and closest-to-`completed_at` alternatives because they all have edge cases that feel worse for the daily-glance use case.
2. **F8 PR-type visual distinction shipped ahead of Slice 6.2** — distinct color tokens per PR type (lilac `accent` for `weight`, `sky-400`/`sky-200` for `in_range_rep`) retained as conscious gold-plating; rejected stripping back to single-styling-with-Slice-6.2-deferral on the grounds of zero added complexity, no schema impact, and immediate scannability win on the Show-all view.
3. **In-progress row title dimming via `text-foreground/70`** retained as conscious gold-plating bundled with #2; rejected stripping back to badge-only differentiation because the dimmed title reinforces the muted state badge so the row reads as "muted at a glance" rather than just "has a badge."
4. **PR Timeline tie-order — secondary `pr_id DESC` key for deterministic same-`achieved_at` ordering**; rejected adding microsecond-precision timestamp columns or alphabetic-pr_type tiebreaking because the property that matters is determinism, not semantic ordering, and `pr_id DESC` is cheap, additive, and idempotent.
5. **`pr_history (set_log_id, pr_type)` partial UNIQUE constraint provenance documented** as living in migration 009 lines 50-52 with predicate `WHERE set_log_id IS NOT NULL`; rejected logging as a KI or immutability violation because the constraint is correctly declared in a versioned migration and the partial-index predicate is what makes it compatible with legacy NULL-FK rows.

### Issues Hit + Resolved

| Issue                                                                                                                   | Resolution                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schema drift: spec docs referenced `sessions.name`; live DB has `sessions.session_name` (6 references in `queries.ts`)  | Rewrote 6 references in `queries.ts` to `session_name`; corrected MASTER_SPEC §12.6 + ARCHITECTURE §16.4 + slice doc §7 with "additional columns out of scope" note |
| PR Timeline tie-ordering on identical `achieved_at` was incidental to query plan stability, not deterministic by design | Added `.order("pr_id", { ascending: false })` as secondary sort key in `getPRTimeline`                                                          |
| Test 2 fixture INSERT failed with `23505` on `idx_pr_history_set_log_pr_type_unique` partial unique constraint          | Traced provenance to migration 009; documented in DECISIONS as expected behavior; switched fixture to orphan-set_log_id approach (find a `set_logs` row with no `pr_history` reference, point synthetic PR there) |
| Phase A Tests 3, 5, 9 (empty-state copy variants) destructive — would have wiped `pr_history` and `session_completions` | Deferred per Path B; verified by code inspection that AC #6 + #13 strings match verbatim and Show-all toggle renders in both empty variants per edge case 11; logged FUTURE_WORK entry for end-to-end verification at integration milestone |
| Slice 5's 🟢 KI on `pr_history.set_log_id` mobility-path verification was open                                          | Resolved incidentally by Phase A Test 1 evidence (Lower ATG May 2 ATG Split Squat PRs joined cleanly through both surfaces); KI rewritten on post-slice sequence to scope remaining concern to legacy NULL-FK rows only |

### Known Issues Carried Forward

| ID       | Severity      | Issue                                                                                                                            |
| -------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| S0-L1    | 🟢 Low        | Recovery activity type granularity — Hot Yoga vs Sauna modeled as single OR-string. See FUTURE_WORK; Slice 7 or 8 candidate.    |
| S1-L1    | 🟢 Low        | Supabase free-tier email rate limit blocks rapid repeat sign-ins. Workaround: wait ~1 hour or use different email.              |
| S2-L1    | 🟢 Low        | Migration 007 force-apply silent fail (historical incident); resolved by 008. Documented for audit trail.                       |
| S4-M1    | 🟡 Medium     | In-flight save lost on tab close. Slice 5 sync layer addresses via queue-on-failure pattern; verify resolution at next end-to-end pass. |
| S4-L1    | 🟢 Low        | Volume tile shows 0 for bodyweight-only sessions. Cosmetic; Slice 9 polish target.                                              |
| S4-L2    | 🟢 Low        | No "Discard session" path. Slice 9 target.                                                                                       |
| S4.5-L1  | 🟢 Low        | Slice 4 testing rows with `weight_kg = NULL` for bodyweight. Cosmetic data shape; no fix needed unless analytics require.       |
| S5-L1    | 🟢 Low        | Failure-block auto-advance writer gap → ✅ Resolved in Slice 5 fix; workflow improvement candidate logged.                      |
| S5-L2    | 🟢 Low        | `pr_history.set_log_id` legacy rows → ✅ Resolved on active paths (Slice 6.1 verified); backfill candidate in FUTURE_WORK for legacy-only concern. |

### Workflow Improvement Candidates (Slice 6.1)

| #   | Observation                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | **Phase 4A Codex prompts should include a live schema dump, not just the spec's contract section.** Slice 6.1's `sessions.session_name` schema drift cost ~6 file edits + spec corrections at pre-test setup. The slice doc Section 7 listed only Slice-6.1-relevant columns; the live `\d sessions` would have caught the column-name mismatch before generation. Same root cause as Test 2's fixture friction (the migration 009 unique constraint would have appeared in the schema dump's index list). Mature for v2.2 adoption. |
| 6   | **Phase A test ordering by destructiveness — formalize the Path A/B/C choice.** Slice 6.1's ad-hoc Path B (additive-fixture-first, defer destructive to inspection) saved ~2-3 hours vs. full Path A while preserving meaningful coverage. Add to workflow doc: classify each test by destructiveness, choose path explicitly, document deferred tests as code-inspection-verified with FUTURE_WORK fixture entries. Mature for v2.2 adoption.                |
| 7   | **Phase 4B quality review prompt should be augmented with Phase A runtime findings before handoff.** Slice 6.1's review prompt was Section 8 base + Cowork-authored 7-item augmentation. 6 of 7 items resulted in concrete actions (1 code change, 3 DECISIONS entries, 1 KI rewrite, 2 FUTURE_WORK entries) — all of which the standard checklist would have missed because they only became visible at runtime. Codify the augmentation pattern. Mature for v2.2 adoption. |
| 8   | **Conscious gold-plating decisions need a dedicated DECISIONS template.** F8 partial delivery + in-progress dimming both went through "keep + document in DECISIONS." A 5-question template (intentional? cost-benefit? decision? rationale? deferred-slice-still-owns-polish?) makes the decision-making uniform. Emerging — hold one slice for accumulation.                                                                                                  |
| 9   | **Spec-author / code-reviewer escalation events are a workflow validation signal worth tracking.** Slice 6.1's one escalation (unique constraint provenance) was a clean win — 30s from question to resolution, false alarm correctly identified. Tracking these over slices gives signal on whether the role boundary needs adjustment. Emerging — needs ~3 slices of data before the pattern is interpretable.                                              |
| 10  | **Cowork's `project_instructions` should explicitly enumerate post-slice agents and their owned deliverables.** Slice 6.1 burned ~2 conversation turns mid-Phase-5b on the wiki-agent / Cowork role boundary blur. Cowork had assumed build-log update was its own deliverable. A 5-line addition (deliverable + owner + trigger + output-path table) prevents the same mistake on future slices. Mature for v2.2 adoption.                                       |

---

<!--
HANDOFF NOTES FOR THE WIKI AGENT:

1. The KI ID scheme above (S0-L1, S1-L1, S2-L1, S4-M1, etc.) is Cowork's
   guess at a stable identifier convention. The template only specified
   "ID" without prescribing the format. If the wiki agent has an
   existing convention (e.g., sequential numbering across all slices,
   or YYYY-MM-DD prefix), substitute. The slice-tag scheme has the
   advantage of being self-explanatory (S4-M1 = Slice 4, Medium #1).

2. The Workflow Improvement Candidates numbering starts at #5 assuming
   the existing 4 unnumbered candidates in spec/FUTURE_WORK.md
   § Workflow Improvement Candidates are retroactively #1-4 in the
   order they appear:
     #1 Save-on-close race condition validates Slice 5 scope
     #2 Bypass project chat for small corrective slices
     #3 Quality review must check auto-advance / synthetic-completion parity
     #4 CLI tools that prompt interactively don't compose with stdout redirection
   If wiki agent has a different numbering authority, renumber.

3. Spec docs that were modified (MASTER_SPEC.md, ARCHITECTURE.md,
   FUTURE_WORK.md) are listed under Modified above per the post-slice
   commit. The wiki agent may want to suppress these from the build-log
   if the convention is "code + docs-that-Claude-Code-owns only" and
   spec doc updates are tracked elsewhere.

4. Phase 5b reflection (separate file at
   phase-5b-drafts/SLICE_6_1-reflection.md) carries the workflow
   observations in narrative form, including which candidates are
   Mature vs Emerging for v2.2 adoption. Wiki agent may want to
   cross-reference or summarize.
-->
