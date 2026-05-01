# SLICE_4_5_LBS_KG_FIX.md

## 1. Goal

Correct the display unit mismatch where weights are entered as lbs but stored as kg, by introducing a UnitFormatter utility, converting at form input/output boundaries, and backfilling existing mis-stored historical data via migration 012.

## 2. Acceptance Criteria

1. New utility module `src/lib/units/index.ts` exports `KG_PER_LB`, `LB_PER_KG`, `lbsToKg(lbs: number): number`, `kgToLbs(kg: number): number`, `formatWeight(kg: number): string`, and `DISPLAY_UNIT: 'lbs'` constant.
2. `lbsToKg` rounds output to 3 decimal places. `kgToLbs` returns unrounded number; rounding happens in `formatWeight`.
3. `formatWeight(kg)` returns a string of the form `"235 lbs"` (whole-number lbs, no decimals, space before unit).
4. `formatWeight(0)` returns the string `"Bodyweight"` (handles bodyweight rendering at the formatter level, not the component level).
5. SetEntryForm input field labeled `WEIGHT (LBS)` instead of `WEIGHT (KG)`. Input accepts numeric values with up to 1 decimal place.
6. SetEntryForm save handler converts entered lbs to kg via `lbsToKg()` before writing `weight_kg` to set_logs.
7. SetLogRow read-only display uses `formatWeight(weight_kg)` to render every weight value.
8. Session summary screen Volume tile renders total volume as `formatWeight(totalKg)` (single conversion of the summed kg value, displayed as whole-number lbs).
9. PR detection logic in `src/lib/methodology/pr-detection.ts` continues to operate on raw `weight_kg` values without modification — no conversion logic in detection.
10. Migration 012 corrects existing mis-stored data: multiplies `set_logs.weight_kg` and `pr_history.weight_kg` by 0.45359237 for all rows logged/achieved before the migration's literal timestamp.
11. Migration 012 is idempotent by construction: it uses a literal timestamp guard (Supabase migration tracker prevents re-application; the timestamp filter prevents accidental ad-hoc re-runs from affecting Slice 4.5+ data).
12. Storage column type change: `set_logs.weight_kg` and `pr_history.weight_kg` migrate from `numeric` (whatever default) to `numeric(7,3)`. If the columns are already `numeric(7,3)` or compatible, this is a no-op.
13. After migration: Bench 235 (Slice 2 seed PR) reads back as `formatWeight(106.594)` = `"235 lbs"`. OHP 185 → `"185 lbs"`. Deadlift 435 → `"435 lbs"`.
14. After migration: Slice 4 testing data (Cable Lat Pulldown 135, 210 lbs sets that were stored as 135 kg, 210 kg) reads back as `"135 lbs"`, `"210 lbs"`.
15. No display anywhere in the app shows kg. The Plan tab does not render weights and is unaffected. History and Nutrition are placeholders and unaffected.

## 3. Files to Create or Modify

**Create:**
- `src/lib/units/index.ts` — UnitFormatter utility module with conversion + format functions
- `supabase/migrations/012_correct_weight_unit_storage.sql` — backfill migration

**Modify:**
- `src/components/log/SetEntryForm.tsx` — change label to `WEIGHT (LBS)`, convert input via `lbsToKg()` before write, restrict input to 1 decimal place
- `src/components/log/SetLogRow.tsx` — use `formatWeight(weight_kg)` for every weight display
- `src/components/log/SessionSummary.tsx` — use `formatWeight(totalKg)` for Volume tile
- `src/lib/supabase/types.ts` — regenerate after migration 012 applies (column type change to `numeric(7,3)`)

**Untouched:**
- `src/lib/methodology/pr-detection.ts` — operates on raw kg, no changes
- `src/lib/methodology/session-state.ts` — no weight handling, no changes
- All Plan tab components — render rep ranges, not weights
- All `app/(app)/today/` and `app/(app)/log/[session_id]/page.tsx` server components — no inline weight rendering, only pass data to display components

## 4. Component / Function Contracts

