# Build Log — Block II / Adjustable-Sets redesign

Branch `redesign/block-ii-adjustable-sets`. Order: **B1 scheme → B2 cut-validation → B3 seed Block II** → final roast+verify → integration.

Gates satisfied by the 2026-09-20 interview: spec (REDESIGN_BRIEF §0 + BLOCK_II_SEED) + plan (Marcus greenlit autonomous run). OUT of scope: mono reskin (design-led), community/B4 (post-Nov-16).

---

## B1 — Adjustable set-scheme ✅ (2026-09-20)

**Built:** migration 025 adds `warmup_sets`/`working_sets`/`to_failure` to
`blocks`; `workout-state.ts` gains `getSetSchemeSteps`/`getSetLabel`/
`blockSetCount`/`isLastSchemeSet`; `isBlockComplete` auto-completes at
`warmup_sets+working_sets`; FailureProtocol + LoggerShell + the log-page
projection consume the scheme.

**Roast-fix pass (findings from the 3-council review):**

- MF1/D11 — migration 025 backfill `UPDATE blocks SET to_failure = true WHERE
block_type = 'failure';` so legacy failure blocks keep the last-set-to-failure
  semantics (the "F" badge) instead of silently flipping to false.
- MF2/D13 — write path: `BlockPayload`/zod schema gain optional
  `warmup_sets`/`working_sets`/`to_failure`; `createBlock` persists them
  (insert derives `to_failure = block_type==='failure'` when unset);
  `updateBlock` persists them and, on a `block_type` flip with no explicit
  form value, reconciles `to_failure`; BlockForm gets functional
  number inputs + a to-failure checkbox (prefilled on edit via
  `getBlockDetail`/`LiftingBlockDetail`).
- SF3/D12 — migration 025's working-set CHECK scoped to lifting
  (`block_category != 'lifting' OR working_sets >= 1`), mirroring 013's
  `blocks_lifting_has_type` partial CHECK.
- SF4 — extracted `isLastSchemeSet(block, savedIndex)` and used it in
  FailureProtocol; `verify-set-scheme.ts` gains 6 assertions (failure-checkbox
  gate both branches, warmup=0 → no WU label, out-of-scheme `Set N` fallback,
  isLastSchemeSet both branches). Verified the failure-checkbox pair goes RED
  against a reintroduced regression.
