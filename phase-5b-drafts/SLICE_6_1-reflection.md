# Phase 5b Reflection — Slice 6.1 (History Read Scaffold)

_Drafted: 2026-05-03_
_Source commit: e7b818e on main_

---

## What worked in the workflow this slice

**Cross-link contract enforcement via shared component pattern.** AC #18 (no direct `next/link` to cross-link targets) needed zero remediation in Phase 4B. The architectural choice — wrap `next/link` in named `<ExerciseLink>` and `<SessionLink>` components that import from a single `crossLinks.ts` href module — made the contract self-enforcing rather than discipline-dependent. Test 10's grep verification was a 3-command spot check rather than a multi-file audit. Slice 6.2 + Slice 7's "Library" tab inherit a clean cross-link primitive without re-deriving it.

**Phase A Path B (additive fixture inserts; defer destructive tests to inspection).** New pattern this slice. Three destructive empty-state tests (Tests 3, 5, 9) were deferred without losing meaningful coverage — code inspection confirmed copy matched AC verbatim and the Show-all toggle rendered correctly in both empty variants. The three additive tests (Test 8 state badges, Test 7 hybrid query, Test 2 bodyweight rendering) all hit pass cleanly with synthetic INSERTs against existing user data. Net effect: 10 of 13 tests run end-to-end + 3 verified by inspection in ~90 minutes, vs. an estimated 3-4 hours for full Path A (snapshot/restore around destructive tests).

**Phase 4B prompt augmentation pattern.** Cowork generated a Phase A-informed augmentation to the slice doc's Section 8 prompt before Claude Code's review pass. The augmentation surfaced 7 items the standard checklist would have missed (unique constraint provenance investigation, gold-plating decisions, tie-order fix, mobility PR detection KI closure, etc.). Pattern: Section 8 base + Cowork-authored Phase A findings = augmented review prompt. Six of seven augmentation items resulted in concrete actions (one code change, three DECISIONS entries, one KI rewrite, two FUTURE_WORK entries).

