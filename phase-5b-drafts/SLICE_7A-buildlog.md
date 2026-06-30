<!--
PASTE-READY BUILD-LOG ENTRY for Slice 7a.

Wiki agent doesn't have project folder access, so Cowork drafts the build-log
content from primary sources (CHANGELOG.md, DECISIONS.md, KNOWN_ISSUES.md,
spec/FUTURE_WORK.md). Paste this into wiki/technical/Apps/training-app/build-log.md
appended after the Slice 6.1 entry.

Commit hash placeholder: <fill from `git log -1 --pretty=format:'%h'` on main
post-7a-commit>
-->

## Slice 7a — Library Tab + Workouts Rename

_Completed: 2026-05-04_
_Commit: `<fill>` on `main` (in sync with origin)_
_Status: ✅ Complete_

### What Shipped

- Schema cascade rename: `sessions` → `workouts` table family, including dependent renames in `set_logs`, `session_completions` → `workout_completions`, and `block_exercises` → `block_lifting_items`. Step 0 test-data wipe in migration 013 prevents the new global-blocks UNIQUE constraint from colliding with existing populated data; Slice 2's three seeded historical PRs (`set_log_id IS NULL`) are preserved.
- Blocks promoted to a global per-user catalog with `block_category` discriminator (`lifting` / `cardio` / `recovery`); CHECK-constraint enforces "lifting blocks have block_type, cardio/recovery don't"; UNIQUE on `(owner_user_id, block_name)`.
- New tables: `workout_blocks` junction (workouts → blocks, with polymorphic `preset_activity_id` for cardio/recovery preselection), `cardio_activities`, `recovery_activities`, `block_cardio_items`, `block_recovery_items`, and `activity_completions` (schema-only in 7a; UI defers).
- Library tab as 6th bottom-nav surface in order Today / Plan / Library / History / Nutrition / Settings; labels resized 11px → 10px; `Library` lucide icon.
- Library three-sub-tab IA (Lifting / Cardio / Recovery) with URL-segment routing; `LibraryTabs` is the slice's only Client Component (driven by `usePathname()`); shadcn `Tabs` primitive newly installed; cross-link contract extended with `BlockLink` + `crossLinks.ts` href helpers.
- Lifting sub-tab renders alphabetical block list with drill-into block-detail page (block header + ordered exercise bank from `block_lifting_items`); cardio + recovery sub-tabs render their single block always-expanded inline with activity lists.
- Wiki rewrite: four block-name uniqueness edits (Mid Chest → Bench Press Focus, Lateral Raise → Shoulder Burnout, Hot Yoga/Sauna split into Saturday Sauna + Sunday Hot Yoga, Saturday Lower ATG's Calves → ATG Calves) + seed parser rewrite to populate the global catalog model; re-seed remains idempotent.
- Rename-adaptation pass across Today / Plan / Logger / History / Sync layer: ~55 files changed, ~4,200 insertions, ~1,400 deletions.

### Files Created

```
supabase/migrations/
├── 013_workouts_rename_and_blocks_global.sql       Step 0 wipe + sessions/workouts cascade + blocks promotion
├── 014_workout_blocks_junction.sql                 New junction table + RLS-policy-drop-before-column-drop
├── 015_cardio_recovery_catalogs.sql                Five catalog/junction/completions tables
└── 016_extended_rls_for_library.sql                4-policy patterns on new tables; recreate blocks/block_lifting_items policies with direct owner_user_id scoping

supabase/seed/
├── seed-from-wiki.ts                               Rewritten orchestration for new schema
└── lib/
    ├── methodology-rules.ts                        New parseLiftingBlocksGlobal, parseCardioActivities, parseRecoveryActivitiesCatalog helpers
    └── types.ts                                    Updated TS types for new parsed shapes

src/app/(app)/library/
├── page.tsx                                        Server-side redirect to /library/lifting
├── lifting/page.tsx                                Lifting sub-tab — block list (alphabetical)
├── lifting/blocks/[block_id]/page.tsx              Block detail (header + exercise bank)
├── cardio/page.tsx                                 Cardio sub-tab — single block expanded
├── recovery/page.tsx                               Recovery sub-tab — single block expanded
└── _components/
    ├── LibraryTabs.tsx                             Only Client Component in slice; usePathname-driven
    ├── BlockListCard.tsx                           Lifting block list item (uses BlockLink)
    ├── BlockDetailHeader.tsx                       Block detail page header
    ├── ExerciseListItem.tsx                        Bank exercise row
    ├── CardioActivityCard.tsx                      Cardio activity row
    ├── RecoveryActivityCard.tsx                    Recovery activity row
    ├── BlockTypeBadge.tsx                          Failure / mobility / corrective badge
    ├── CardioFormatBadge.tsx                       Speed run / endurance run / basketball badge
    └── EmptyState.tsx                              Shared empty state component

src/components/shared/
└── BlockLink.tsx                                   F6-pattern wrapper for /library/lifting/blocks/[id]

src/lib/library/
├── queries.ts                                      getLiftingBlocks, getBlockDetail, getCardioBlock, getRecoveryBlock
├── projections.ts                                  TS types for the four projections
├── crossLinks.ts                                   blockDetailHref, liftingHref, cardioHref, recoveryHref
└── displayName.ts                                  Activity caption helpers

src/components/ui/
└── tabs.tsx                                        shadcn Tabs primitive (new install)
```

**Modified:**
- `src/components/layout/BottomTabBar.tsx` — 6 tabs in order Today/Plan/Library/History/Nutrition/Settings; 10px labels
- All Today / Plan / History / Logger / Sync surfaces — column reference updates from sessions/session_id/session_name/session_completion to workouts/workout_id/workout_name/workout_completion
- Renamed routes: `today/session/[session_id]` → `today/workout/[workout_id]`; `log/[session_id]` → `log/[workout_id]`; `history/sessions` → `history/workouts`; `history/sessions/[completion_id]` → `history/workouts/[completion_id]`
- Renamed components: `SessionSummary` → `WorkoutSummary`, `EndSessionDialog` → `EndWorkoutDialog`, `SessionLink` → `WorkoutLink`, `AllSessionsRow` → `AllWorkoutsRow`
- Renamed query helpers: `getAllSessions` → `getAllWorkouts`, `formatSessionDisplayName` → `formatWorkoutDisplayName`, `sessionDetailHref` → `workoutDetailHref`, `allSessionsHref` → `allWorkoutsHref`
- `.prettierignore` — `phase-5b-drafts/`, `workflow-v3.md`, `setup-guide-v2.md` (Marcus-owned drafts excluded from format gate)
- `spec/MASTER_SPEC.md`, `spec/ARCHITECTURE.md` — Slice 7a-related corrections; Library tab sections (§13, §17) drafted but writing deferred per Phase 1 follow-up workflow
- `CHANGELOG.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`, `spec/FUTURE_WORK.md` — post-slice automation additions

### Design Decisions Made (Slice 7a)

1. **Step 0 test-data wipe in migration 013** — open with a partial DELETE that wipes Slice 4-6 verification data while preserving Slice 2's three seeded historical PRs (`set_log_id IS NULL`); rejected the SQL-CASE-based dedupe alternative (brittle for the Calves resolution) and the per-category UNIQUE alternative (would have broken the catalog model).
2. **Blocks promoted to global per-user catalog with `block_category` discriminator** (Path α from Phase 0); rejected per-session blocks with logical Library aggregation (Path β) because edit propagation semantics get awkward at every edit and Plan Editor (Slice 8) becomes much simpler under the global model.
3. **Cardio and recovery blocks user-specific (per-user singletons)** rather than system-shared; rejected the system-singleton variant because it would have introduced a NULL `owner_user_id` exception in an otherwise-clean schema model and would have prevented future per-user customization.
4. **`session_blocks` renamed to `workout_blocks`** — junction table named after the renamed `workouts` parent; rejected keeping `session_blocks` as a legacy carryover because the cognitive friction of stale naming compounds across slices.
5. **`workout_blocks.preset_activity_id` + `preset_activity_type` polymorphic pair without DB-level FK** — Plan Editor (Slice 8) will populate these for cardio/recovery; lifting workouts keep them NULL; application enforces FK integrity (no DB-level CHECK because Postgres can't reference different tables based on a discriminator); rejected three-way nullable FK columns (one per category) because it scales poorly to additional categories.
6. **Cardio fields relocated from `workouts` (formerly `sessions`) to `cardio_activities`** — cardio_format, cardio_distance, cardio_target_zone now live on the catalog activity row; rejected keeping them on workouts because they're properties of the activity (Speed Run is a Speed Run regardless of which day it's scheduled), not the schedule.
7. **Calves block_type collision resolved by wiki rename, not parser override** — Saturday Lower ATG's "Calves" → "ATG Calves" (preserves Slice 2's mobility classification); rejected accepting Codex's hard-coded `failure` override because it silently contradicted Slice 2 spec, was methodologically wrong for ATG-style mobility/end-of-flow calf work, and hard-coded parser overrides scale poorly to future name collisions.
8. **TS-level `session_*` rename deferred to Slice 7a.5** — DB layer fully renamed; ~25 in-memory JS field/prop names remain; rejected fixing in Slice 7a's same Phase 4B review because it would have diluted attention from the methodologically-important Calves issue and added rename-introduced-bug risk to a 55-file slice.
9. **Library tab IA: sub-tab routing with URL segments + Pattern α drill-in for Lifting** — `/library/lifting`, `/library/cardio`, `/library/recovery` as separate routes; block detail at `/library/lifting/blocks/[id]`; rejected sub-tab-as-client-state (loses shareable URLs and SSR benefits) and inline-accordion expand (complicates 7b's edit affordances).
10. **Bottom nav grows from 5 to 6 tabs at 10px labels** in order Today / Plan / Library / History / Nutrition / Settings; rejected dropping or merging an existing tab (each carries discrete user value at their current level) and rejected moving Settings to a header profile icon (Slice 9 IA territory, not Slice 7a).
11. **`LibraryTabs` is the only Client Component in the slice** (`"use client"`); shadcn Tabs primitive wraps `next/link` triggers; active sub-tab derived from `usePathname()` (no client useState); rejected client-state sub-tab tracking because it would lose SSR benefits and complicate 7b's inline-form edit affordances.
12. **F6 cross-link contract extended with BlockLink** in `src/components/shared/`; href centralized in `src/lib/library/crossLinks.ts`; pattern matches Slice 6.1's ExerciseLink + WorkoutLink (renamed from SessionLink); rejected per-page-component direct `next/link` imports for the same reasons that drove the Slice 6.1 pattern (single source of href truth, F6 contract enforcement).

### Issues Hit + Resolved

| Issue | Resolution |
|-------|------------|
| Calves block_type same-name + different-block_type collision (Tuesday `failure`, Saturday `mobility`) — Codex's first-pass parser silently overrode Saturday to `failure` | Renamed Saturday's "Calves" → "ATG Calves" in the wiki (mirroring Phase 0 rename pattern) + reverted parser override; verified post-reseed: ATG Calves → mobility, Calves → failure |
| Migration 013's UNIQUE constraint on `(owner_user_id, block_name)` would have hit 23505 against the populated pre-7a blocks table | Pre-hardened with Step 0 test-data wipe before Codex generation; Slice 2 seeded historical PRs preserved by partial DELETE |
| Migration 014's RLS policy dependency on `blocks.session_id` (existing policies referenced the column being dropped) | Codex correctly dropped the orphaned policies in 014 before the column drop; 016 recreated them with direct `auth.uid() = owner_user_id` scoping |
| Codex's first-pass seed parser interpreted "same-name dedupe" as "merge banks if banks differ" — wrong per spec intent | Phase 4B augmentation prompt surfaced the misread; corrected to strict rename-on-collision + abort-on-violation; loud error path replaces silent recovery |
| Codex's `src/lib/methodology/session-state.ts` allowlist deviation — file outside Section 3 list got modified | Phase 4B confirmed deviation was legitimate (compatibility rewrite required for compile against renamed schema); accepted with documentation in CHANGELOG |
| Three Marcus-owned draft files (`workflow-v3.md`, `setup-guide-v2.md`, `phase-5b-drafts/*`) failing `format:check` from Slice 6.1 onward | Added to `.prettierignore` as a Slice 7a tag-along fix |

### Known Issues Carried Forward

| ID       | Severity      | Issue                                                                                                                                                                  |
| -------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0-L1    | 🟢 Low        | Recovery activity type granularity (will be addressed by Slice 7b's `recovery_activities` editing or by an earlier dedicated migration)                                |
| S1-L1    | 🟢 Low        | Supabase free-tier email rate limit blocks rapid repeat sign-ins. Workaround: wait ~1 hour or use different email                                                      |
| S2-L1    | 🟢 Low        | Migration 007 force-apply silent fail (historical incident); resolved by 008. Documented for audit trail                                                              |
| S4-M1    | 🟡 Medium     | In-flight save lost on tab close — **VERIFIED PASS during Slice 7a Phase 5 pre-test setup** (deliberate tab-close-mid-save test); pending KI closure in cleanup tail (post-Slice-7a) |
| S4-L1    | 🟢 Low        | Volume tile shows 0 for bodyweight-only sessions. Cosmetic; Slice 9 polish                                                                                            |
| S4-L2    | 🟢 Low        | No "Discard session" path. Slice 9 target                                                                                                                              |
| S4.5-L1  | 🟢 Low        | Slice 4 testing rows with `weight_kg = NULL` for bodyweight. Cosmetic data shape                                                                                       |
| S5-L1    | 🟢 Low        | Failure-block auto-advance writer gap → ✅ Resolved in Slice 5 fix; workflow improvement candidate logged                                                              |
| S5-L2    | 🟢 Low        | `pr_history.set_log_id` legacy rows — verified populated correctly on both failure-block and mobility-PR-detection paths via Slice 6.1 Phase A; pending KI closure in cleanup tail |
| **S7a-M1** | 🟡 Medium     | TS-level `session_*` identifiers half-renamed: ~25 references across 11 files (logger components, plan day route, page-level prop types, queue discriminated union kinds). DB layer fully renamed, runtime unaffected. Mechanical cleanup deferred to Slice 7a.5 |

### Workflow Improvement Candidates (Slice 7a)

| #   | Observation                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | **Pre-slice wiki-grep should enumerate ALL same-name collisions, not just the spec author's mentally-cataloged subset.** Slice 7a's Phase 0 wiki edits caught Mid Chest, Lateral Raise, Hot Yoga/Sauna by recall but missed Calves, which surfaced post-Codex when the seed parser hit the new UNIQUE constraint and silently flipped Saturday's classification. Mechanical grep enumeration replaces the spec author's mental enumeration. Mature for v2.2 adoption. |
| 12  | **Schema-rename slices need a regression-test template covering every read/write surface.** Slice 7a's T6-T10 (Today/Plan/History/Logger/Nutrition+Settings regression) was the right pattern; without it, a missed column rename could have shipped silently. Codify as a Phase 1 spec-drafting checklist for any slice touching renamed schema: enumerate every consumer surface; require one regression test per surface in Section 6. Mature for v2.2 adoption. |
| 13  | **Phase 5 IA-discovery findings auto-feed FUTURE_WORK without ceremony.** Slice 7a Phase 5 generated 6+ FUTURE_WORK entries from regression tests (Today completion state, muscle-group grouping, Exercises catalog as 4th sub-tab, format-badge differentiation, header-card redundancy, back-button consistency). Spec author tracks these inline during testing; post-slice automation rolls them into FUTURE_WORK at trigger time. Mature for v2.2 adoption. |
| 14  | **Codex's flagged deviations should default to "kept and documented" not "stripped."** Slice 7a's `session-state.ts` allowlist deviation was flagged by Codex, kept by Phase 4B with rationale, documented in CHANGELOG. The decision-making framework was ad-hoc; codifying as a 5-question check (intentional? improves deliverable? cost? decision? rationale?) consolidates with Slice 6.1's gold-plating template (#8). Two slices of evidence; promote consolidated. |
| 15  | **Post-slice automation should take explicit "KIs to close" + "FUTURE_WORK to add" parameters from the user trigger.** Slice 7a's S4-M1 closure didn't auto-happen despite the spec author signaling it in Phase 5 conclusion. Either the automation only handles "add new" or the trigger phrase didn't carry the closure intent. Update post-slice trigger format to include explicit closure parameters; Claude Code acts on the explicit list rather than inferring from prior chat. Emerging — first instance, hold for one more slice. |
