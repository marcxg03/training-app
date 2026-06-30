# Phase 5b Reflection — Slice 7a (Library Tab + Workouts Rename)

_Drafted: 2026-05-04_
_Source commit: post-slice automation landing (Slice 7a complete)_

---

## What worked in the workflow this slice

**The Phase 4B augmentation pattern earned its keep again.** Slice 6.1's #7 candidate (Phase A surfaced findings as a Phase 4B prompt augmentation) was used cleanly in 7a. The Phase A run-log surfaced three items — Codex's `session-state.ts` allowlist deviation, the in-place RLS dependency fix in migration 014, and the seed parser's "merge banks" interpretation of dedupe — that the standard Section 8 checklist would have missed. Of those three, the dedupe interpretation turned out to be the load-bearing one: it was masking the unfinished wiki rewrite (the missed Calves collision). Without the augmentation, Calves would have shipped as a silent block_type flip on Saturday.

**The spec-author / code-reviewer escalation pattern produced a methodologically-correct fix.** When Phase 4B surfaced Codex's hard-coded `if (blockName === "Calves") return "failure"` override, the resolution path was textbook: Claude Code flagged it; Cowork (the spec author who knew Slice 2's mobility classification was the methodology intent) recommended the rename approach; Marcus accepted; Claude Code executed the wiki edit + parser revert + re-seed verification. Three roles, three contributions, single-cycle resolution. The hard-coded override would have been wrong methodologically (ATG end-of-flow calf work runs as mobility, not failure); the rename mirrors the Phase 0 pattern already used for Mid Chest and Lateral Raise. Cowork's spec-author authority on methodology intent is exactly what the role split exists for.

**Path B (additive-fixture-first / defer-destructive) continued working.** Slice 6.1's #6 candidate. In 7a it applied to T19 (cardio empty state) and T21 (recovery empty state) — both required `DELETE FROM block_*_items` + restore via re-seed; both were skipped in favor of code-inspection verification, with FUTURE_WORK entries logged for end-to-end at the next integration milestone. Saved ~10 minutes of fixture-restore work and the empty-state ternaries are simple enough that runtime drift is near-zero risk.

**Carry-forward verification closed three KIs in one slice.** S4-M1 (in-flight save lost on tab close) verified via the deliberate tab-close-mid-save test in pre-Phase-5 setup. Slice 5's mobility-PR-detection FK population KI ratified during T7 (Plan tab Day Detail's JOIN through the renamed `workout_blocks → blocks → block_lifting_items → exercises` chain). Slice 6.1's empty-state e2e verification closed naturally because the targeted DB wipe left the post-7a state in exactly the configuration T8 needed to test all three empty-state variants. Three KIs that had been carrying for 1-3 slices each, all closing cleanly without scoping any of them as primary slice work. The spec discipline of "carry-forward KI verifications into the next natural test pass" is visibly paying off.

**The cross-link contract continues to enforce itself.** Tests T25 + T26 passed cleanly on first run for the second slice in a row (Slice 6.1 Test 10 was the first). Codex generated `BlockLink` and the four `crossLinks.ts` href helpers without any violations; no component imported `next/link` outside the four allowed files; no hardcoded `/library/lifting/blocks/` paths anywhere outside `crossLinks.ts` + `BlockLink.tsx`. The shared-component-with-href-helper pattern is structurally self-enforcing — the contract holds without anyone needing to manually police it during review.

**Phase A regression discipline caught zero new bugs but surfaced six IA gaps.** T6-T10 (regression on existing surfaces post-rename) all passed without a single column-name miss in user-visible surfaces. The schema rename cascade landed correctly across Today, Plan, History, Logger, Sync — five surfaces verified end-to-end. What Phase A DID surface was a bumper crop of polish/IA observations: Today completion-state for lift cards, muscle-group grouping for Library Lifting, Exercises catalog as a Library 4th sub-tab, format-badge differentiation for cardio activities, the redundant "Recovery"/"Cardio" header card in read-only mode, inconsistent back-button presence across deep routes. None of these are bugs; all six are real UX improvements and most are now scoped into Slice 7b. Phase 5 doing exactly what it should — walking through actual surfaces reveals the gap between spec intent and lived experience.