**Spec-author / code-reviewer escalation worked exactly as designed.** Cowork flagged the apparent `pr_history (set_log_id, pr_type)` UNIQUE constraint provenance gap as potentially a 🔴 immutability rule violation. Claude Code resolved it with one `grep` command in <30 seconds (constraint lives in migration 009:50-52 as a partial unique index — fully documented, not a violation). The split discipline (Cowork can't read code, reviewer can, single trigger phrase moves the question) handled the false alarm cleanly without either role overreaching.

**Hybrid PR-count query verified on first run.** Test 7's load-bearing assertion for AC #12 — that the FK-join + time-window filter correctly excludes NULL-FK rows from the All Sessions PR count and the PR Timeline simultaneously — passed cleanly. The implementation choice (`JOIN set_logs sl ON sl.set_log_id = pr.set_log_id` rather than `WHERE pr.set_log_id IS NOT NULL`) is the right shape; NULL never joins, so the filter is implicit.

**Mid-test KI resolution.** Slice 5's open 🟢 KI on `pr_history.set_log_id` mobility-path verification was incidentally resolved by Phase A Test 1's evidence (Lower ATG May 2 ATG Split Squat PRs joined cleanly through both surfaces). The KI was rewritten on the post-slice sequence rather than carried forward stale.

---

## What was hard and why

**Schema drift on `sessions.session_name`.** The slice doc, MASTER_SPEC §12.6, ARCHITECTURE §16.4, and Codex's generated queries all referenced a `sessions.name` column. The live DB has `sessions.session_name`. Caught at pre-test environment setup, before any browser test ran — but cost 6 references rewritten in `queries.ts` plus three spec doc corrections. Root cause: Phase 4A Codex prompt's Section 7 listed only the columns relevant to Slice 6.1; the live `\d sessions` would have caught the mismatch before generation. Generalizable risk for any future slice that touches a previously-shipped table.

**Test 2 fixture friction from undocumented constraint.** First INSERT failed with `23505: duplicate key value violates unique constraint "idx_pr_history_set_log_pr_type_unique"`. Took 3 conversation turns to discover the orphan-set_log workaround (find a `set_logs` row with no existing `pr_history` reference; point the synthetic PR there). Constraint was added in migration 009 (Slice 4 — Workout Logger), but neither the slice doc nor DECISIONS surfaced it; Cowork couldn't see it. Strongly correlated with the schema drift issue above — both stem from the spec layer's incomplete view of the live schema.

**Cowork / wiki agent role boundary blur.** Cowork initially assumed the build-log update was its own deliverable and started preparing a build-log stub plan during Phase 5b prep. Marcus corrected: build-log belongs to a separate wiki agent. ~2 conversation turns to clarify, plus a re-clarification on whether Cowork could optionally draft a one-time stub for handoff (yes, this slice only). Root cause: Cowork's loaded `project_instructions` doesn't enumerate post-slice agents and their owned deliverables. The information existed (in Marcus's mental model) but wasn't in the boundary-defining doc Cowork reads.

**TTFB measurement under-realistic dataset.** Phase A Test 13 measured `/history` TTFB at 300-572ms in dev mode. Spec target is 200ms; KI threshold is 1000ms. We landed in the middle band — under the threshold but above target. Settled on "PASS with note" + FUTURE_WORK entry for production re-benchmark. The harder question — whether the per-row PR-count subquery is the bottleneck — couldn't be answered with 4 PRs / 2 sessions of data. Future perf-sensitive slices need either a fixture-data generator that hits realistic scale, or explicit "perf testing requires production data" carve-out in the spec.

**Path B coverage gap is a permanent footnote.** Tests 3, 5, 9 are verified by code inspection, not end-to-end browser test. Inspection caught that the AC #6 + #13 strings match verbatim and the Show-all toggle renders correctly in both empty variants. But the gap exists: a subtle CSS bug that hides empty-state copy on first paint would not have been caught. Logged to FUTURE_WORK with the trigger to verify at first integration milestone (likely fresh-account dry-run before Slice 7's Library tab Discovery). Acceptable for a personal-first project but worth being honest about.

---

## Candidate workflow improvements

Numbered #5-10, continuing the implicit series in `spec/FUTURE_WORK.md` § Workflow Improvement Candidates. **Open question for Marcus:** the existing 4 candidates (Save-on-close, Bypass project chat for corrective slices, Quality review auto-advance check, CLI redirection) aren't numbered in `FUTURE_WORK.md`. If you want explicit numbering, those should be retroactively #1-4 in the order they appear; mine then continue from #5.

### #5 — Phase 4A Codex prompts should include a live schema dump, not just the spec's contract section

**Rule:** Before generating a Phase 4A Codex prompt for any slice that touches a previously-shipped table, run `psql -d <db> -c "\d <table>"` (or equivalent Supabase Studio SQL `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '<table>'`) and paste the output into the prompt's "live schema" section. The slice doc's contract is what we wish were true; the live schema dump is what is true.

**Why:** Slice 6.1's `sessions.session_name` schema drift cost ~6 file edits + spec corrections at pre-test setup. The slice doc's Section 7 listed only the columns relevant to the slice; the live `\d sessions` would have caught the column-name mismatch before generation. Same root cause as Test 2's fixture friction (the undocumented unique constraint in migration 009 would have appeared in the schema dump's index list).

**How to apply:** Phase 4A prompt template (in `vibecoding-workflow-v2.md` if maintained) gains a "## Live Schema Dump" section with a 1-line instruction to paste the actual column + index + constraint output for every table the slice queries. Optional fallback when no DB is available: link to the migration files in dependency order.

**Mature for adoption:** YES. Caused real friction this slice; reusable rule; ~5 minutes added to Phase 4A prep; high upside.

### #6 — Phase A test ordering by destructiveness — formalize the Path A/B/C choice

**Rule:** Before running a Phase A manual test pass, classify each Section 6 test by destructiveness (additive / non-mutating / destructive-with-restore-needed). Choose explicitly: Path A (full coverage, snapshot/restore around destructive tests), Path B (additive + non-mutating, defer destructive to inspection), or Path C (declare done after route-validation tests if structural quality is high). Document deferred tests as code-inspection-verified with an explicit FUTURE_WORK entry for end-to-end re-verification at the next integration milestone.

**Why:** Slice 6.1's ad-hoc Path B saved an estimated 2-3 hours of fixture-restore work without losing meaningful AC coverage. The choice was made on the fly; future slices benefit from a formal checkpoint between Phase A planning and Phase A execution. The Path C option exists for slices where the structural review (cross-link contracts, server-component boundaries, type contracts) is high-confidence and the marginal value of every-test runtime verification is low.

**How to apply:** Add a "Phase A test classification + path selection" step to the workflow doc, with a simple decision tree (any destructive test? if yes, can it run in isolation? if no, is the data restorable from seed?). Output: a table mapping each test to {run | inspect | defer-with-fixture-FUTURE_WORK-entry}.

**Mature for adoption:** YES. Caused saved time this slice; simple 3-option choice; reusable across all read-heavy slices going forward.

### #7 — Phase 4B quality review prompt should be augmented with Phase A runtime findings before handoff

**Rule:** Between Phase A completion and Phase 4B review, Cowork drafts an augmentation block listing runtime findings that Phase 4B should investigate (constraint provenance gaps, gold-plating decisions, tie-order observations, KI status changes, perf measurements). The reviewer prompt = slice doc Section 8 + Cowork augmentation. The augmentation cites specific Phase A test IDs and observed evidence so the reviewer doesn't re-derive context.

**Why:** Slice 6.1's review prompt was Section 8 base + a 7-item Cowork augmentation. Of the 7 items, 6 resulted in concrete actions (1 code change, 3 DECISIONS entries, 1 KI rewrite, 2 FUTURE_WORK entries). The standard Section 8 checklist would have missed all 7 because they only became visible during runtime testing. Without the augmentation, the gold-plating questions get logged as Cowork-only DECISIONS proposals; the constraint provenance gets logged as a 🔴 KI; the tie-order fix doesn't happen until Slice 6.2 testing surfaces it.

**How to apply:** Add a "Phase A → Phase 4B handoff" step to the workflow doc. Cowork's deliverable in this step is a markdown block titled "Phase A Surfaced Findings — Investigate Before Final Verdict" that gets prepended to the Section 8 review prompt. Template provided.

**Mature for adoption:** YES. Already used informally and well in Slice 6.1; codifying makes it consistent across slices and reviewers.

### #8 — Conscious gold-plating decisions need a dedicated DECISIONS template

**Rule:** When Codex ships a feature that exceeds the AC's strict letter (delivers a deferred AC ahead of schedule, adds visual signal beyond what's required, etc.), don't default to "strip back to AC scope." Run a 5-question template: (a) Is the deviation intentional or accidental? (b) Cost-benefit (added complexity, schema impact, dependency impact, lock-in risk)? (c) Decision (keep / strip / ask Marcus)? (d) Rationale citing the deferred-spec-AC or the additional-signal nature? (e) Note ownership of the deferred slice that still owns final polish.