- SF5/D14 — naming comments on `block_type==='failure'` (= "uses the structured
  set-scheme protocol", distinct from the `to_failure` column); KNOWN_ISSUES
  records the hand-edited types.ts / db-push-before-gen-types ordering hazard.

**Verified:** `pnpm exec tsx scripts/verify-set-scheme.ts` → 15/15 pass;
`scripts/ralph-verify.sh` → GREEN (format/typecheck/lint/build).

## ✅ B1 — Adjustable set-scheme per block — DONE (2026-09-20)

Commits: `bbb953e` (slice) → `c88389c` (roast fixes) → format fix.
Built: migration 025 (additive warmup_sets/working_sets/to_failure on blocks + backfill to_failure=true for legacy failure blocks + lifting-scoped working_sets CHECK); `isBlockComplete` auto-completes at warmup+working; `getSetSchemeSteps`/`getSetLabel`/`isLastSchemeSet` helpers; FailureProtocol + LoggerShell scheme-driven; log-page projection threads the columns; createBlock/updateBlock write + reconcile the scheme; BlockForm inputs.
Verify (coordinator re-ran): verify-set-scheme.ts 15/15; ralph-verify.sh GREEN (format/typecheck/lint/build).
Roast: 🟡 FIX FIRST → 2 must-fix (migration data-regression on is_to_failure; feature inert / no write path) + 3 should-fix (lifting-scoped CHECK, missing scheme tests, block_type/to_failure naming). All fixed. Convergence re-roast: CONVERGED, no new must-fix.
Deferred (should-fix, out of scope): form block_type-flip could leave an inert to_failure=true on a corrective block (harmless — gated by block_type==='failure'). Reskin of these inputs → the separate mono design pass.
Seam for B3: most Block II lifts are block_type='failure' (structured scheme) but NOT to failure — B3 MUST set to_failure explicitly (false for 2-working-set lifts, true only for Thu dips); createBlock/seed honors an explicit false.

## ✅ B2 — Cut the methodology validation guardrails — DONE (2026-09-20)

Goal (D5/D10): a 7-day plan with ZERO full rest days (Block II — Sunday is ATG recovery, not rest) must save without a hard block, and the seed pipeline must emit no `hardViolations` for it.
Built:

- `src/lib/methodology/plan-schedule.ts` — cut the `weekRestDayError` hard rule; `validateSchedule` now always returns `hardErrors: []` (signature + `ScheduleValidation` shape preserved) and keeps only the informational SOFT layer (`daySoftWarnings`, cardio-before-lift).
- `src/app/(app)/plan/[day]/_components/DayEditForm.tsx` — removed the now-dead `blocked` flag + hard-error UI block + the `blocked`-gated submit-button disables; kept the soft-warning card and the "Save anyway — overriding N warning(s)" affordance.
- `supabase/seed/lib/methodology-rules.ts` — downgraded every former-hard rule in `validateTrainingPlan` (48h recovery, compound window, push/pull balance, min rest day, sauna cap, missing-muscle, hot yoga + sauna) to `softWarnings`; `hardViolations` retained as an always-empty array (ValidationResult shape unchanged). Function exported so the verify script can assert it.
- NOT touched: `plan/mutations.ts` integrity guards (no-remove-logged-session, blocks-frozen) — data-integrity, not methodology.

Verified: `scripts/verify-schedule-validation.ts` written test-first (RED: 3 fail — the two no-rest-day hard-bucket assertions + the soft-resurface check) → GREEN 6/6 after the change; proves the soft layer (cardio-order + resurfaced min-rest-day) still populates. `scripts/ralph-verify.sh` → GREEN (format/typecheck/lint/build).
Forced decision (not in ledger): exported the previously-internal `validateTrainingPlan` (additive; no signature change) so the free in-isolation seed assertion is possible without a live Supabase.

## ✅ B2 — Cut the validation guardrails — DONE (2026-09-20)

Commit: `778c90a`.
Built: removed `weekRestDayError` (min-rest-day HARD rule); `validateSchedule` now returns `hardErrors:[]` always (signature preserved); DayEditForm's dead `blocked`/hard-error UI removed, soft-warning "Save anyway" path kept; seed `methodology-rules.validateTrainingPlan` downgrades all former hardViolations (48h recovery, push/pull, min-rest, sauna, missing-muscle, hot-yoga) → softWarnings; `hardViolations` kept as always-empty array (no type churn).
Verify (coordinator re-ran): verify-schedule-validation.ts 6/6 (RED→GREEN); ralph-verify.sh GREEN.
Roast (focused): CONVERGED — no dangling refs, no consumer loses a needed guard (seed throw now no-ops by intent), submit-in-flight guard retained. Enables B3 (Block II has no full rest day).

## ✅ B3 — Seed Marcus's Block II as the active plan — DONE (2026-09-20)

Goal (D8/D15): `parsePlanFromWiki` on the authored Block II seed yields a `TrainingPlanSpec` with the 7-day split (Mon Upper / Tue Lower / Wed Basketball / Thu Push / Fri Pull / Sat HYROX / Sun ATG recovery), lifting blocks + banks, and the per-block set-schemes populated; `validateTrainingPlan` emits no `hardViolations`; `syncGlobalBlocks` writes the scheme columns.
Built:

- `supabase/seed/wiki/*.md` (6 files, gitignored → force-added with `git add -f` so the build is reproducible and the seed path is the one `npm run seed` reads): `current-plan.md` (Weekly Schedule + per-workout Block tables with an added `Sets` column + Running Sessions/Warm-Up Protocols) plus minimal valid `overview.md`, `master-plan.md`, `training-log.md`, `nutrition.md`, `plan-decisions.md`.
- `supabase/seed/lib/types.ts` — `ParsedBlock` gains additive `warmupSets`/`workingSets`/`toFailure`.
- `supabase/seed/lib/methodology-rules.ts` — new `parseSetScheme` reads the optional `Sets` column ("2 × 6–8" / "2 × failure" / "1 WU + 2 × failure"); `parseWorkoutBlocks` threads it onto each block (continuation rows don't override); default {1,2,false} when the column is absent (back-compat).
- `supabase/seed/seed-from-wiki.ts` — `syncGlobalBlocks` insert AND the idempotent diff (comparableExisting/comparableDesired) now carry `warmup_sets`/`working_sets`/`to_failure`; lifting rows from the parsed block (D11: Block II failure blocks seeded `to_failure=false`, only Thu dips true), cardio/recovery at column defaults.
- `scripts/verify-block-ii-parse.ts` — written test-first (RED on missing md + un-emitted schemes), GREEN after: 15 assertions (day count/order, session types, Monday 3 rounds + banks, Thu dips to_failure=true/workingSets=2, the 2-working-set lifts to_failure=false, only-dips-is-to-failure, hardViolations empty).

Verified: `pnpm exec tsx scripts/verify-block-ii-parse.ts` → RED (missing files) then 15/15 GREEN; `verify-set-scheme.ts` still 15/15; `scripts/ralph-verify.sh` → GREEN (format/typecheck/lint/build). `syncGlobalBlocks` DB-write verified by code-reading (no live DB, per stub): scheme columns are in the insert payload and the compared shape.
Doc-sync note for coordinator: the vault's human `current-plan.md` v4 (prose "Sessions" + a `Day | Session | Conditioning` table) does NOT match the parser grammar (`Day | Session | Gym | Add-ons` + per-workout `Block | Primary | Secondary | Type | Sets` tables + `Running Sessions`/`Warm-Up Protocols`). The seed is authored in parser grammar; steady-state Tue/Thu/Sun cardio and Monday plyos/track are omitted from the schedule (kept only in Running Sessions) since they have no matching cardio-catalog entry — a divergence to reconcile if those are wanted in-app.
Forced decision (not in ledger): `spec/BLOCK_II_SEED.md` named in D8/the brief does not exist anywhere in the worktree; authored the seed from the vault's `current-plan.md` v4 + the DoD spec instead. Reported to coordinator.

## ✅ B3 — Seed Block II — DONE (2026-09-20)

Commit: `2d08df7` (+ `10f324a` adds BLOCK_II_SEED.md to the worktree).
Built: reverse-engineered the seed parser grammar; authored supabase/seed/wiki/\*.md for Block II (7-day split); added a "Sets" column + parseSetScheme → warmupSets/workingSets/toFailure on ParsedBlock; syncGlobalBlocks writes the scheme columns in insert + idempotent diff.
Verify (coordinator re-ran): verify-block-ii-parse.ts 15/15; ralph GREEN. Parser edge-cases (en-dash, ×/x, `1 WU + 2×failure`, missing/garbage) all safe-default, no NaN to DB. Exactly one block (Push dips) seeds to_failure=true.
Roast (focused): CONVERGED — parseSetScheme correct, idempotency diff symmetric, to_failure seeding correct (no B1 regression), all 20 block names resolve.
⚠️ CONTENT-FIDELITY (coordinator finding, NOT code): Monday Rounds 1&2 dropped the chest slot; rounds modeled as single blocks vs the "3 muscle-slots, pick from bank per exercise" structure. Mechanism correct, content compressed → FUTURE_WORK; needs Marcus's review before relying on the seeded plan in-app.

## ✅ BUILD COMPLETE — 2026-09-20

Branch `redesign/block-ii-adjustable-sets`, 8 commits off main @edf2446. NOT merged.
Whole-build verify (coordinator): verify-set-scheme 15/15 · verify-schedule-validation 6/6 · verify-block-ii-parse 15/15 · verify-logger (existing regression) PASS · ralph-verify.sh GREEN (format/typecheck/lint/build). Each slice roast-converged; B1 took 2 ralph rounds (2 data-integrity must-fixes fixed).
NOT done here (needs live Supabase): `npm run seed` + headed logger/plan e2e UI drive. Migration 025 must be `supabase db push`ed before `gen types` (KNOWN_ISSUES / D14).
Out of scope (by design): mono reskin (design-led pass) · Creator-Program community (B4, post-Nov-16).
Run: from the worktree, `pnpm dev` (localhost:3000) after a `db push` + `npm run seed` against a Supabase project.

## ✅ B-flex — Flexible working sets (soft target, both ways) — DONE (2026-09-22)

Commits: `a8ed8eb` (slice) → `0bd9657` (verify-logger test migration) → this (roast fix).
Built (D16): `working_sets` is a soft TARGET, not an auto-complete cap. `isBlockComplete` now manual-only (completedBlockIds) for ALL block types; FailureProtocol renders warm-up + target working slots, then "+ Add working set" (W3, W4…) + "Complete block"; `getSetLabel` continues W-numbering past target; `hasLoggedWorkingSet` helper. to_failure stays a per-set toggle.
Verify (coordinator re-ran): verify-set-scheme + verify-logger + gate GREEN. Caught a regression the implementer's gate missed — verify-logger had 3 stale auto-complete assertions (ralph-verify doesn't run it); migrated them to the manual model (and the week-2 lockout is now structurally impossible).
Roast: 🟡 1 must-fix — "Complete block" was gated on the FULL target being met, trapping a weak-day user (soft upward only). FIXED: "Complete block" now shows once ≥1 working set is logged (`hasLoggedWorkingSet`, unit-tested) → soft target BOTH ways. Other 4 roast points CONVERGED (add-set index collision-safe, no stranded callers, signature safe, label off-by-one clean). Minor deferred: added-set default-failure-checkbox consistency; complete-while-add-form-open discards unsaved input.

---

# Mobile IA Rewire (redesign phase 2) — branch redesign/mobile-ia-wire

## Slice S0 — Nav + IA scaffold + owner-gate + shared primitives ✅

**Built:** 5-tab BottomTabBar (Today · Plan · Nutrition · Progress · Community; Library/Trends/History removed from nav; Fuel→Nutrition). Owner-gate: `src/lib/auth/owner.ts` (`isOwner`, env `OWNER_USER_IDS`, fail-closed) + `requireOwner.ts` server guard wired into `/library/**` (route-group layout), `/plan/edit`, `/plan/[day]/edit`. 6 shared primitives in `src/components/shared/` (FocalCard, MacroRangeBar, SetRow, SegmentedControl, StatCard, SessionRow) + barrel. Placeholders: `/community` (coming-soon), `/progress` (redirect→/history until S5). Pure `isTabActive` extracted to `src/lib/nav/tabs.ts`.
**Verified:** `verify-owner-gate.ts` (13 assertions, red→green), `verify-tab-active.ts` (12 assertions), `ralph-verify.sh` GREEN (format/typecheck/lint/build). Live-auth nav/gate Playwright deferred to Final e2e (no test-user creds mid-slice).
**Roast (Security + BugHunter/Maintainer + implied Scope):**

- MUST-FIX (implemented): BH-F2 nav filled stroke-only Lucide icons → removed `fill` (blob active state); BH-F1 MacroRangeBar's fill/color/band were 3 disjoint numbers w/ cosmetic 45/82 defaults → rewrote to DERIVE geometry+state from real `current`/`rangeMin`/`rangeMax` (no cosmetic band defaults); BH-F3 SessionRow had href but no onClick → made it a client component w/ `onClick` for in-place sheet taps.
- DEFERRED (logged D24/D25 + KNOWN_ISSUES): SEC-F1/F2 owner-gate is UI-only; authoring mutations run client-side under per-user RLS so a non-owner can write their OWN silo (not a cross-user breach, not a regression, no followers this build) — data-boundary enforcement lands with the community/admin-hub build. SEC-F3 → adopt `(owner)/` route group at S6.
- Solid (per Security): `requireOwner` uses `getUser()` (verified JWT, not spoofable session), fail-closes; library route-group coverage is structural.
  **Decisions added:** D24, D25.

## Slice S1 — Today (rebuilt + wired) ✅

**Built:** `/today` recomposed to the /demo TodayScreen — focal black Start card (FocalCard), "Also today" quiet list (SessionRow), nutrition glance (MacroRangeBar range-fill), numbered week strip. Data flow UNCHANGED (getTodaySessions, buildMacroBars, sumMealTotals reused); presentational rewire only. New: TodayFocalCard, TodayAlsoList, types.ts. Deleted orphaned TodaySessionCard/List.
**Verified:** ralph-verify GREEN. Live-authed visual deferred to Final e2e.
**Roast (Bug Hunter + design-fidelity, 2 focused reviewers):**

- MUST-FIX (fixed): BH1 nutrition glance painted authoritative color but positioned fill from range MIDPOINT → could contradict (e.g. [0,400] renders center-green); fixed by adding RANGE fill (currentMin/currentMax span) to MacroRangeBar + TodayFuelCard feeds [totalMin,totalMax]+state. BH3 completed focal lift = dead card → now Links to detail ("✓ Completed — View session"). DF1 header title text-3xl out-sized the focal card → text-xl font-bold.
- SHOULD-FIX (fixed): BH2 2nd lift lost Start affordance → "Also today" lift rows route to /log/[id] + show completion. DF2 rows too loud → quiet one-line (SessionRow `quiet` prop, detail as faint trailing). DF3 SessionRow needlessly client → reverted to server-safe; S3's in-place tap will be a separate SessionRowButton.
- Verified-correct: start behavior preserved (actionHref=/log/[id]); null workoutId N/A (non-null PK); buildWeekDates correct across month/DST; tokens clean.
  **Primitive seam updates:** MacroRangeBar +currentMin/currentMax (range fill, 3 modes). SessionRow → server-safe + `quiet`, onClick removed (moved to future SessionRowButton for S3).

## Slice S2 — Logger (FLAGSHIP, rebuilt + wired) ✅

**Built:** logger recomposed to /demo LoggerScreen — top bar (End + sync pill), whole-workout block progress bar, "Block n/total · name", exercise pick (block+bank) + Swap, stacked set rows, BIG entry pad (weight/reps steppers + collapsible note + failure toggle + Log Wn), flexible actions (+Add working set / Complete block). Single-block focus (vs all-blocks scroll) per /demo. State machine UNCHANGED — recompose only. D16 flexible scheme + append-only + PR + offline sync + resume + end-early all preserved.
**Verified:** verify-set-scheme + verify-logger GREEN (with new assertions), ralph-verify GREEN. Live logger drive deferred to Final e2e.
**Roast (FULL council: Bug Hunter + Architect/Maintainer + Test-Skeptic):**

- 🔴 SHIP-BLOCKER (fixed): BH-F1 single-block subtree was UNKEYED → React reused FailureProtocol/SetEntryForm instance across blocks → unsaved weight/reps leaked into the next block's pad → phantom set could log against the WRONG exercise. Fixed: `key={currentBlock.block_id}` (LoggerShell:438). Also fixed free-form auto-open + stale "Saving…".
- MUST-ADD-TEST (added): TS-F1 last-block finish (findLastIncompleteBlock all-complete populated → -1) was untested (only empty-array). Added + green.
- SHOULD-FIX (fixed): Arch-F1 two divergent row styles → SetLogRow restyled to match shared SetRow/demo (w-16 sans label, text-lg, ✓ on done, inline PR▲; kept Failure badge+notes; dropped dead `exercise` prop). Arch-F3 entry-pad drift → Notes gated behind "+ note", scale tokens. BH-F3/Arch-F2 → deleted orphaned BlockHeader, hoisted formatBlockType to workout-state.ts. TS-F2/F3 → extracted nextAddedSetIndex + getSchemeActions pure helpers + tests (guards offline set_index + D16 weak-day).
- ACCEPTED BY DESIGN: BH-F2 single-block focus loses mid-workout scroll-back to earlier blocks — the /demo LoggerScreen Marcus approved IS single-block; summary shows all. Not changed.
- Verified-correct by council: advanceToNextBlock reaches every block + last-block finishes (no advance-past-end); progress-bar derivation correct (no off-by-one, out-of-order-complete colors right); D16 gating intact (never auto-locks, weak-day preserved).
  **Note:** PRBadge.tsx now orphaned (was only used by SetLogRow) — left in place, harmless; delete later if desired.
  **Helpers added:** nextAddedSetIndex(block), getSchemeActions(block)→{showAdd,showComplete}, formatBlockType(blockType).

## Slice S3 — Nutrition (rebuilt + wired, + manual log) ✅

**Built:** `/nutrition` recomposed to /demo NutritionScreen — calorie headline (totalMin–max / target range + status badge), P/C/F MacroRangeBars, meal log (SessionRowButton tap→edit), 3-way log flow (Snap/Describe/Manual). Manual path reuses existing logMeal → auto-derives calories (P×4+C×4+F×9), no AI call. New client SessionRowButton (sibling to server SessionRow). Data layer reused unchanged.
**Verified:** ralph-verify GREEN. Live-authed (log a real meal, real estimator) deferred to Final e2e.
**Roast (Bug Hunter + Maintainer/fidelity):**

- MUST-FIX (fixed): F1 MacroRangeBar range-mode rendered ZERO-WIDTH fill for exact-logged meals (min==max, the common case) → macro bars showed nothing on BOTH Today + Nutrition (regression from S1's range-fill). Fixed: left-anchored 0→currentMax progress fill (matches /demo), state authoritative. F2 meal row with a note LOST its P/C/F macros (`note ?? macros`) → now shows both.
- SHOULD-FIX (fixed): focus-nudge stole focus mid-typing + iOS file-picker-in-timeout risk → guarded (no snap auto-click, describe/manual focus only if nothing focused); deleted genuinely-orphaned DayTypeFrameworkCard (implementer's "still used" was false); extracted shared SessionRowInner for SessionRow/SessionRowButton (had drifted: overflow-hidden mismatch).
- Verified-correct: manual→logMeal→auto-derived calories estimator-free; Snap/Describe unchanged; delete reachable via sheet footer; no-targets fallback safe.
- DEFERRED: consolidate MacroProgressBar (nutrition/history/[date]) → MacroRangeBar — FUTURE_WORK.
  **Seam:** MacroRangeBar fill = left-anchored 0→currentMax (fixes Today too). SessionRowButton (client) + SessionRowInner (shared presentational).

## Slice S4 — Plan (rebuilt + wired, + selector) ✅

**Built:** `/plan` recomposed to /demo PlanScreen — plan selector (PlanSelector client, reuses existing activatePlan mutation → router.refresh, re-drives Today via is_active), week as 7 typed day cards (plan-dots.ts: lift=accent, cond=cardio-teal, rest=border, priority-ordered), view-only + dashed desktop-authoring note. No authoring affordances surfaced on mobile. Subscribed plans omitted (D21 — no backend; not fabricated). New: PlanSelector, plan-dots.ts (+ verify-plan-dots.ts).
**Verified:** verify-plan-dots GREEN, ralph-verify GREEN. Live switch→Today deferred to Final e2e.
**Roast (Bug Hunter + Maintainer/fidelity, 1 combined):**

- MUST-FIX (fixed): F1 D18 defeated via day route — `/plan/[day]` still showed an Edit pencil, and since Marcus IS owner the gate passed on mobile → authoring reachable. Fixed: day-detail Edit made desktop-only (`hidden md:inline-flex`); route stays owner-gated for deep links.
- SHOULD-FIX (fixed): F3 scheduleless "Open day" cards linked to a route that notFound()s → now non-navigable (Link only when openable = isRestDay || sessions>0).
- DEFERRED (logged KNOWN_ISSUES + FUTURE_WORK #14): F2 activatePlan non-atomic (2 writes, no txn) → partial failure leaves zero active plans; pre-existing, rare, self-healing on retry; proper fix = transactional RPC.
- Verified-correct: plan-dots pure/priority-ordered; PlanSelector guards double-submit, no-op same-plan, surfaces errors; activatePlan flips old active off on happy path. "sport"/warning dot unreachable = acceptable (no schema value; basketball=cardio).
  **Note:** PlanControls.tsx orphaned — kept for the future desktop hub (D18).

## Slice S5 — Progress (merge Trends + History → 3-segment tab) ✅
**Built:** `/progress` replaces the S0 redirect placeholder — SegmentedControl (Overview · Trends · History), server-first (all segments server-rendered, hidden-toggled, no refetch). Overview = 3 StatCards (workouts/PRs/streak) + featured e1rm chart + Recent timeline (PRs ▲ / sessions ✓ via SessionRow). Trends = full E1rmSection + WeeklyVolume + Bodyweight + NutritionTrend. History = PR timeline + all-workouts. Old /trends + /history → redirect("/progress"); deep-link detail routes preserved. New: overview.ts (deriveOverviewStats + buildRecentTimeline pure helpers), verify-progress-overview.ts, ProgressSegments/RecentTimeline/ProgressShowAllToggle.
**Verified:** verify-progress-overview + verify-tab-active + ralph-verify GREEN. Live-authed visual deferred to Final e2e.
**Roast (FULL council: Bug Hunter + Maintainer/fidelity + Test-Skeptic):**
- MUST-FIX (fixed): BH-F1 isCounted counted ended_early (abandoned) sessions → streak + workouts-this-month over-counted (comment said "genuinely-completed" but code only excluded in_progress). Fixed: count `complete` only (set-count not in projection w/o a query change, D17); comment matches; ended_early fixtures added.
- SHOULD-FIX (fixed): BH-F2/TS-F2 a set earning weight+rep PR counted as 2 (two pr_history rows) → deduped by set_log_id for count + Recent (one entry per PR-earning set) + test. Fidelity-F1 Overview was a 6-section dumping ground vs "calm glanceable" → restructured to 3 tight segments (Overview glance / Trends charts / History); nothing dropped. BH-F3 deep-detail back links → /progress?view=history (were bouncing to Overview w/ a lying "Back to PR timeline"); /history/workouts index → redirect. Maint-F3 deleted 3 orphans (TrendsSectionChips, HistoryHeaderLink, PRTimelineShowAllToggle); moved 6 re-homed sections into progress/_components.
- Verified-correct: redirect topology (no loop, deep links resolve), server-first toggle (no unmount/refetch), streak core math DST/tz-safe.
- FLAG for Marcus: middle segment renamed "By exercise" → "Trends" (now holds all charts); /demo mockup still shows old label (static artifact). allWorkoutsHref now dead (minor).

## Slice S6 — Community placeholder + /admin stub + Settings reskin ✅
**Built:** Community = honest coming-soon placeholder (storefront/feed shell in light/Satoshi; disabled Subscribe + "Soon" pills; Marcus's real Block II previewed w/ "Free during beta"; coaching-inquiry "Soon" row; feed marked Example; NO fabricated live counts). New `(owner)/` route group (D25 partial) with `layout.tsx` → requireOwner() gating `/admin` structurally; `/admin` = scope stub (program CRUD + publish/archive + the 8-tile analytics, refs spec/ADMIN_HUB_ANALYTICS.md). Settings reskinned to primitives, kept functional (goal/targets/profile/sign-out), owner-only section (Admin hub + Exercise library) gated by isOwner. Added build-log.md + CHANGELOG.md to .prettierignore.
**Verified:** verify-owner-gate (16 assertions, +3 structural), verify-tab-active, ralph-verify GREEN.
**Roast (Security + Bug Hunter + Maintainer, 1 combined):** fundamentally sound — no security hole, no regression, no honesty violation. Fixes: F1 Community blanket aria-hidden hid informative roadmap from screen readers → scoped to decorative skeletons only; F2 owner-gate test matched requireOwner via regex over source (a commented-out guard still passed — false confidence) → strip comments first (proven to fail on `// await requireOwner()`); F3 /admin "desktop surface" copy softened for mobile.
- Verified-correct: (owner) layout guard uses getUser() (verified JWT), fail-closes, dynamic-rendered (no static bypass), /admin stays at /admin; Settings keeps all real settings for every user + only ADDS owner section; Community honest.
**D25:** partially adopted — /admin under (owner) group; /plan/edit stays per-page-guarded + desktop-hidden (URL-move risk). Remainder deferred.