```ts
// src/lib/units/index.ts

export const KG_PER_LB = 0.45359237;
export const LB_PER_KG = 2.20462262;
export const DISPLAY_UNIT: 'lbs' = 'lbs';

/**
 * Convert lbs to kg. Output rounded to 3 decimal places for storage.
 * @param lbs — must be >= 0
 * @returns kg value, rounded to 3 decimals
 */
export function lbsToKg(lbs: number): number;

/**
 * Convert kg to lbs. Returns unrounded number — caller decides display rounding.
 * @param kg — must be >= 0
 * @returns lbs value, unrounded
 */
export function kgToLbs(kg: number): number;

/**
 * Format a kg value for display. Returns "Bodyweight" if kg === 0,
 * otherwise returns whole-number lbs followed by " lbs" (e.g., "235 lbs").
 * @param kg — the canonical-storage kg value
 * @returns display string
 */
export function formatWeight(kg: number): string;
```

## 5. Edge Cases to Handle

1. `formatWeight(0)` → `"Bodyweight"` — bodyweight handling at formatter level, not component level. SetLogRow and SessionSummary do not need a conditional check.
2. `formatWeight(NaN)` or `formatWeight(undefined)` should not crash — return `"—"` or empty string. Defensive against bad data.
3. SetEntryForm input restricted to 1 decimal place via input validation. Two decimals is rejected with the existing inline error pattern.
4. Existing Slice 4 testing rows that were genuinely bodyweight (Muscle Ups sets with `weight_kg = 0`) must NOT be modified by migration 012. The `WHERE weight_kg > 0` guard in the migration handles this.
5. Three Slice 2 seeded PRs in pr_history must be corrected: Bench 235, OHP 185, Deadlift 435. Verified by direct query before/after.
6. Migration 012's literal timestamp is locked at `'2026-05-01 16:30:00+00'`. Use this exact value in the WHERE clause guards. It is the cutoff for "rows logged before Slice 4.5 applies"; any rows with `logged_at` or `achieved_at` >= this timestamp are assumed to already be in correct kg storage and are skipped by the backfill.
7. PR detection idempotency: after migration 012, re-running PR detection against the corrected weight_kg values should NOT create duplicate pr_history rows. The (set_log_id, pr_type) UNIQUE constraint handles this. Verify with Test 7.

## 6. Test Cases

1. Unit test or REPL check: `lbsToKg(235)` returns `106.594`. `kgToLbs(106.594)` returns approximately `234.998619...`. `formatWeight(106.594)` returns `"235 lbs"`.
2. Unit test or REPL check: `formatWeight(0)` returns `"Bodyweight"`. `formatWeight(NaN)` returns `"—"`.
3. Migration 012 applies cleanly to remote. SQL Editor query before: `SELECT weight_kg FROM pr_history WHERE exercise_name LIKE '%Bench%'` returns ~235. After migration: returns ~106.594.
4. Logger SetEntryForm displays `WEIGHT (LBS)` label. User enters 135, saves. Database row in set_logs has `weight_kg ≈ 61.235`.
5. SetLogRow renders the just-saved row as `"135 lbs × N reps"` (or similar — N is whatever reps were entered).
6. Resume the session, scroll to the just-saved row. Display still shows `"135 lbs × N reps"` after reload.
7. Re-run PR detection on a corrected pr_history row by re-saving an equivalent set_log. UNIQUE constraint prevents duplicate; pr_history row count unchanged.
8. Session summary screen Volume tile shows whole-number lbs (e.g., `"4250 lbs"`) for a session with mixed weighted and bodyweight sets. Bodyweight sets contribute 0 to the total.
9. End-to-end: log a fresh Pull session with Cable Lat Pulldown WU 135 lbs × 12, W1 210 lbs × 8. Verify both display as expected, both write correct kg values to DB, PR detection fires correctly on the W1 (which should be a Type A or B PR if Slice 2 PRs are correctly converted to true kg).
10. Confirm no display anywhere shows "kg". Walk Today, Logger, summary screens. Grep the codebase for `kg` as a user-visible string and confirm the only matches are in code (variable names, the `weight_kg` column reference) and not in JSX.

## 7. Codex Generation Prompt

CONTEXT:
training-app — personal-first PWA for training methodology, Next.js 15 App Router + TypeScript strict + Supabase + pnpm. Slice 4 (Workout Logger) shipped at commit 7a64f91. Slice 4.5 corrects a representation gap: weights are entered by the user as lbs but stored in weight_kg column, causing all displayed values to be wrong. This slice introduces a UnitFormatter utility, converts at form input/output boundaries, and backfills existing data via migration 012.

