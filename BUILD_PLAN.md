# BUILD_PLAN — Mobile IA Rewire (redesign phase 2)

**Branch:** `redesign/mobile-ia-wire`. Base: `main`. Do NOT merge to main without Marcus's explicit ok.

**Prior build (SHIPPED, on main):** Block II adjustable-sets + cut-validation + seed + light/Satoshi reskin (PR #2 @ 2254b3e). Its record is `build-log.md`; its decisions D1–D16 stay in `DECISIONS.md`.

**This build:** turn the approved `/demo` phone-frame designs into the real mobile app, wired end-to-end to the EXISTING Supabase backend, verified on the live authenticated app. The backend + data layers already exist (`src/lib/{plan,nutrition,library,history,analytics,methodology,sync}`); this is IA restructure + reskin-to-`/demo` + wiring, NOT new backend.

**Design source of truth:** `src/app/demo/page.tsx` (the 6 screens: Today, Logger, Nutrition, Plan, Progress, Community). Spec: `spec/DESIGN_SESSION_BRIEF.md` + `spec/REDESIGN_BRIEF.md`. Ledger: `DECISIONS.md` (D17–D23 govern this build). Admin-hub analytics input (future): `spec/ADMIN_HUB_ANALYTICS.md`.

**Stack / conventions:** Next.js 15 + TS strict + Supabase + Tailwind/shadcn PWA. Server-first (pages fetch → thin client components); pure methodology modules; **wiring contract (REDESIGN_BRIEF §9): set_logs/pr_history append-only, weight_kg storage, no renamed columns/enums/mutation signatures.**

**Test convention (repo idiom — no vitest/jest):** test-first = a bespoke `scripts/verify-<x>.ts` (`pnpm exec tsx`) for pure logic, or a headed Playwright drive in `e2e/*.mjs` for UI, written to fail first. The build gate every slice must pass is `scripts/ralph-verify.sh` (format → typecheck → lint → build). UI slices verify on the live app via a throwaway test user (`e2e/_setup` / `seed-auth.mjs` patterns), screenshotting desktop + mobile.

---

## New IA (D19)

Mobile bottom nav (5): **Today · Plan · Nutrition · Progress · Community**. Settings = gear (not a tab). Removed as tabs: **Library** (→ owner-only), **Trends** + **History** (→ merged into Progress). Authoring (Library builder, plan/day edit) = **owner-only** routes, the open seam for the desktop admin hub (D18).

---

## Slice order

`S0 (nav + IA scaffold + owner-gate + shared primitives) → S1 Today → S2 Logger → S3 Nutrition → S4 Plan → S5 Progress → S6 Community placeholder + /admin stub + Settings reskin + polish → Final (e2e + roast)`

S0 first (everyone depends on the nav + primitives). S2 (Logger) is the flagship — most care. S5 (Progress) is the riskiest (merges 3 surfaces).

---

## SLICE S0 — Nav + IA scaffold + owner-gate + shared design primitives

**Delivers:** the new 5-tab bottom nav live; removed tabs re-routed; an owner-gate helper; the reusable design primitives extracted from `/demo` so every later slice composes them.
**Approach:**

- Rewrite `src/components/layout/BottomTabBar.tsx` to the 5 tabs (Today · Plan · Nutrition · Progress · Community) with the `/demo` styling (active=accent, icon+label). Route `/community` to a placeholder page (S6 fills it). Keep `/settings` reachable via a gear (Today header or a nav overflow).
- **Owner-gate:** add `src/lib/auth/owner.ts` — `isOwner(userId)` checking an env-listed owner id(s) (`OWNER_USER_IDS`, server-only) OR a `profiles.is_owner` flag; pick the simpler (env list) and document. Add a server guard used by `/library/**`, `/plan/**/edit`, and the new `/admin`: non-owners get `notFound()` / redirect to `/today`.
- **Shared primitives** in `src/components/shared/` (or `ui/`): `FocalCard`, `MacroRangeBar`, `SetRow`, `SegmentedControl`, `StatCard`, `SessionRow` — lifted from `/demo`'s markup, tokenized, prop-driven. These replace the ad-hoc `/demo` copies and are what S1–S6 import.
  **DoD:** app builds and runs; bottom nav shows the 5 tabs and navigates; `/community` renders a placeholder; `/library` and `/plan/edit` return notFound for a non-owner test user and render for the owner; the 6 primitives exist with a `scripts/verify-owner-gate.ts` asserting `isOwner` (written failing first). `ralph-verify.sh` green.
  **Verify:** `verify-owner-gate.ts` (red→green); `ralph-verify.sh`; Playwright: nav renders 5 tabs (mobile), tapping each lands the right route; non-owner hitting `/library` is bounced.
  **Touches:** `src/components/layout/BottomTabBar.tsx`, `src/lib/auth/owner.ts` (new), `src/app/(app)/community/page.tsx` (new placeholder), guard wiring in `library`/`plan/edit` layouts or pages, `src/components/shared/*` (new), `scripts/verify-owner-gate.ts` (new). **Off-limits:** data-layer mutations, the wiring contract.

## SLICE S1 — Today (rebuilt + wired)

**Delivers:** `/today` as the `/demo` Today screen — focal black Start card, "Also today", nutrition glance, week strip — wired to the real today projection.
**Approach:** restyle `src/app/(app)/today/page.tsx` + its `today` components to compose `FocalCard`/`MacroRangeBar`/`SessionRow`. Keep the existing data source (`src/lib/methodology/today.ts`, nutrition summary). Start card → the primary lift session's Start Workout. Nutrition glance → real macro summary. Preserve rest-day empty state.
**DoD:** Today renders real sessions with the focal Start card dominant; Start launches the logger; macro glance shows real day totals; rest day shows the calm empty state. Matches `/demo`. `ralph-verify.sh` green.
**Verify:** Playwright on the live app (test user with Block II): screenshot desktop+mobile, confirm focal card + Start nav + macro values; rest-day case.
**Touches:** `src/app/(app)/today/**`, `src/components/today/**`. **Off-limits:** logger internals (S2), nutrition mutations.

## SLICE S2 — Logger (rebuilt + wired) — FLAGSHIP

**Delivers:** the `/demo` Logger — block progress bar, stacked logged sets with inline PR, big weight/reps entry pad, flexible scheme actions (+Add working set / Complete block), sync indicator — wired to the real logger (append-only set_logs, PR detection, offline queue).
**Approach:** restyle `src/app/(app)/log/[workout_id]/page.tsx` + `src/components/log/*` (LoggerShell, FailureProtocol, SetEntryForm, SetLogRow, PRBadge, QueueIndicator, ExercisePicker) to compose the new primitives. Preserve ALL existing behavior: block+bank pick, adjustable/flexible set-scheme (D16 — soft target, manual complete, +add set), to_failure per-set toggle, PR moments, resume, end-early, sync. The entry pad = the big steppers; the scheme actions row = the existing add-set + complete logic.
**DoD:** a real set logs and persists (reload); PR fires inline; +Add working set and Complete block both work per D16; offline queue indicator reflects real sync; block+bank swap works. Matches `/demo`. Append-only intact. `ralph-verify.sh` green.
**Verify:** headed Playwright drive on the live app: log WU + 2 working sets on a scheme block, add a 3rd, complete; log a legacy block; confirm persistence + PR + sync; screenshot desktop+mobile. (This is the flagship — exercise it hard.)
**Touches:** `src/app/(app)/log/**`, `src/components/log/**`. **Off-limits:** set_logs schema, weight_kg storage, PR-detection logic, mutation signatures (restyle only).

## SLICE S3 — Nutrition (rebuilt + wired, + manual log)

**Delivers:** `/nutrition` as the `/demo` Nutrition screen — calorie headline vs range + P/C/F range bars, meal log with photo thumbnails, the 3-way log flow (Snap / Describe / **Log manually**) — wired to real nutrition data + the AI estimator.
**Approach:** restyle `src/app/(app)/nutrition/page.tsx` + `_components` (DayTypeFrameworkCard, MacroProgressBar, MealsSection, LogMealSheet). The existing LogMealSheet already has photo + description → AI estimate; ADD an explicit **manual entry** path (enter P/C/F directly, calories auto-derive) as a first-class option alongside snap/describe. Photo thumbnails on logged meals if a photo exists (note: photo _persistence_ is FUTURE_WORK #10 — thumbnail shows when available; don't build the storage in this slice).
**DoD:** nutrition renders real macros as range-vs-range with the calorie headline; meal log lists real meals; Snap/Describe/Manual all reach a working log; a manually entered meal derives calories. Matches `/demo`. `ralph-verify.sh` green.
**Verify:** Playwright on live app: log a meal manually (P/C/F → calories), confirm it appears + macros update; screenshot desktop+mobile.
**Touches:** `src/app/(app)/nutrition/**`, `src/lib/nutrition/*` (only if manual-entry needs a mutation path — additive). **Off-limits:** the estimate-macros API contract, append-only rules.

## SLICE S4 — Plan (rebuilt + wired, + selector/switch-load)

**Delivers:** `/plan` as the `/demo` Plan screen — plan selector (switch/load among the user's plans + subscribed), the week as typed day cards, view-only with the desktop-authoring note — wired to real plan queries/mutations.
**Approach:** restyle `src/app/(app)/plan/page.tsx` + `_components`. The selector lists the user's plans (existing multi-plan support) + sets active (existing activate mutation); "Load" a subscribed plan is stubbed to the same activate path (real subscription source = future). Day cards → real sessions, colored dot by session type; tap → day view. Hide plan/day EDIT affordances on mobile (owner-only, S0 gate) — show the "editing lives on desktop" note.
**DoD:** plan renders the real active plan's week; switching active plan works and re-drives Today; day tap opens the day view; edit is not exposed on mobile. Matches `/demo`. `ralph-verify.sh` green.
**Verify:** Playwright: switch active plan, confirm Today reflects it; open a day; confirm no edit button as non-owner; screenshot desktop+mobile.
**Touches:** `src/app/(app)/plan/**` (view + controls; NOT the `/edit` internals beyond gating). **Off-limits:** plan mutation signatures, integrity guards.

## SLICE S5 — Progress (merge Trends + History → 3-view tab)

**Delivers:** `/progress` as the `/demo` Progress screen — segmented Overview / By exercise / History — absorbing today's `/trends` + `/history` into one tab wired to the existing history + analytics + bodyweight libs.
**Approach:** new `src/app/(app)/progress/page.tsx` composing: **Overview** (stat cards: workouts/PRs/streak + the per-exercise chart + recent timeline), **By exercise** (the current per-exercise progression/e1rm from `trends` + `history/exercises`), **History** (the current completed-workouts + PR-timeline from `history`). Reuse the existing data (`src/lib/history/*`, `src/lib/analytics/*`, `trends/_components/*`, `history/_components/*`) — re-home the components, don't rebuild the queries. Redirect old `/trends` and `/history` → `/progress` (preserve deep links to `/history/workouts/[id]` etc. or re-home them under `/progress`).
**DoD:** Progress shows real stat row + a real per-exercise chart + real recent PRs/sessions; the three segments each render real data; old `/trends` `/history` routes redirect; deep-linked workout/exercise detail still resolves. Matches `/demo`. `ralph-verify.sh` green.
**Verify:** Playwright: land Progress, switch all 3 segments with a data-having test user, open a workout detail + an exercise chart; confirm redirects; screenshot desktop+mobile.
**Touches:** `src/app/(app)/progress/**` (new), re-home `trends/_components/*` + `history/_components/*` + detail routes, redirects for old paths, `src/components/layout/BottomTabBar.tsx` (already points here from S0). **Off-limits:** the analytics/history query logic (re-home, don't rewrite).

## SLICE S6 — Community placeholder + /admin stub + Settings reskin + polish

**Delivers:** the Community tab as a navigable "coming soon" placeholder in the `/demo` visual language (D21); an owner-only `/admin` stub route (the desktop admin-hub seam, links `spec/ADMIN_HUB_ANALYTICS.md` scope in a comment); Settings reskinned to the light/Satoshi system; a whole-app visual polish pass.
**Approach:** `src/app/(app)/community/page.tsx` → the storefront/feed _shell_ from `/demo` but clearly "coming soon" (no fake data pretending to be live; the featured card can preview Marcus's own Block II as the seed program, subscribe = disabled "soon"). `/admin` → owner-gated stub page naming the future scope (program CRUD + publish control + the 8-tile analytics). Reskin `src/app/(app)/settings/**` to the primitives. Sweep every tab for spacing/legibility consistency.
**DoD:** Community navigates + looks designed but is honestly a placeholder; `/admin` is owner-only and states its scope; Settings matches the system; no visual inconsistency across tabs. `ralph-verify.sh` green.
**Verify:** Playwright: Community renders (mobile), `/admin` bounces non-owner + renders for owner, Settings screenshot; full-app screenshot sweep desktop+mobile.
**Touches:** `src/app/(app)/community/**` (new), `src/app/(app)/admin/**` (new stub), `src/app/(app)/settings/**`. **Off-limits:** building the real community/subscription backend (next build).

## Final pass

Whole-app e2e on the live authenticated app (test user, Block II seeded): open every tab, log a set, log a meal, switch a plan, view progress. Final `/roast-code` over the whole diff → 4F triage → ralph to convergence (bounded; escalate if non-converging). Close `build-log.md` with the `✅ BUILD COMPLETE` entry. Present integration options (recommend: PR for Marcus's review; do NOT auto-merge). Update the vault `overview.md`.

---

## SLICE T2-F — Swap exercise media to CC-BY-SA line figures ✅ SHIPPED

**Delivered:** the 46 stock photos are replaced by animated line figures on **76 of 83**
exercises. Three PNG frames per exercise, cross-faded by a pure-CSS step loop, recoloured
in the browser so white-on-transparent art reads on the warm-white theme.

**Source (D35, corrected by D36):** npm `@bryllim/workout-guide@1.0.0` — 302 exercises ×
3 frames. Code MIT; **artwork CC-BY-SA-4.0**. The frames are **PNG, not SVG** (D36 §1) and
**white on transparent** (D36 §2). Everkinetic — the real SVG upstream — was cloned and
matched head-to-head and lost on vocabulary, 34/83 vs 76/83 (D36 §3).

**Licence posture (D35's hard rule, honoured):** the artwork ships **byte-identical**;
`filter: invert(1)` recolours it at DISPLAY time only. No Adapted Material is distributed,
so ShareAlike never reaches the app's own source. `MediaCredits` (Settings) names creator,
source, licence-with-link and discloses the recolour. **Never pre-process the PNGs.**

**What shipped**

- `src/lib/catalog/name-match.ts` — the T2-A matcher extracted so both catalogs agree,
  plus an optional alias table consulted before scoring (D37) and two real bug fixes (D38).
- `scripts/vendor-figures.ts` — dry-run-by-default, `--user`-scoped, aborts on a dangling
  alias. Copies frames verbatim and vendors the four licence files beside them.
- `supabase/migrations/028_figure_sequence_media.sql` — widens the `media_type` CHECK to
  add `'figure-sequence'` (media_path becomes a DIRECTORY of `frame-N.png`). **Applied.**
- `ExerciseImage` — a third media model; still a server component, zero client JS.
- `.figure-seq` in `globals.css` — the 3-frame loop + `prefers-reduced-motion` fallback.
- `MediaCredits` + its slot in Settings — a licence obligation, not decoration.

**Verified:** `verify-name-match.ts` (43 checks) · `verify-exercise-image.ts` (24 checks) ·
all 19 verify scripts green · `ralph-verify` green · **`e2e/drive-t2f.mjs` 14/14**, which
reads COMPUTED STYLE rather than markup: one frame opaque at a time, the loop provably
advances (1→2→3), the invert filter really applied, every frame 200s, no-media degrades to
nothing, reduced motion holds frame 1, 0px horizontal overflow at 390px, and all 57 distinct
vendored figure paths serve.

**Left open for Marcus's eye:** 4 exercises have no figure and keep their photo (DB
Pullover · Jefferson Curl · Muscle Ups · Tib Raises). A few matches are deliberate
approximations — Single Leg BB Squat → Bulgarian Split Squat, Incline Smith → Incline Bench
Press, JM Press → Skull Crusher, Seated Ab Curl Machine → Crunch. One `--prune` run deletes
the 45 orphaned photo JPGs once he is happy; they are deliberately still on disk.
