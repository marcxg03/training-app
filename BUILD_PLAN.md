# BUILD_PLAN — Block II / Adjustable-Sets redesign

**Branch:** `redesign/block-ii-adjustable-sets` (worktree `../training-app-redesign`). Base: `main` @ edf2446. Do NOT merge to main without Marcus's explicit ok.

**Spec source:** `spec/REDESIGN_BRIEF.md` §0 (2026-09-20 update) + `spec/BLOCK_II_SEED.md`. Ledger: `DECISIONS.md` (D1–D9). Log: `build-log.md`.

**Stack:** Next.js 15 + TS strict + Supabase + Tailwind/shadcn PWA. Server-first data flow; pure methodology modules; append-only set_logs/pr_history (wiring contract §9 — do not break).

**Test convention (repo idiom, NOT a new framework):** there is no vitest/jest. Test-first = write a bespoke `scripts/verify-<x>.ts` (run with `pnpm exec tsx`) that asserts the pure logic and fails first; for UI, a headed Playwright script in `e2e/*.mjs` following the existing pattern. The de-facto build gate is `scripts/ralph-verify.sh` (format → typecheck → lint → build) — every slice must pass it.

---

## Slice order & dependencies

`B1 (scheme model) → B2 (cut validation) → B3 (seed Block II)`. B1 before B3 (B3 seeds schemes). B2 before B3 (Block II has no rest day → must not be hard-blocked).

---

## SLICE B1 — Adjustable set-scheme per block

**Delivers:** each block carries its own set-scheme instead of the hardcoded WU+W1+W2 / auto-complete-after-3. A "failure" block can be `2 working sets`, `2 × failure`, `1 WU + 2 working`, etc.

**Approach (additive, back-compat):**

