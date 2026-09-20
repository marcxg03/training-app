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