**Why:** Slice 6.1 had two clean gold-plating cases (F8 PR-type color scheme; in-progress row title dimming). Both went through "keep + document in DECISIONS." The decision-making happened ad-hoc during Cowork's augmentation drafting; a template would make it uniform across reviewers and slices.

**How to apply:** Add a "Gold-plating decision template" to the DECISIONS.md write protocol. Optionally a dedicated section heading "Conscious deviations beyond AC retained" so future-Marcus can find them quickly.

**Mature for adoption:** EMERGING. First explicit instance in Slice 6.1; pattern is real but evidence base is thin. Hold for accumulation; revisit after one more slice with similar deviations.

### #9 — Spec-author / code-reviewer escalation events are a workflow validation signal worth tracking

**Rule:** Phase 5b reflections explicitly track "escalation events" — moments where Cowork couldn't resolve a question without code-reading and escalated to Claude Code (or vice versa). Track: trigger phrase, resolution time, outcome (false alarm / real issue / new KI / new DECISIONS entry). Pattern emerges over slices: high false-alarm rate suggests Cowork has insufficient spec context; high real-issue rate suggests reviewer prompts aren't catching enough; balanced rate suggests the role split is healthy.

**Why:** Slice 6.1's one escalation (unique constraint provenance) was a clean win for the split — 30 seconds from question to resolution, false alarm correctly identified, no role overreach. Tracking this as data over slices gives Marcus signal on whether the role boundary needs adjustment.

