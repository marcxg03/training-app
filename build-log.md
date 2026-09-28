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

## Final pass — whole-app e2e + integration roast + fixes ✅
**Live authed e2e (throwaway user, scoped — Marcus's data untouched):** seeded a confirmed user + injected SSR cookies (no email) + seeded 108 set_logs/80 meals/targets. Drove all tabs desktop+mobile. RESULT: auth ✓, Today ✓ (focal card dominant, visible macro fills), Nutrition ✓ (calorie headline + visible P/C/F fills + 3 log buttons), Plan ✓ (selector + typed dots, no mobile Edit), Community ✓ (placeholder), Settings ✓, Logger ✓ — **logged a real set (135lb×8 → weight_kg 61.235, PR detected, persisted with completion_id, W1 pad unlocked, SYNCED); full write path works, zero console errors, all routes 200**. Test user cleaned up (0 residual rows).
**Live bug found + FIXED:** 🔴 Progress Overview/Trends/History segments didn't switch — `hidden` attribute on a `.flex` element (Tailwind `.flex` beats Preflight `[hidden]{display:none}`) → all 3 rendered stacked. Fixed: conditional class `active===seg ? "flex" : "hidden"` (inactive has no competing flex → display:none wins).
**Integration roast (cross-slice, whole diff main..HEAD): no must-fix.** 4 should-fixes, all FIXED:
- Nutrition drill-downs (history/[date], history list, targets) still used pre-redesign MacroProgressBar → reskinned to MacroRangeBar + the mobile shell; **MacroProgressBar DELETED** (resolves FUTURE_WORK #13).
- Community + Settings skipped the `max-w-md` mobile column → wrapped (progress got `w-full` too).
- plan/[day] Edit pencil hidden only by breakpoint (non-owner saw a dead-end 404 link) → gated on `isOwner` + desktop.
- Deleted 3 orphans: PRBadge, PlanControls, allWorkoutsHref.
**Verified:** all 7 verify scripts + ralph-verify GREEN.

# ✅ BUILD COMPLETE — Mobile IA Rewire (redesign phase 2)
All 7 slices (S0–S6) + final pass shipped on `redesign/mobile-ia-wire`. The /demo designs are the live 5-tab mobile app (Today · Plan · Nutrition · Progress · Community), wired end-to-end to the existing Supabase backend, verified on the live authenticated app via a throwaway user (auth + all tabs + the full logger write path). 12 roast rounds across the build; 1 ship-blocker (S2 unkeyed subtree → wrong-exercise set write) + 1 live bug (Progress segments) caught pre-merge. Authoring is owner-only/desktop (open seam: `(owner)/admin` stub); Community is a navigable placeholder. Deferred + logged: owner-only DATA-layer enforcement (D24), activatePlan atomicity (KNOWN_ISSUES), the admin hub + full Community (next build, analytics spec at spec/ADMIN_HUB_ANALYTICS.md). Run: `pnpm dev -p 3111`. NOT merged to main — pending Marcus's review.

## Validation round 1 — Marcus's real-use feedback (Tier 1 fixes) ✅
Marcus validated the mobile MVP on the preview and returned feedback. Tier 1 (quick fixes) applied:
- **Nutrition: one "Log meal" button.** The 3 entry buttons (Snap/Describe/Manual) collapsed to a single primary button — the sheet already holds all three input paths (Photo · Description+AI · "Or enter macros yourself"). Removed the dead `intent` plumbing + on-open focus nudge.
- **Goal mode BUG — root cause: a dead control.** The Cut/Maintain/Lean-bulk segments on the Targets screen were `<span>` elements styled identically to the real control elsewhere — no onClick, no mutation. The only working setter was on the less-discoverable Settings→Profile. Fixed: real `<button aria-pressed>` + a genuinely-missing `updateGoalMode()` setter in settings/mutations.ts, saved with the screen's Save button, persists across reload, drives dayTypeFramework. Secondary bug fixed: ProfileForm rendered updateProfile's partial-save WARNING through the red danger `submitError` path, so a successful goal-mode save looked like a failure.
- **PR colors: weight = blue (#2563EB), rep = violet (#7C3AED).** Tokens `--pr-weight`/`--pr-rep` in globals.css + tailwind. One `src/lib/methodology/pr-colors.ts` map keyed by pr_type_enum (weight | in_range_rep) drives every PR surface: logger inline pill, PRTypeBadge, Progress PR timeline, Recent feed, WorkoutSummary, workout detail. Labels unified to "Weight PR"/"Rep PR". The future per-exercise PR graph reads its legend from this map.
- **Photo control: camera-first + library option (Marcus's call).** Two hidden inputs — the primary Photo button carries `capture="environment"` (straight to rear camera), plus a "Choose an existing photo" affordance without `capture` for the library picker.
**Verified:** 13 verify scripts (2 new: verify-goal-mode, verify-pr-colors) + ralph-verify GREEN. Pushed to PR #3 for live re-validation.
**Decisions locked this round:** body-tracking logs AND displays in Progress (not Settings); PR colors blue/violet; compound list for e1RM = Bench, Incline, OHP, Back Squat, Deadlift variants, Rows, Weighted Dips, Weighted Pull-up, Lat Pulldown; exercise catalog = clean-license (yuhonas/free-exercise-db, public domain, carries mechanic/force tags) with media as a PLUGGABLE field so Marcus can sub in his own filmed clips per exercise later.
**Dataset finding:** hasaneyldrm/exercises-dataset has real per-exercise GIFs but the media is © Gym Visual (data is MIT) — not redistributable, which conflicts with the paid-community roadmap. Hence the clean-license choice.

## Slice T2-A — Exercise catalog + compound data + pluggable media ✅
**Built:** migration `026_exercise_media.sql` (additive: `media_path`, `media_type` CHECK image|gif|video, `source_slug` — all nullable, NOT applied to prod yet). Pure matcher `src/lib/methodology/compound-classification.ts` (`isCompoundExerciseName`, deny-rules-first: 42 isolation rules evaluated before 17 D28 compound rules). `scripts/classify-compounds.ts` (dry-run default, `--apply`, `--user` REQUIRED, per-row scoped writes). `scripts/enrich-exercises.ts` (fetch+cache yuhonas/free-exercise-db (Unlicense), name-match Marcus's EXISTING exercises only, propose source_slug/is_compound/media_path, vendor matched images to public/exercises/ same-origin per D27).
**THE REAL e1RM BUG FOUND:** `buildE1rmSpotlights` gated correctly all along, but `history/exercises/[exercise_id]/page.tsx` `buildChartConfig` branched on `is_bodyweight` ONLY — so every isolation (lateral raise, pushdown, curl) rendered an "Estimated 1RM · progression" chart one tap from the PR timeline. That is very likely what Marcus saw. Fixed: threaded `is_compound` through ExerciseProgression → getExerciseProgression → page; non-bodyweight non-compound now renders the existing reps-progression ("Best reps · progression", REPS axis) + a one-line note pointing at the Library compound toggle.
**Verified:** verify-compound-classification RED→GREEN (108 assertions / 42 compound + 46 isolation fixtures, all real Block II names, incl. deny-first traps: Pallof Press, Decline Bench Curl, Straight Arm Pulldown, Upright Row, Triceps Dip → isolation). 14 verify scripts + ralph-verify GREEN.
**Matcher hardening:** plain Dice@0.6 produced real false positives against the live 876-entry catalog (Seated Cable Row→Cable Seated Crunch, SA Cable Kneeling Pulldown→Single-Arm Cable Crossover, BB Romanian Deadlift→Barbell Deadlift). Now uses singular stemming + IDF weighting + a head-noun gate; <0.75 flagged ⚑review. 12 exact + 35 fuzzy + 19 unmatched on 66 real Block II names.
**PENDING Marcus go-ahead (prod ops):** push migration 026, then `classify-compounds.ts --user <id> --apply`, then `enrich-exercises.ts --user <id> --apply` (~2.6 MB of vendored images committed to public/exercises/).
**Open for Marcus:** the Weight-PR / Best-in-range StatCards still render for isolations (they show REAL logged PRs, not estimates — left alone deliberately). Judgment calls inside D28 flagged for confirmation.

### T2-A prod operations — APPLIED 2026-09-23 (Marcus go-ahead)
- **Migration 026 pushed to prod** (rluvohfnnbsqoouyjeww): `exercises.media_path`, `media_type`, `source_slug` — additive, nullable.
- **Matcher flips per Marcus:** Single Leg BB Squat, Good Morning, Pullover → COMPOUND (were isolation). Split squat / Bulgarian / Jefferson stay isolation.
- **Matcher MISSES caught by the dry-run (fixed before applying):** Hack Squat, Incline Smith, Incline Smith Machine, Seated Machine Press, Muscle Ups were all being demoted to isolation because the rules required the literal word "press". Broadened incline→bare `incline`, added smith / machine press / hack squat / muscle-up rules (deny-first keeps Incline DB Curl etc. safe). Changes dropped 17→12.
- **`classify-compounds --apply`:** 12 rows updated on Marcus's account (4→compound: DB Pullover, Full ROM Pull Ups, Seated Good Mornings, SL DB RDL; 8→isolation: shrugs ×2, High-to-Low Cable Fly, Pec Deck, Straight-Arm Cable Pulldown, Tricep Dip Machine, **Hip Thrust Machine, Leg Press**). 83 exercises total, 36 compound after.
  - ⚠ **Flagged to Marcus:** Hip Thrust Machine + Leg Press are multi-joint but absent from D28, so his own rule ("everything else = isolation") demoted them. One toggle in the Library restores e1RM if he disagrees.
- **`enrich-exercises --min-score 0.65 --apply`:** 47 rows enriched, 43 images vendored to `public/exercises/` (2.9 MB), same-origin per D27.
  - Threshold raised from the 0.6 default after reviewing all 17 ⚑ low-confidence matches — **Low Back Extensions → "Low Cable Triceps Extension" (0.61) was a completely wrong body part.** 0.65 drops that + the 3 other weakest; the good fuzzy matches (Single Leg BB Squat→One Leg Barbell Squat 0.73, DB Pullover→Bent-Arm DB Pullover 0.69, SL DB RDL→Romanian Deadlift 0.67) are kept.
  - Approximate media Marcus may want to swap first (D27 makes it a one-file drop): Weighted Dips→Weighted_Bench_Dip, Skull Crushers→Band_Skull_Crusher, Incline BB Press→Incline Dumbbell Press, Cable Lat Pulldown→One Arm Lat Pulldown.
  - 32 exercises unmatched (no media) — expected; his own footage fills these.

## Slice T2-B — Kill e1RM · PR history chart · exercise images ✅
**Built:** (1) **Estimated 1RM DELETED** (D31) — removed `epleyE1rmKg`, `buildBestE1rmByDay`, `buildE1rmSpotlights`, `E1rmSection`, the detail-page e1RM branch + its T2-A is_compound gate (now moot), and all e1RM copy (0 UI files mention it). `is_compound` stays as Library metadata. −583 lines. (2) **`PRHistoryChart`** — SVG, no new dep, dual-axis: weight PRs (blue, LEFT, kg→lbs at the display boundary) + rep PRs (violet, RIGHT), independent axis domains so reps don't collapse to the floor, shared x so same-set PRs align. Placed on the exercise detail page, Progress→Trends (top 4), Progress→Overview featured slot. Colors/geometry from `pr-colors.ts` (single source of truth). No new query — reuses `getExerciseProgression` + `getPRTimeline`. (3) **Exercise images** — `ExerciseImage` (plain `<img>`, lazy, explicit dims, same-origin) in the logger's ExercisePicker (56px thumb) + exercise detail (full-width); returns null when `media_path` is null → no broken icon, no layout jump. Media columns added additively to the bank/logger/progression selects. (4) **3 wrong catalog images re-pointed** on prod: Barbell Bench Press→Barbell_Bench_Press_-_Medium_Grip (was Decline), Cable Lat Pulldown→Wide-Grip (was One_Arm), Cable Pushdown→Triceps_Pushdown (was Cable_Incline).
**NEW — permanent browser harness (D32):** `e2e/harness/` (session/assert/runner/console/shoot/env + README). `startSession()` boots the dev server, seeds a throwaway `@trainingapp.test` user + data, injects Supabase SSR cookies, returns a Playwright page; `stop()` always cleans up. Hard-gated so it can never touch Marcus's account. Also added `e2e/_setup/seed-pr-history.mjs` — the existing analytics seed creates NO PRs/completions, so PR surfaces were unreachable.
**Browser drive `e2e/drive-t2b.mjs` — 11/11 PASS** (after a fix, below): e1RM absent from all 3 Progress segments + detail; **segments actually switch** (visibility-asserted, the regression class that bit S5); PR chart renders 2 series / 9 dots / 0 NaN; media-less exercise degrades with no broken image; vendored `/exercises/*.jpg` served 200; an exercise WITH media renders it; **logger e2e — Today→pick from bank→log 135×9→reload→persisted (DB-confirmed)**; desktop pass. Zero console errors.
**🔴 BUG THE DRIVE CAUGHT (static gates were all green):** with exactly ONE weight PR + ONE rep PR at the same instant — **the first state every newly-PR'd exercise enters** — both dots landed on the identical coordinate (160,69) and violet painted over blue, so the user saw ONE dot while the legend promised two series. Fixed by marker differentiation (weight = larger outer mark r4.5, rep = inner r2.2, each with a `stroke-card` halo) + `seriesInPaintOrder()` sorting by radius DESC so paint order can never silently re-hide a series. Verified at device-pixel level (blue ring → gap → violet core) and mutation-tested: reverting the radii fails check 7 + 7 unit assertions.
**Verified:** 15 verify scripts + ralph-verify GREEN; drive 11/11; cleanup confirmed (0 residual test users, Marcus's 166 set_logs / 143 pr_history intact).

## Slice T2-C — Body area: bodyweight logging + progress photos ✅ (code complete; prod ops PENDING)
**Where it lives (D29):** a new **Body** area inside Progress → Trends, holding `BodyweightSection` (weight) + `ProgressPhotosSection` (photos). Progress → Overview deliberately gets neither — it stays the glance. Settings stays config-only. One `.eyebrow` ("Body") heads two `text-sm font-medium` sub-headings ("Bodyweight", "Photos"), the same two-level idiom NutritionTrendSection already uses; the first cut stacked two identical eyebrows and read as noise.

**Bodyweight — extended, not rebuilt.** `logBodyweight()` and `getBodyweightTrend()` are untouched (signature included); the inline quick-log that already existed gained an **optional date** behind a calendar toggle (blank = today, `max` = today, validated by the new pure `src/lib/bodyweight/log-date.ts::normalizeLogDate` — lexical ISO comparison, never `new Date()`). Units unchanged: **lbs in/out, kg stored**, `lbsToKg` at the mutation boundary, `toLbsChartPoints` at the chart boundary.
**Defect the date field would have introduced:** `logBodyweight` points `profiles.bodyweight_kg` at whatever it just wrote — correct for today, wrong the moment a user fills in last Tuesday's missed weigh-in, which would silently regress every surface reading "current weight". Fixed additively with `syncCurrentBodyweight()` (re-derives current from the newest log), called only on a back-dated save. Drive check 4 is the regression test.

**Progress photos — net new.** Migration `027_progress_photos.sql`: table (photo_id/user_id/storage_path/taken_on/note/created_at, `(user_id, taken_on DESC)` index, unique index on storage_path so bytes can't be double-referenced), **RLS enabled** with owner-scoped select/insert/delete in the 016/021 house style (no UPDATE — a photo is immutable), **plus** the private `progress-photos` Storage bucket (`public=false`, 15 MB limit, jpeg/png/webp only) and three `storage.objects` policies matching `(storage.foldername(name))[1] = auth.uid()::text`. Both halves are idempotent; the bucket SQL is in the migration because `supabase db push` runs nothing else.
- `src/lib/progress-photos/paths.ts` — bucket id, accepted types, `buildStoragePath` (`<user_id>/<uuid>.<ext>`, **throws** on a traversal-y or unsupported input rather than returning a wrong prefix), `validatePhotoFile`, `SIGNED_URL_TTL_SECONDS` (1 h).
- `queries.ts` (server) — reads the rows then **signs the URLs server-side** under the user's own session; returns `available:false` on PGRST205/42P01 so Progress cannot 500 in the deploy-before-migration window (same contract as 021).
- `mutations.ts` (browser) — `MutationResult` + `translateMutationError`, copied from the bodyweight/nutrition pattern. Upload order is **bytes first, row second**, with a compensating `storage.remove` if the insert fails: an orphan object is invisible and cheap, an orphan row is a permanently broken thumbnail. Delete is **object first, row second**, for the mirror reason.
- `compress.ts` — best-effort canvas downscale to a 1600px long edge / JPEG 0.82 above 600 KB; returns the ORIGINAL on any failure, so compression can never be why a photo doesn't save. Pure `targetDimensions` (never returns a 0 or NaN dimension — `canvas.width = 0` throws).
- UI: camera-first `capture="environment"` + a "Choose an existing photo" fallback (mirrors LogMealSheet), a month-grouped reverse-chronological thumbnail grid, a lightbox, and a two-dialog delete-with-confirm (the MealsSection pattern). Calm empty state; a named migration notice when 027 is absent.

**Verified:** `scripts/verify-progress-photos.ts` (NEW, written test-first — 82 assertions: path building + traversal refusal, mime/extension mapping, upload validation + error copy, signed-URL TTL bounds, month/day grouping asserted to never touch `Date`, downscale arithmetic, back-date normalization incl. leap years and the exact future boundary). **16 verify scripts + ralph-verify GREEN.**

**Browser drive `e2e/drive-t2c.mjs` — 7 PASS / 5 SKIP, 0 FAIL.** Passing: the Body area renders and Overview has neither control; the photo section degrades to a named notice instead of 500ing; log a weight → chart updates → **reload** → persisted → kg confirmed in the DB; back-date → own row AND current weight preserved; desktop 1280×900 holds. The drive **PROBES** for the table + bucket and SKIPs the three photo checks (upload/reload/signed-URL-loads, client-side downscale, delete-removes-row-AND-object) with the reason recorded — see below. It also cleans up its own Storage objects, which do NOT cascade with the auth user.
**Two self-inflicted drive bugs found and fixed:** (1) a `text=/Bodyweight\s+183\s*lbs/` locator can never match — the label and number are sibling elements, so the reading has to come off the section's `innerText`; (2) navigating immediately after clicking Log cancelled the in-flight profile re-sync, so the drive "caught" its own race. Both now wait on the form's own "Saving…" → "Log" transition.

**⚠️ WHAT COULD NOT BE DRIVEN, AND WHY:** the three photo checks need `progress_photos` + the `progress-photos` bucket to exist. This slice is not permitted to apply either to the live project, and `supabase start` needs Docker, which is not installed on this machine (no docker/colima/podman/orbstack, no local postgres). So **the photo upload, signed-URL render, client-side compression, and delete paths have never executed against a real database or Storage.** Re-run `node e2e/drive-t2c.mjs` unchanged after 027 is pushed — the probe flips and all five SKIPs become real checks.

**PENDING Marcus go-ahead (prod ops):** `supabase db push` (applies 027 incl. the bucket + storage policies), then re-run the drive. `src/lib/supabase/types.ts` carries a HAND-EDITED `progress_photos` block (same stopgap as 026) — 027 must be pushed before any `supabase gen types` regen.

## Slice T2-C — Bodyweight logging + Progress photos ✅
**Built:** a **"Body" area inside Progress → Trends** (D29 — log where you see the trend; Overview stays a tight glance, drive-asserted).
- **Bodyweight:** reused `logBodyweight`/`getBodyweightTrend` UNCHANGED (lbs typed → `lbsToKg` → kg stored → `kgToLbs` at the chart). Added a quick log control (weight + optional date). **Defect caught while building:** `logBodyweight` also sets `profiles.bodyweight_kg`, so back-dating would have made last week's number "current" — fixed additively with `syncCurrentBodyweight()`, called only on a back-dated save (drive check 4 is its regression test).
- **Progress photos (new):** migration `027_progress_photos.sql` — table + owner-scoped RLS (select/insert/delete on `auth.uid() = user_id`; **no UPDATE** — a photo is immutable) + a **PRIVATE** Storage bucket (`public=false`, 15MB limit, jpeg/png/webp) with storage policies keyed on `(storage.foldername(name))[1] = auth.uid()::text`, so the path prefix IS the authorization. `buildStoragePath` throws on anything that could restructure that key. Server-side signed URLs (bucket is private). Camera-first capture + "choose an existing photo" fallback (mirrors the nutrition sheet), client-side downscale, month-grouped timeline, lightbox, delete (removes the Storage object AND the row).
**PROD:** migration 027 pushed to `rluvohfnnbsqoouyjeww` (table + RLS + private bucket + storage policies).
**Browser drive `e2e/drive-t2c.mjs` — 12/12 PASS** (first run was 7 PASS / 5 SKIP — upload, signed-URL render, compression and delete were unrunnable until 027 existed; the drive PROBED and skipped rather than faking, then all five flipped green after the push): Body area renders + Overview has neither control · photo empty state · log weight → chart updates → reload → persists → DB kg confirmed · back-date keeps today as current weight · **upload → thumbnail → reload → the signed URL really loads (`naturalWidth>0`)** · large photo downscaled client-side · **delete → gone from timeline AND from Storage** · desktop 1280×900 · cleanup (Storage objects + test user removed). Zero console errors.
**Screenshots reviewed:** BODY → Bodyweight 183 LBS +12 lbs + trend chart → input/date/LOG → Photos (month-grouped thumb) → camera-first ADD PHOTO + "Choose an existing photo" + "Private to your account." The implementer also caught + fixed its own first-pass design error (two identical stacked `.eyebrow` labels flattening the hierarchy) and literal backticks bleeding into user copy.
**Verified:** 16 verify scripts (new `verify-progress-photos.ts`, 82 assertions) + ralph-verify GREEN; drive 12/12; Marcus's account untouched.

# ✅ TIER 2 COMPLETE
T2-A (exercise catalog + compound data + pluggable media) · T2-B (e1RM deleted → PR history chart + exercise images) · T2-C (bodyweight + progress photos). Migrations 026 + 027 live on prod. Branch `tier2/exercise-catalog-progress`, NOT merged — pending Marcus's review.

## Slice T2-D — Validation round 2 (Marcus's real-use feedback) ✅
1. **PR chart SPLIT into two single-axis charts** (Marcus: "confusing on one graph and the scaling might be off" — he's right, dual-axis charts mislead). "Weight PRs" (blue, lbs) + "Rep PRs" (violet, reps), stacked, each with its own value axis AND its own time domain. Both panels always render; the absent type shows its own empty state rather than vanishing. **This deleted the whole coincident-marker problem** — the bullseye radii/paint-ordering from T2-B existed only to keep two marks readable on one canvas, so `pr-colors.ts` lost its 4 per-type geometry fields (now shared constants) and gained `chartTitle`/`chartEmptyText`. Obsolete assertions in verify-pr-history-chart / verify-pr-colors / verify-charts / drive-t2b were REPLACED with a two-chart contract, not deleted.
2. **Progress → Trends reordered:** Body → Fuel → PR History → Training Load (was PR → Load → Body → Fuel). Overview untouched.
3. **Logger: Exit ≠ End.** New `‹ Exit` Link → `/today` that writes NOTHING (session stays in progress, resume picks it up). `✕ End workout` moved right, in `text-danger`, behavior byte-for-byte unchanged. Drive proves they differ: Exit leaves `completed_at` null; End writes it.
4. **Logger: change exercise within a block** — chose option (a), swap allowed even after logging, behind a confirm that names both exercises and states plainly that logged sets stay under the old one (append-only; nothing rewritten/deleted). Logged rows show "Logged under <old exercise>" when they no longer match. **Real bug found doing this:** `getSelectedExerciseIdForBlock` derived from `setLogs[0]`, so a reload after a swap snapped back to the ABANDONED exercise — now derives from the latest set by `set_index`. Option (b) was rejected because realising an exercise is bad usually happens after the first set, exactly when (b) locks you out.
**Browser drives — 33/33:** `drive-t2d.mjs` **10/10** (Trends order by painted Y + DOM order · two charts w/ independent scales, no NaN · weight-only case · swap before sets → attributed to B in DB · swap after sets → confirm names both, Cancel is a no-op · **Exit → completed_at still null, set intact** · re-entry resumes the right block + swapped exercise · **End → completed_at written** · desktop), plus regressions `drive-t2b` **11/11** and `drive-t2c` **12/12**. Zero console errors across all three.
**Verified:** 16 verify scripts + ralph-verify GREEN. Screenshots reviewed (two clearly separate charts; Exit grey-left vs End red-right).
**⚠ Flagged for Marcus:** `PR_SPOTLIGHT_LIMIT` is still 4, so Trends → PR history is now ~2× taller (4 exercises × 2 charts = 8 canvases). Deliberately not changed silently — it's a product call, and it works against the scannability the reorder was for.

## Slice T2-E — PR-history selector + purge the polluted `notes` field ✅
Two fixes from Marcus using the app.

**1. Trends → PR history = a SELECTOR over ONE exercise (D33).** Marcus: *"maybe we can do a selector to select which exercise to surface and only surface one - so you can select which exercise and see trends."* This closes the flag T2-D handed forward (4 exercises × 2 charts = 8 canvases, an endless scroll that defeated the scannability the reorder was for). `PRHistorySection` kept the **Overview** featured slot exactly as it was; the card itself was extracted to `PRSpotlightCard` so both surfaces render one thing two ways. New client component `PRHistoryBrowser` holds the selection and nothing else — the server still builds **every** selectable exercise's chart model with `buildPRSpotlights` and passes them all down, so switching re-renders and never refetches. `PR_SPOTLIGHT_LIMIT` 4 → **12** (it is now a menu length, not a page length). **UX call:** a native token-styled `<select>` rather than the shared `SegmentedControl` — the option list is DATA, and a dozen equal-width pills either overflow 390px or compress to slivers, while the OS picker is the best one-handed long list a phone has. **Exactly one card is mounted** (not all-mounted-with-`hidden`): the card is pure props, so there is nothing to preserve across a switch, and a chart that was never rendered cannot be mistaken for a visible one — the `hidden`-attribute-vs-`.flex`-utility bug class is structurally absent here. Also moved the section's explainer INSIDE the section: above the heading it read as a caption for the Fuel chart it followed.

**2. Purged the `notes` pollution — data AND the parser that caused it (D34).** 39 of 83 exercises rendered `"Compound\nCompound\nCompound"` under their name in the logger's picker. **Root cause is two defects, both fixed:** (a) the plan's TYPE column reaching a free-text field — `extractExerciseNotesMap` now drops a Notes cell that is nothing but a type word, at the point of reading, so no downstream merge can resurrect it; (b) **two** merge points that concatenated without de-duplicating — `methodology-rules.ts` (per-block, no equality guard at all) and `seed-from-wiki.ts` `collectExercises` (a whole-value `!==` guard that still appended a third copy to an already-stuttered value). Both now use `mergeExerciseNotes`. The pure predicate `isTypeOnlyNote` lives in `src/lib/methodology/exercise-notes.ts` and is **strict by design**: only a note whose every non-empty line is exactly a type word is clearable, because the false positive DELETES a real note and the false negative merely leaves a tidy-up undone. Marcus's traps — `"Compound — PR"`, `"Isolation (ATG day)"`, `"Lower Compound day"` — are fixtures, and they are kept.
**Coordinator runs (Marcus's account, in this order):**
```
pnpm exec tsx --env-file=.env.local scripts/clean-exercise-notes.ts --user 04d5d1d4-939a-432f-937e-3f17aad2388a
pnpm exec tsx --env-file=.env.local scripts/clean-exercise-notes.ts --user 04d5d1d4-939a-432f-937e-3f17aad2388a --apply
```
Expect ≈ 39 CLEAR / 26 KEEP / 18 EMPTY; the dry-run prints every KEPT note that mentions a type word so the traps can be eyeballed before anything is written. Re-running `--apply` is a no-op.

**Verified:** `scripts/verify-exercise-notes.ts` (NEW, 62 assertions — the junk corpus, the must-keep corpus incl. every trap, the empty tier, every declared type word, and `mergeExerciseNotes` incl. idempotence). Proven to bite: mutating `every`→`some` in the predicate turns 3 checks red. `scripts/verify-block-ii-parse.ts` gained the two re-seed guards, proven RED→GREEN by appending a `| Lat Pulldown | Compound |` row to the seed markdown and disabling only the call-site fix. `scripts/verify-pr-history-chart.ts` gained the wide-limit/no-empty-option spotlight assertions. **17 verify scripts + ralph-verify GREEN.**

**Browser drives — 19/19.** `e2e/drive-t2e.mjs` **9/9**: exactly 2 painted canvases and 1 exercise name in the section (not 8) · the selector lists all 3 seeded exercises, and selecting another **swaps the rendered charts** — asserted on the chart aria-labels, the card headline, mark counts and the axis-range headers (`"E2E Bench Press" 176–204 LBS → "E2E Row" 154–182 LBS`), never on the control's own value · 390px with `scrollWidth === clientWidth` and a 342×44px tap target, re-checked after switching to a longer name · **4a RED:** a seeded `"Compound\nCompound\nCompound"` row renders the junk in the picker (a cleanup check that starts clean proves nothing) · **4b:** the real cleaner's dry-run reports 1 CLEAR / 1 KEEP and writes nothing · **4c GREEN:** `--apply` clears only the junk, the picker shows no note for it, `"Lats / Teres Major"` survives, and a second `--apply` is a no-op · desktop 1280×900 · Overview still featured-only with no control. Regression `drive-t2d.mjs` **10/10**. Zero console errors in both.
**Drive bug found and fixed on its first run:** `expectVisible` resolves `.first()`, and "Strength · PR history" now exists in BOTH Overview and Trends — so the bare selector matched Overview's correctly-hidden copy and timed out. Narrowed to `:visible`; documented in the harness README alongside a new warning that `pnpm build` / `ralph-verify` must never run while a dev server holds `:3111` (it rewrites the `.next` the server is serving and the app comes back unstyled).
**Screenshots reviewed:** Trends now reads eyebrow → one-line explainer → `E2E Bench Press — 9 PRs` pill with chevron → headline `204 lbs · 8 reps · 9 PRS` → blue Weight PRs chart → violet Rep PRs chart → Training load. After the swap: same shape, `E2E Row`, `182 lbs`, weight axis `154–182 LBS`. Picker before: name + `BACK · 6–10` + `Compound Compound Compound`. After: the note line is gone and the card tightens up; the neighbouring row still reads `Lats / Teres Major`. Overview unchanged.
**Not committed** (per brief). Dev server left running on `:3111`.

## Slice T2-E — PR-history exercise selector + purge polluted notes ✅
1. **PR history: one exercise at a time, selectable.** Trends rendered 4 exercises × 2 charts = 8 canvases (an endless scroll that defeated the reorder's purpose). Now a native token-styled `<select>` (chosen over SegmentedControl: a dozen exercise NAMES are data, not fixed segments — pills either overflow 390px or compress to slivers; a native select opens the OS picker, can't overflow, is AT-correct for free; measured 342×44) offering up to 12 exercises with PR history, ranked most-PRs-first so it opens on his most-active lift. Only the SELECTED card renders (not all-mounted-with-hidden) — the `hidden`-vs-`.flex` bug class is structurally absent rather than merely avoided. Overview's featured slot unchanged. `PR_SPOTLIGHT_LIMIT` 4 → 12.
2. **Purged the "Compound Compound Compound" notes.** Root cause was TWO defects: (a) the seed parser read the plan's TYPE column ("Compound"/"Isolation") into the free-text `notes` field — that belongs to `is_compound` (D28), and (b) two merge points concatenated per-round notes with NO de-duplication (`methodology-rules.ts` had no equality guard at all; `seed-from-wiki.ts` had a whole-value `!==` guard that still appended a third copy to an already-stuttered value). One-word cell × 3 rounds = `Compound\nCompound\nCompound`. Fixed at the source (drop type-only notes at read + `mergeExerciseNotes` de-dupe at both merge points), guarded by 2 re-seed assertions in `verify-block-ii-parse.ts` (proven RED→GREEN by appending a `| Lat Pulldown | Compound |` row to the seed markdown). Data cleaned via `scripts/clean-exercise-notes.ts` with a pure `isTypeOnlyNote()` predicate (62 assertions) that clears ONLY notes whose every line is a bare type word.
**PROD:** cleaner applied to Marcus's account — **39 cleared / 26 kept / 18 already empty**. The 8 trap cases that MENTION a type word but carry real information were correctly preserved: "Compound — PR", "Isolation (ATG day)", "Lower Compound day", "Compound — retest current baseline", "Isolation — ATG day only", etc.
**Browser drive `e2e/drive-t2e.mjs` — 9/9 PASS** + `drive-t2d` **10/10** regression (19/19, zero console errors): exactly ONE exercise's 2 charts render (not 8) · selector swaps the rendered charts (asserted on content, not control state) · 390px no horizontal overflow (`scrollWidth == clientWidth`) · RED-then-GREEN on the junk note (reproduced "Compound Compound Compound" on screen, cleaned, verified the real note survived and a re-run is a no-op) · Overview still selector-free · desktop.
**Verified:** 17 verify scripts + ralph-verify GREEN. Mutation-tested: flipping `every`→`some` in `isTypeOnlyNote` turns 3 trap checks red.