- **Migration** `025_block_set_scheme.sql`: add to `blocks` — `warmup_sets int NOT NULL DEFAULT 1`, `working_sets int NOT NULL DEFAULT 2`, `to_failure bool NOT NULL DEFAULT false` (with a CHECK that they're ≥0 / working_sets ≥1 for lifting). Defaults reproduce today's behavior (1+2 = 3 total). Cardio/recovery blocks (block_type NULL) unaffected.
- Regenerate/extend `src/lib/supabase/types.ts` for the new columns.
- `src/lib/methodology/workout-state.ts`: extend `LoggerBlock` with `warmupSets`, `workingSets`, `toFailure` (or a `scheme` object). Replace `isBlockComplete`'s hardcoded `>= 3` with `>= (warmupSets + workingSets)` for scheme-driven blocks. Keep the `mobility`/`corrective` explicit-complete path.
- `src/components/log/FailureProtocol.tsx`: build `failureSteps` dynamically from the block scheme (N warm-ups labelled WU/WU2…, then working sets W1..Wm; the _last_ working set carries the failure checkbox only if `toFailure`). Remove the hardcoded 3-step array.
- `src/components/log/LoggerShell.tsx`: derive set-role labels from scheme, not the hardcoded `["WU","W1","W2"]`.
- Thread the scheme through the block projection that builds `LoggerBlock` (find the query that assembles logger blocks — likely `src/lib/methodology/*` or `src/lib/log/*`; the implementer must locate and report it as a seam).

**Definition of done:** a block with `{warmup_sets:0, working_sets:2, to_failure:true}` shows exactly 2 set slots, the 2nd carrying the failure checkbox, and auto-completes after 2 sets; a legacy block with defaults still shows WU/W1/W2 and completes after 3. `ralph-verify.sh` green. A `scripts/verify-set-scheme.ts` asserts `isBlockComplete` against ≥3 scheme configs (written failing first).

**Verify:** run `scripts/verify-set-scheme.ts` (red→green); `scripts/ralph-verify.sh`; headed Playwright drive of the logger for a 2-working-set block + a legacy 3-set block (screenshot desktop+mobile), confirming set counts + auto-complete + persistence on reload.

**Touches:** `supabase/migrations/025_block_set_scheme.sql` (new), `src/lib/supabase/types.ts`, `src/lib/methodology/workout-state.ts`, `src/components/log/FailureProtocol.tsx`, `src/components/log/LoggerShell.tsx`, the logger-block projection query (locate), `scripts/verify-set-scheme.ts` (new). **Off-limits:** set_logs schema (append-only), weight_kg storage, mutation signatures, nutrition/library/PR modules.

---

## SLICE B2 — Simplify: cut the validation guardrails

**Delivers:** the plan/day editor no longer hard-blocks on methodology rules; guardrails are removed or off-by-default. Unblocks seeding a no-rest-day plan.

**Approach:**

- `src/lib/methodology/plan-schedule.ts`: make `weekRestDayError` non-blocking — either remove it or downgrade the min-rest-day rule to a soft warning (so `validateSchedule` returns `hardErrors: []` by default). Keep the soft cardio-order warning as an _informational_ warning (Marcus can ignore; it never blocked). Preserve the `ScheduleValidation`/`validateSchedule` signatures so `DayEditForm` keeps compiling.
- `src/app/(app)/plan/[day]/_components/DayEditForm.tsx`: with no hard errors, `blocked` is always false; keep the soft-warning "Save anyway" affordance but ensure a clean save path. Simplify copy.
- Seed methodology rules `supabase/seed/lib/methodology-rules.ts`: downgrade the HARD violations (48h recovery, push/pull balance, min-rest-day, missing-muscle) to soft warnings (they already don't block runtime, but Block II should seed without scary "hardViolations" output). Keep them as informational warnings in the seed summary.
- Preserve the _unrelated_ guards in `plan/mutations.ts` (no-remove-logged-session, blocks-frozen lock) — those are data-integrity, NOT methodology guardrails. Do not touch them.

**Definition of done:** a 7-day plan with zero rest days saves in the editor with no hard block, and seeds without any `hardViolations`. `ralph-verify.sh` green. `scripts/verify-schedule-validation.ts` asserts `validateSchedule({isRestDay, workouts, otherDaysHaveRest:false}).hardErrors` is empty for the no-rest case (written failing first against current behavior).

**Verify:** `scripts/verify-schedule-validation.ts` (red→green); `ralph-verify.sh`; headed Playwright: open a day editor, remove the last rest day, confirm Save is not blocked.

**Touches:** `src/lib/methodology/plan-schedule.ts`, `src/app/(app)/plan/[day]/_components/DayEditForm.tsx`, `supabase/seed/lib/methodology-rules.ts`, `scripts/verify-schedule-validation.ts` (new). **Off-limits:** `plan/mutations.ts` integrity guards, logger, nutrition.

---

## SLICE B3 — Seed Block II as the active plan

**Delivers:** Marcus's Block II (from `spec/BLOCK_II_SEED.md`) is the active plan, with per-block schemes, banks, and the 7-day split.

**Approach:**

- Author `supabase/seed/wiki/current-plan.md` in the exact format `parsePlanFromWiki` expects (study the parser in `supabase/seed/lib/methodology-rules.ts` + the existing `supabase/seed/wiki/current-plan.md` for the grammar). Represent Block II: 7 days, the lifting blocks with banks, cardio/recovery activities, the 2-working-set schemes (Thu dips = to_failure). If the parser can't express per-block scheme, extend `TrainingPlanSpec`/the parser + `syncGlobalBlocks` to write the new B1 scheme columns.
- Update `syncGlobalBlocks` (and parser types) so schemes seed into the `blocks` columns from B1.
- Keep idempotency (the sync diffing) intact.

**Definition of done:** `npm run seed` against a test user produces the Block II plan — 7 days, correct blocks/banks, schemes seeded (Thu dips to_failure, others 2 working sets), no hardViolations. The app's Plan tab renders Block II; the logger shows the right set counts per block.

**Verify:** run the seed against a throwaway user (follow `e2e/_setup` patterns); an `e2e/verify-block-ii.mjs` that loads the plan and asserts day count, a spot-check of Monday Upper's 3 rounds + Thursday dips scheme. `ralph-verify.sh` green. Screenshot the Plan tab.

**Touches:** `supabase/seed/wiki/current-plan.md`, `supabase/seed/lib/methodology-rules.ts` (parser + types if needed), `supabase/seed/seed-from-wiki.ts` (`syncGlobalBlocks` scheme write), `e2e/verify-block-ii.mjs` (new). **Off-limits:** runtime app logic beyond what B1 established.

---

## Final pass

Whole-build verify (seed → open app → drive logger end-to-end on a Block II session), final `/roast-code` over the full diff, triage + ralph to convergence, then present integration options (recommend: PR for Marcus's review, do NOT auto-merge to main).
