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