**The Step 0 test-data wipe approach was a clean pre-hardening move.** Migration 013 opens with `DELETE FROM pr_history WHERE set_log_id IS NOT NULL; DELETE FROM set_logs; DELETE FROM session_completions; DELETE FROM block_exercises; DELETE FROM blocks;` to empty the table before the new `UNIQUE (owner_user_id, block_name)` constraint commits. Two architecturally-correct properties fall out: (a) the migration is idempotent against any test DB state, not just the specific shape at slice authorship time; (b) Slice 2's three seeded historical PRs survive (the `set_log_id IS NULL` partial DELETE preserves them). Pre-hardening at spec time avoided what would otherwise have been a 23505 unique-violation crash mid-Codex-run. Logged in DECISIONS as the chosen Option A.

**Schema rename cascade was substantial but mechanical.** ~55 files touched across migrations, seed, routes, components, sync, queue. T6-T10 verified all five user-visible surfaces. The runtime-vs-cognitive-friction distinction held: every DB-layer rename worked correctly; only TS-level identifier names lagged (deferred to 7a.5). This is the slice that proves the cascade can be done without breaking runtime — future schema renames can follow the same pattern.

---

## What was hard and why

**The Calves block_type collision was a real spec-author miss.** The Phase 0 wiki-grep enumerated three same-name collisions (Mid Chest, Lateral Raise, Hot Yoga/Sauna) but missed Calves. Both Tuesday Lower Compound and Saturday Lower ATG had blocks named "Calves" with different `block_type` semantics — Tuesday `failure`, Saturday `mobility` per Slice 2 spec. The collision didn't surface until Codex's seed parser hit the new UNIQUE constraint and resolved it via the silent `failure` override. Phase 4B caught the override; Cowork (this chat) recommended the wiki rename; the fix landed. But the friction cost an iteration cycle. Root cause: I did a mental enumeration of "blocks I knew were duplicated" rather than running a mechanical grep pass over the wiki. Workflow improvement candidate already logged (#11 below).

**The TS-level `session_*` half-rename was a known scope-vs-discipline tradeoff.** Edge Case 17 of the slice spec said quality review MUST grep for any lingering `session_*` references and rewrite. Codex did the DB-layer rename cleanly but didn't cascade to in-memory JS field/prop names — ~25 references across 11 files. Strictly, this is a Phase 4B failure to enforce. Pragmatically, bundling the rewrite into 7a's Phase 4B review would have diluted attention from the Calves issue and added rename-introduced-bug risk to a 55-file slice. Slice 4.5 established the "Bypass project chat for small corrective slices" pattern (FUTURE_WORK candidate #2); applying it here gives 7a.5 as a focused mechanical-rename PR. The DB layer is correct; runtime is unaffected; the deferred TS cleanup is cognitive friction only. But the spec said MUST and we deferred, so the tension is real.

**The "merge banks" dedupe interpretation almost shipped.** Codex's first-pass seed parser interpreted the "same name → same block" requirement as "merge exercise banks if banks differ." That's NOT what the spec said — Q7a was "rename one of them in the wiki when banks differ." The merge interpretation was masking unfinished wiki edits. Phase 4B caught it via the augmentation prompt. The pattern repeats from Slice 6.1: Codex makes a sensible-but-wrong judgment call when the spec underspecifies; Phase 4B catches it; the fix is to remove the cleverness and go back to the spec intent. Suggests the spec's Section 4 contracts could be more explicit about "what the parser should do when an invariant is violated" — abort with a descriptive error pointing at the wiki, NOT silently recover.

**The S4-M1 closure didn't auto-happen in the post-slice automation.** I told Marcus the post-slice sequence would close S4-M1 (verified end-to-end via T0b). The new Slice 7a section in KNOWN_ISSUES.md landed cleanly with the new 🟡 entry, but the existing Slice 4 S4-M1 entry was untouched — still present, still uncrossed, still 🟡. Either Claude Code's post-slice automation didn't pick up the closure intent, or my Phase 5 conclusion message didn't include enough context for the trigger phrase to execute it. Worth a workflow candidate (#15 below): post-slice automation should explicitly take "KIs to close" and "KIs to open" as parameters from the user trigger, not infer from prior chat.

**The "false alarm" on the unique constraint provenance happened a SECOND time.** During Slice 7a's Phase A wiki edits, when the Calves issue surfaced, my immediate thought was "is this another undocumented constraint like the `idx_pr_history_set_log_pr_type_unique` from 6.1?" It wasn't — it was a wiki-grep gap. But the fact that the spec author defaulted to "constraint surprise" rather than "wiki gap" reveals that Slice 6.1's #5 candidate (Phase 4A live schema dump) was even more important than I'd appreciated. If the schema dump had been part of the Slice 7a Phase 1 spec drafting, I'd have seen the existing constraints, the existing partial unique index, AND the existing block table population — and the latter would have flagged the Calves duplicate during my pre-Codex review. Same root cause as 6.1's `sessions.session_name` drift; same root cause as 6.1's unique-constraint surprise. Three findings, one missing workflow rule.

**Cowork's role boundary on build-log delivery had to be re-corrected mid-Phase-5b-prep.** I assumed (wrongly) that the build-log update was Cowork's deliverable. Marcus corrected mid-prep and provided the wiki-agent template. We salvaged with a one-time Cowork stub for Slice 6.1; Slice 7a's reflection skips the stub per the corrected workflow. Recurring lesson from Slice 6.1's #10 candidate: project_instructions need a post-slice deliverable map enumerating Cowork / Codex / Claude Code / wiki agent ownership per output. Still not adopted; bit a second time.

---

## Candidate workflow improvements

Numbered #11–15, continuing the implicit series from prior reflections.

### #11 — Pre-slice wiki-grep should enumerate ALL same-name collisions, not the mentally-cataloged subset

**Rule:** When a slice introduces a uniqueness constraint over a wiki-driven catalog (like Slice 7a's `UNIQUE (owner_user_id, block_name)`), the pre-slice wiki-rewrite step requires an explicit grep pass enumerating every name occurrence across the wiki. Compare names across workouts; flag every name that appears 2+ times; require explicit handling for each (rename, accept-with-merge, or accept-with-distinct-block_type). The mechanical enumeration replaces the spec author's mental enumeration.

**Why:** Slice 7a's Phase 0 wiki-edit step caught Mid Chest, Lateral Raise, Hot Yoga/Sauna by the spec author's recall. It missed Calves because Calves wasn't in the cataloged set. The collision didn't surface until Codex's seed parser hit the new UNIQUE constraint at runtime, by which point the parser had silently flipped Saturday's classification. A `grep -E '^\| [0-9]+ \| ' wiki/current-plan.md | sort -t'|' -k3 | uniq -c -f2 | sort -rn` (or equivalent for the wiki's actual table format) would have surfaced every block-name collision in 30 seconds.

**How to apply:** Add to the Phase 0 wiki-rewrite step in any slice that introduces a catalog uniqueness constraint: "Run a mechanical grep pass enumerating every name occurrence in the wiki. For each name appearing 2+ times, decide handling (rename / accept-as-shared / accept-with-distinct-metadata). Document each decision."

**Mature for adoption:** YES. Caused real friction this slice; cheap to apply; reusable pattern.

### #12 — Schema-rename slices need a regression-test template covering every read/write surface

**Rule:** When a slice renames a database table or column referenced from ≥3 surfaces (routes / components / queries), Phase 5 manual tests must include a regression test for each surface. The test is not "verify the new behavior works" but "verify the surface that READS the renamed entity still renders and the surface that WRITES the renamed entity still persists." Generalize: any rename slice's Section 6 must include T6-style surface-by-surface regression tests.

**Why:** Slice 7a's T6-T10 cluster (Today, Plan, History, Logger, Nutrition+Settings — five surfaces) was the right pattern. Without it, T9 (Logger) might have surfaced a column-not-found error post-launch. The template forced every consumer to be re-verified. The pattern generalizes: rename slices have a long tail of consumers that easy to miss. A standard checklist beats discovering missed renames in production.

**How to apply:** Phase 1 spec-drafting checklist for slices that rename existing schema: "List every read surface (page route, query, component) that references the renamed entity. List every write surface. Section 6 must include one regression test per surface (or per cluster of related surfaces). The regression test is 'navigate to X, verify Y renders/persists with the renamed schema.'"

**Mature for adoption:** YES. Slice 7a's T6-T10 was effective; codifying makes it consistent across rename slices.

### #13 — Phase 5 IA-discovery findings auto-feed FUTURE_WORK without ceremony

**Rule:** During Phase 5 manual testing, the spec author tracks IA observations as they surface (UX gaps, organizational improvements, polish items, scope expansion candidates). These get auto-rolled into the post-slice FUTURE_WORK additions without separate Phase 0/1 ceremony. The user surfaces the observation; the spec author drafts the FUTURE_WORK entry text in chat; Claude Code's post-slice automation picks them up.

**Why:** Slice 7a Phase 5 generated 6+ FUTURE_WORK entries from regression tests and IA exploration: Today completion state for lifts, muscle-group grouping, Exercises catalog as Library 4th sub-tab, format-badge differentiation, header-card redundancy, back-button consistency. None of these were spec-defined ACs; all surfaced organically during testing; all are real UX improvements. Without an auto-feed pattern, these would either get forgotten between Phase 5 and Slice 7b's Phase 0, or require separate Phase 0 ceremony to formalize. The auto-feed pattern routes the observation directly to where it's needed (FUTURE_WORK as scope candidates for the next slice).

**How to apply:** Add to the Phase 5 spec-author duties in the workflow doc: "While the user runs manual tests, capture IA observations (UX gaps, polish items, scope expansion). Draft FUTURE_WORK entry text inline in chat. Surface to the user as 'add to FUTURE_WORK during post-slice automation' before moving to the next test." Optionally: structure as a "FUTURE_WORK additions queue" that gets handed to Claude Code at post-slice trigger time.

**Mature for adoption:** YES. Pattern is real and used implicitly in 6.1 and 7a; codifying makes it visible.

### #14 — Codex's flagged deviations should default to "kept and documented" not "stripped"

**Rule:** When Codex flags a deviation from the slice's allowlist or AC scope (per the Phase 4A prompt's "list any deviations" requirement), Phase 4B's default disposition is "keep + document in DECISIONS." Stripping back to AC scope is the exception, not the default. Reasons to strip: deviation introduces complexity, schema impact, dependency, or future lock-in. Reasons to keep: deviation improves deliverable, has zero-cost, or is functionally required to make the slice ship correctly.

**Why:** Slice 7a's `session-state.ts` allowlist deviation was flagged correctly by Codex ("compatibility rewrite even though the allowlist didn't name it"). Phase 4B reviewed it, accepted it, and documented it. The right outcome. But the decision-making framework was ad-hoc — "is this OK?" rather than a structured cost-benefit. Same pattern from Slice 6.1's F8 partial delivery + in-progress dimming (Slice 6.1 candidate #8 — gold-plating template). Two slices in a row where Codex's deviation deserved a structured "keep / strip / ask" framework. Worth codifying.

**How to apply:** Phase 4B prompt template gains a "Codex deviation handling" section with a 5-question check: (a) Is the deviation flagged by Codex (intentional) or unflagged (accidental)? (b) Does it improve the deliverable, reach a deferred AC ahead of schedule, or solve a compile/runtime requirement? (c) Cost in complexity, schema, dependencies, lock-in? (d) Decision: keep / strip / ask Marcus? (e) If keep: DECISIONS entry with rationale.

**Emerging:** This is the second slice with this pattern (6.1 + 7a). Hold for one more slice before promoting to mature; if the pattern holds across one more slice, it's ready.

### #15 — Post-slice automation should take explicit "KIs to close" and "FUTURE_WORK to add" parameters from the user trigger

**Rule:** When the user triggers `"Slice N verified — run the post-slice sequence"`, the trigger should include explicit parameters: which existing KIs to close (with closure rationale text), which new KIs to open (with severity + summary), which FUTURE_WORK entries to add (with text). Claude Code's automation acts on the explicit parameters rather than inferring from prior chat.

**Why:** Slice 7a's S4-M1 closure didn't happen automatically. I had told Marcus in the Phase 5 conclusion that the post-slice sequence would close S4-M1; Claude Code's automation added the new entries but didn't act on the closure. Either the trigger phrase didn't carry the closure intent or the automation only handles "add new" rather than "close existing." Either way: the gap is real. KIs that should have closed remain open as cognitive load; FUTURE_WORK that should have been added might also miss; the user has to manually verify post-commit that everything Cowork promised actually landed.

**How to apply:** Update the post-slice automation trigger format from `"Slice N verified — run the post-slice sequence"` to a structured handoff: spec author provides a checklist (closures, opens, FUTURE_WORK additions) at Phase 5 conclusion; user pastes the checklist alongside the trigger phrase; Claude Code acts on the explicit list. Or: post-slice automation explicitly reads the most recent Cowork message before executing and incorporates anything tagged for action. Mechanism flexible; the principle is "explicit handoff, not inferred."

**Emerging:** First instance in 7a. Hold for one more slice to see if the gap recurs; if yes, promote to mature.

---

## Mature for adoption summary

Re-evaluating both prior emerging candidates and the new ones from 7a:

| # | Candidate | Status (post-7a) |
|---|---|---|
| 5 | Live schema dump in Phase 4A | ✅ Mature — propose for v2.2 (validated three times now: 6.1 sessions.session_name drift, 6.1 unique-constraint surprise, 7a Calves miss + spec-author "false alarm" pattern) |
| 6 | Phase A Path A/B/C formalization | ✅ Mature — propose for v2.2 (validated cleanly in 6.1 + 7a) |
| 7 | Phase 4B augmentation pattern | ✅ Mature — propose for v2.2 (validated cleanly in 6.1 + 7a; surfaced different findings each time) |
| 8 | Gold-plating DECISIONS template | 🟡 Still emerging — promote with #14 since they're the same family. Combined evidence: 6.1's F8 + in-progress dimming, 7a's session-state.ts deviation + format-badge minimalism. Three slices of evidence; ready to consolidate as one workflow rule. |
| 9 | Escalation event tracking | 🟡 Still emerging — strong signals in 7a (Calves resolution chain Codex→Phase 4B→Cowork→Marcus; false-alarm constraint provenance). Two slices of data. Promote after one more slice. |
| 10 | Post-slice deliverable map in project_instructions | ✅ Mature — propose for v2.2 (Cowork bit twice on the build-log boundary; explicit map prevents recurrence) |
| 11 | Pre-slice wiki-grep enumerate all collisions | ✅ Mature — propose for v2.2 (caused real friction this slice; mechanical fix; reusable) |
| 12 | Schema-rename regression-test template | ✅ Mature — propose for v2.2 (Slice 7a's T6-T10 was effective; codifying makes it consistent) |
| 13 | Phase 5 IA findings auto-feed FUTURE_WORK | ✅ Mature — propose for v2.2 (used implicitly in 6.1 and 7a; six entries in 7a alone) |
| 14 | Codex deviation default-keep framework (consolidate with #8) | 🟡 Emerging — fold into a single proposal with #8. Combined two-slice evidence is enough to promote consolidated. |
| 15 | Explicit KI-closure parameters in post-slice trigger | 🟡 Emerging — first instance in 7a. Hold for one more slice. |

**Six mature for v2.2 adoption:** #5, #6, #7, #10, #11, #12, #13. (Seven if we count the consolidated #8+#14.)

**Three emerging:** #8 (consolidate with #14), #9, #15.

The seven mature candidates flow into the `second_brain/inbox/` pipeline per project instructions. Marcus accepts/edits/rejects each, then they land in `vibecoding-workflow-v2.md` for next-revision adoption.

---

## Slice 7a in two sentences

The largest schema-touching slice since Slice 4: blocks promoted to a global per-user catalog, sessions/session_completions/block_exercises renamed across ~55 files, four new catalog and junction tables, Library tab as 6th bottom-nav surface with three sub-tabs and drill-into-block-detail. Ran cleanly through the workflow with the Phase 4B augmentation pattern catching what would have been the slice's load-bearing bug (Codex's silent block_type override on the missed Calves collision); closed three carry-forward KIs as side effects of running Phase 5 against the post-wipe state; surfaced six IA gaps that scope into Slice 7b without anyone scoping them deliberately.

---

## Carry-forward observations for Slice 7b Phase 0

These won't be in the slice doc proper but worth surfacing when 7b's readiness check runs:

1. **Slice 7b scope expansion to 4 sub-tabs.** Library Lifting needs a peer Exercises sub-tab (full lifting exercises catalog, edit affordances). Path A (bundle all into 7b) recommended over Path B (split 7b/7c). FUTURE_WORK entry already drafted.

2. **Slice 7b adds `blocks.primary_muscle_group` schema column.** Library Lifting reorganizes by muscle-group sections. Edit form for blocks includes the muscle-group selector. Existing blocks default to NULL → "Unassigned" backlog.

3. **Form library adoption** (RHF + zod) decision point lands in 7b Phase 0 once the actual edit-form scope is known.

4. **Cardio + Recovery format-badge differentiation** + header-card redundancy fixes are 7b polish items. Worth bundling into the 7b edit affordances rather than waiting for Slice 9.

5. **Today completion-state for lift cards** (extension of cardio/recovery completion-tracking entry) is genuinely Slice 8 / 9 territory, not 7b. 7b stays focused on Library catalog.

6. **The Slice 8 Plan Editor surface** depends on 7b's editable Library + the new `blocks.primary_muscle_group` field. 7b unblocks Slice 8's Phase 0 design.