**How to apply:** Add an "Escalation log" subsection to the Phase 5b reflection template with columns: Trigger | Question | Reviewer | Resolution time | Outcome.

**Mature for adoption:** EMERGING. First explicit instance in Slice 6.1; the metric needs ~3 slices of data before the pattern is interpretable. Hold for accumulation.

### #10 — Cowork's `project_instructions` should explicitly enumerate post-slice agents and their owned deliverables

**Rule:** Cowork's `project_instructions` block (loaded into every Cowork conversation context) gains a "Post-slice deliverable map" section enumerating all agents (Cowork, Codex, Claude Code, wiki agent, others as added) and their owned per-slice outputs with trigger phrases and output paths.

**Why:** Slice 6.1 burned ~2 conversation turns mid-Phase-5b on the wiki-agent / Cowork role boundary blur. Cowork had assumed the build-log update was its own deliverable and started preparing a stub plan. The information existed in Marcus's mental model but wasn't in the boundary-defining doc Cowork reads. A 5-line addition prevents the same mistake on future slices and on future contributors who pattern-match against the loaded instructions.

**How to apply:** Edit `project_instructions` block. Add a table:

```
| Deliverable                  | Owner        | Trigger phrase                          | Output path                                    |
|------------------------------|--------------|-----------------------------------------|------------------------------------------------|
| Slice spec                   | Cowork       | "Starting design for Slice N"           | spec/slices/SLICE_N.md                         |
| Codex code generation        | Codex        | (paste Phase 4A prompt)                 | slice's allowed file list                      |
| Phase 4B quality review      | Claude Code  | (paste Phase 4B prompt)                 | code edits + flagged items                     |
| Post-slice automation        | Claude Code  | "Slice N verified — run post-slice"     | CHANGELOG/DECISIONS/KI/FUTURE_WORK + commit    |
| Phase 5b reflection          | Cowork       | "Slice N complete, draft Phase 5b…"     | phase-5b-drafts/SLICE_N-reflection.md          |
| Build-log update             | Wiki agent   | "Log Slice N to the build-log."         | wiki/technical/Apps/<project>/build-log.md     |
```

**Mature for adoption:** YES. Caused real friction this slice (~2 turns); zero-cost addition to project_instructions; aligned incentive (Cowork knows its boundary by reading instructions, not by being corrected).

---

## Mature for adoption summary

| # | Candidate | Status |
|---|-----------|--------|
| 5 | Live schema dump in Phase 4A | ✅ Mature — propose for v2.2 |
| 6 | Phase A Path A/B/C formalization | ✅ Mature — propose for v2.2 |
| 7 | Phase 4B augmentation pattern | ✅ Mature — propose for v2.2 |
| 8 | Gold-plating DECISIONS template | 🟡 Emerging — hold one slice |
| 9 | Escalation event tracking | 🟡 Emerging — hold ~3 slices |
| 10 | Post-slice deliverable map in project_instructions | ✅ Mature — propose for v2.2 |

Four mature, two emerging. The four mature candidates flow into the `second_brain/inbox/` pipeline per project instructions; Marcus accepts/edits/rejects each, then they land in `vibecoding-workflow-v2.md` for next-revision adoption.

---

## Slice 6.1 in one sentence

The first read-only History slice; cross-link contract via shared components and hybrid PR-count query both worked on first run; Phase A surfaced a schema drift (sessions.session_name), an undocumented constraint (migration 009 partial unique), and two gold-plating decisions (PR-type color scheme + in-progress dimming) — all resolved cleanly through the spec/reviewer split and now documented in DECISIONS for the audit trail.