TASK:
Implement Slice 4.5 per /spec/slices/SLICE_4_5_LBS_KG_FIX.md. Create the UnitFormatter utility, modify the three Logger components that display or accept weights, write the backfill migration, and regenerate Supabase types after the migration applies.

FILES TO CREATE:

src/lib/units/index.ts — UnitFormatter utility module exporting KG_PER_LB, LB_PER_KG, DISPLAY_UNIT, lbsToKg, kgToLbs, formatWeight per Section 4 of the slice doc
supabase/migrations/012_correct_weight_unit_storage.sql — UPDATE statements for set_logs and pr_history multiplying weight_kg by 0.45359237 with WHERE clauses guarding by weight_kg > 0 AND <date_column> < '2026-05-01 16:30:00+00'. Use this exact literal ISO timestamp — it is the locked cutoff for "rows logged before Slice 4.5 applies." Also alter columns to numeric(7,3) if not already.

FILES TO MODIFY:

src/components/log/SetEntryForm.tsx — change label to WEIGHT (LBS), restrict input to 1 decimal, convert input via lbsToKg before writing weight_kg
src/components/log/SetLogRow.tsx — replace any inline weight rendering with formatWeight(weight_kg)
src/components/log/SessionSummary.tsx — replace Volume tile inline rendering with formatWeight(totalKg)
src/lib/supabase/types.ts — regenerate after migration 012 applies (run pnpm gen:types or equivalent; if no script exists, use the Supabase CLI directly)

CONSTRAINTS:

Storage column remains weight_kg (canonical kg storage). Do NOT rename.
All weight display goes through formatWeight() — no inline ${value} kg or ${value} lbs template strings anywhere in JSX.
Bodyweight rendering ("Bodyweight" string) must come from formatWeight(0) — do NOT add component-level conditionals like weight_kg === 0 ? 'Bodyweight' : ....
PR detection logic in src/lib/methodology/pr-detection.ts is UNTOUCHED. It operates on raw kg.
Migration 012 must be idempotent. Use a WHERE clause with the locked literal timestamp `'2026-05-01 16:30:00+00'` (cutoff for "rows logged before Slice 4.5 applies"). Do not invent a different timestamp.
Form input validation: reject 2+ decimal places with the existing inline error pattern.
No new dependencies.

LIVE SCHEMA NOTES (echo back the columns you reference):

set_logs has: set_log_id (uuid pk), user_id (uuid), session_id (uuid), block_id (uuid), exercise_id (uuid), set_index (int), set_role (text: WU/W1/W2/free), weight_kg (numeric), reps (int), is_to_failure (bool), prescribed_min (int), prescribed_max (int), notes (text), logged_at (timestamptz)
pr_history has: pr_id (uuid pk), user_id (uuid), exercise_id (uuid), exercise_name (text — denormalized for display), pr_type (enum: weight, in_range_rep), weight_kg (numeric), reps (int), set_log_id (uuid nullable for seeded historical PRs), achieved_at (timestamptz)

ACCEPTANCE CRITERIA:

lbsToKg, kgToLbs, formatWeight all implemented per Section 4 contracts
formatWeight(0) returns "Bodyweight"; formatWeight(NaN) returns "—"
Migration 012 applies cleanly to remote, corrects all weight_kg values logged before its timestamp
SetEntryForm shows WEIGHT (LBS), accepts 1 decimal, converts on save
SetLogRow and SessionSummary use formatWeight() for every weight display
PR detection logic unchanged
All Slice 2 seed PRs (Bench 235, OHP 185, Deadlift 435) display correctly after migration
Slice 4 testing data displays correctly after migration
No string "kg" anywhere in user-visible JSX

DO NOT:

Modify files outside the list above
Rename weight_kg to weight_lbs or similar
Add features outside this slice's scope
Leave placeholder comments or TODOs
Skip the migration timestamp or substitute a different one — the locked value `'2026-05-01 16:30:00+00'` must be used verbatim

OUTPUT:
Write the complete implementation. Do not explain — just produce the code. At the end, list:

Every column name referenced (verify against schema notes above)
Confirm the literal timestamp used in migration 012 is `'2026-05-01 16:30:00+00'`
Any assumptions made
Whether you regenerated supabase/lib/types.ts or if that needs to happen separately after migration applies


## 8. Claude Code Quality Review Prompt

