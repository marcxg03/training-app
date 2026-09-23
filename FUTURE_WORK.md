# Future Work — Block II / Adjustable-Sets redesign

## Content (Marcus's review)

1. ✅ **DONE (2026-09-21) — Seed content fidelity.** Re-authored so every named movement is present and faithfully modeled: Monday Upper = 9 blocks (3 rounds × back/chest/shoulder, **chest restored**); Tuesday **Back/Glute Extension restored**; Friday **SA-cable pulldown/pullover + face-pull restored** (6 blocks). Tests assert the counts + chest presence. Sunday ATG kept as a 3-block mobility circuit (all 6 movements present in the banks — a circuit, not per-slot). Remaining judgment for Marcus: whether the invented _secondary_ bank options (alternate exercises) match his intent — tweak in-app via the Library editor.
2. **Steady-state cardio + Monday plyos/track** live only in the "Running Sessions" section, not the weekly schedule as sessions — add them as sessions if you want them to appear/log in-app.
3. **Doc-sync.** The vault's human `current-plan.md` v4 diverges in format from the seed's parser grammar. Keep the two content-synced (a converter, or align the formats).

## Engineering (follow-ups)

4. `parsePlanFromWiki` hardcodes `name: "Marcus Hybrid HYROX v3.0"` — rename to "Block II".
5. Migration 025 must be `supabase db push`ed BEFORE any `supabase gen types` regen (else the 3 scheme columns get wiped → NaN auto-complete lockout). See KNOWN_ISSUES.md (D14).
6. Block editor: flipping block_type off 'failure' leaves an inert `to_failure=true` (harmless — gated by block_type==='failure'); reconcile on flip if the block-type control is exposed in the reskin.
7. E2E: `npm run seed` + a headed Playwright drive of the logger (2-working-set block + legacy 3-set) and the plan editor (no-rest-day save) were not run (no local Supabase in the build). Run against a staging Supabase.

## Deliberately out of scope this run (separate work)

8. **Minimalist-mono reskin** — design-led `frontend-engineer` pass (D3/D7). The BlockForm scheme inputs B1 added are functional/unstyled and want the reskin's treatment.
9. **Creator-Program community layer** (B4) — held to post-Nov-16 (D1/D2/D7). Spec is REDESIGN_BRIEF §0 §8-REVISED.

## Feature requests (folded in for later)

11. **1-on-1 coaching inquiry button (Community).** A lead-capture entry point in the Community/Discover surface — "Train 1-on-1 with Marcus · inquire to apply" → a simple inquiry form (name/goals/contact) that notifies Marcus; he follows up off-platform. This is a **funnel, not a CRM** — it deliberately does NOT resurrect the rejected coach→client management model (D1/D2). Designed as a de-emphasized "Soon" placeholder in `/demo` CommunityScreen 2026-09-22. Build: an `inquiries` table (or email/webhook), the form sheet, and an admin/notify path. Monetization tier above the self-serve subscription. Requested by Marcus 2026-09-22.

12. **Persist the AI-estimator photo + description with the logged meal.** When a meal is logged via the AI calorie estimator (photo capture OR text description → macro pre-fill, `src/app/api/estimate-macros/route.ts`), currently only the resulting macros are saved. Also save the **source photo** (→ Supabase Storage, store the path/URL on the meal) and the **description text** (new column) on the `meal_entries` row, so a logged meal keeps its evidence — viewable/editable later and useful for re-estimation. Touches: `meal_entries` schema (add `photo_path text` + `source_description text`, additive migration), the log-meal mutation (`src/lib/nutrition/mutations.ts` logMeal/updateMeal), the log-meal sheet UI (pass the photo/description through), and a Storage bucket + RLS for the images. Requested by Marcus 2026-09-22.

13. **Consolidate the two macro-bar components.** `MacroRangeBar` (Today + Nutrition tab, hardened in S3 with a left-anchored 0→currentMax fill + authoritative state) and `MacroProgressBar` (nutrition/history/[date]/page.tsx) encode the same target-band+intake concept with different rules (scale headroom 1.25x vs 1.15x; status chrome). Consolidate onto MacroRangeBar (add the status pill as an opt-in prop) and delete MacroProgressBar so the tab + its history detail render identically. Roast S3 finding. 2026-09-23.
