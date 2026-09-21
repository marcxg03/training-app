# Future Work — Block II / Adjustable-Sets redesign

## Content (Marcus's review — highest)

1. **Seed content fidelity.** The B3 seed captured the mechanism (schemes, 7 days, to-failure) but compressed the plan: Monday Upper Rounds 1 & 2 lost the **chest** slot (handwriting = back·chest·shoulders per round), and each "round" is one block rather than the 3 muscle-slots your "choose from the bank per exercise" structure implies. Re-author `supabase/seed/wiki/current-plan.md` faithfully (3 blocks per round; chest included) — or refine in-app via the Library editor.
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