CONTEXT:
Slice 4.5 (Display Unit Correction) just generated by Codex. The slice introduces UnitFormatter, modifies 3 Logger components, and adds migration 012 to backfill existing mis-stored weight data.

FILES CODEX TOUCHED:

src/lib/units/index.ts (new)
supabase/migrations/012_correct_weight_unit_storage.sql (new)
src/components/log/SetEntryForm.tsx (modified)
src/components/log/SetLogRow.tsx (modified)
src/components/log/SessionSummary.tsx (modified)
src/lib/supabase/types.ts (regenerated, possibly)

REVIEW CHECKLIST:
Read every file in the list above and address, in order:

Naming consistency — KG_PER_LB and LB_PER_KG constants, function names, parameter names
Error handling — formatWeight(NaN), formatWeight(undefined), formatWeight(negative) — all handled?
Inline weight rendering — grep the modified files for any kg, lbs, or template literal that bypasses formatWeight(). Flag any found.
Migration 012 — does it have a literal timestamp or a placeholder? If placeholder, flag for user to replace before applying. Does the WHERE clause include weight_kg > 0 to skip bodyweight rows? Does it cover both set_logs AND pr_history?
Storage column type — did Codex alter set_logs.weight_kg and pr_history.weight_kg to numeric(7,3)? If they were already that type, no-op is fine.
PR detection — open src/lib/methodology/pr-detection.ts and confirm it was NOT modified.
Input validation — does SetEntryForm reject 2+ decimal places? Does it still preserve the existing "Enter at least 1 rep" and "Enter a weight or mark as bodyweight" validations?
Bodyweight handling — verify formatWeight(0) returns "Bodyweight" and that no component-level conditional exists for bodyweight rendering (the formatter handles it).
Display unit constant — DISPLAY_UNIT exported as 'lbs' typed as the literal string 'lbs', not just string.

AUTO-FIX vs FLAG:

Auto-fix: items 1, 2, 3, 7, 8, 9 when fix is local and unambiguous
Flag for approval: migration timestamp placeholder (item 4), column type change risk (item 5), any unexpected pr-detection modifications (item 6)

CONSTRAINTS:

Do not add new features
Do not change formatWeight() return format (whole-number lbs, " lbs" suffix) without flagging
Do not modify pr-detection.ts
Do not modify files outside the list above

OUTPUT:
Summary with four parts:

Files changed and why (one line each)
Items flagged for user approval (especially migration timestamp)
Any issues logged for KNOWN_ISSUES.md
Ready-for-testing verdict (yes / no — if no, what's blocking)


## 9. Claude Code Debugging Prompt

CONTEXT:
Slice 4.5 (Display Unit Correction) generated by Codex and reviewed by Claude Code. Migration 012 applied to remote.

CURRENT PROBLEM:
[Fill in: exact error or unexpected behavior. Examples: "Bench seeded PR displays as '516 lbs' after migration instead of '235 lbs'", "SetEntryForm crashes on submit with 'lbsToKg is not a function'", "SessionSummary Volume tile shows '0 lbs' for a session with weighted sets"]

RELEVANT FILES:

src/lib/units/index.ts
supabase/migrations/012_correct_weight_unit_storage.sql
src/components/log/SetEntryForm.tsx
src/components/log/SetLogRow.tsx
src/components/log/SessionSummary.tsx

WHAT CODEX BUILT / QUALITY REVIEW COVERED:
UnitFormatter with lbsToKg, kgToLbs, formatWeight; migration 012 backfilling pre-Slice-4.5 data; three Logger components updated to use formatWeight. Quality review pass verified no kg strings in JSX, migration WHERE clauses correct, formatWeight handles 0/NaN/undefined.

CONSTRAINTS:

Next.js 15 App Router + TypeScript strict
Do not refactor outside the current problem
Storage column stays weight_kg (canonical kg)
PR detection logic stays untouched

ACCEPTANCE CRITERIA:

Bench 235 (Slice 2 seeded PR) displays as "235 lbs"
SetEntryForm input "135" writes weight_kg ≈ 61.235 to DB
SetLogRow renders saved row as "135 lbs × N reps"
SessionSummary Volume tile shows whole-number lbs

DO NOT:

Rewrite working code
Modify pr-detection.ts
Add features outside the current fix
Change the slice's folder structure or contracts

OUTPUT:
Fix the problem. Summarize what was changed, why, and list follow-up issues for the next session.
