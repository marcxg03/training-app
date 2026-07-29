# Build Log — Trends & Analytics

Build order: Slice 0 scaffold → 1 e1RM → 2 weekly volume → 3 nutrition trend →
4 bodyweight → final pass. Plan + done-defs in BUILD_PLAN.md.

---

## Slice 0 — Scaffold ✅ (2026-07-28)

**Built:** `/trends` RSC page (4 placeholder section cards, standard header
pattern), 6th nav tab (TrendingUp, "Trends"), `src/lib/analytics/`
projections+queries skeleton, `e2e/screenshot-trends.mjs` verification driver
(reuses existing seed-auth/prep-profile harness). Added `playwright` as
devDependency (browsers already cached locally).

**Verified:** `tsc --noEmit` + lint green. Dev server + seeded e2e user →
authed screenshots mobile(390)+desktop(1280): page renders, nav highlights
Trends, 6 tabs fit mobile width.

**Roast:** deferred into Slice 1's roast (scaffold is placeholder markup that
Slice 1 replaces; its only durable surface — nav tab, lib skeleton — is Slice
1's seam and gets reviewed there). Decision D0.

---

## Slice 1 — e1RM progression ✅ (2026-07-28)

**Built:** Epley e1RM (12-rep cap) + best-per-day/best-reps-per-day builders +
pure `buildE1rmSpotlights` ranking in `lib/analytics/projections.ts`; paginated
`getSetLogWindow` + thin `getE1rmSpotlights` in `queries.ts`; history exercise
page chart upgraded to e1RM (bodyweight → best-reps fallback); Trends shows
top-4 spotlight sparklines with current value + delta; `toLbsChartPoints`
adapter in `lib/units`; ProgressionChart promoted to `components/shared/`.

**Verified:** 15 fixture tests green under both `TZ` locales (Epley incl.
literal-pinned rep cap, evening-set local-day bucketing, spotlight
ranking/tiebreak/exclusions); tsc+lint green; authed screenshots — chart
values hand-checked against seeded data (245 lbs / +33 correct).

**Roast (council of 6):** verdict FIX FIRST → all must-fixes implemented same
round: (1) 1000-row PostgREST truncation → paginated window fetch; (2) UTC vs
local day bucketing → APP_TIMEZONE-aware dayKeyOf (fixture-pinned); (3) window
boundary snapped to day keys (delta baseline no longer drifts intra-day);
(4) seed script now refuses non-@trainingapp.test users before any delete.
Also adopted: ranking moved to pure layer + tested (incl. Test Skeptic's
filter-after-slice latent bug — fixed + tested); mutation-proof rep-cap pins
(old assertion provably passed a cap mutant); delta computed unrounded;
shared lbs adapter; trends scaffold array removed. Converged: no unaddressed
must-fix; surface re-reviewed again at final whole-build roast.

**Decisions carried forward:**
- D1: analytics day bucketing = APP_TIMEZONE local dayKeys, everywhere.
- D2: new chart types (bar/band) = sibling components sharing frame
  primitives — do NOT add a variant prop to ProgressionChart.
- D3: queries stay thin fetch wrappers (`getSetLogWindow` is THE set_logs
  fetch, shared by weekly volume); all shaping pure in projections + tested.
- D4: bodyweight reps-fallback chart was unplanned scope, kept as a
  correctness patch (Scope Gate reviewed).
- D5 (deferred → FUTURE_WORK): committed e2e password in seed-auth.mjs
  (pre-existing infra); /tmp auth file now chmod 600.

---

## Slice 2 — Weekly volume by muscle group ✅ (2026-07-28)

**Built:** `weekKeyOf` (Monday anchor, DST/year-boundary probed) +
`buildWeeklyVolumeByGroup` (zero-filled 8-week buckets, cross-group
double-count by design, within-set dedupe, bodyweight counts sets not
tonnage, "other" bucket) in projections; `VolumeBarChart` sibling component
(zero baseline — a min-anchored bar chart would lie); `WeeklyVolumeSection`
small-multiples; page refactored to ONE `getSetLogWindow(90)` fetch feeding
both builders (D3 honored).

**Verified:** 26 fixture tests green (incl. mutant-killers below); tsc+lint
green; screenshots mobile+desktop; independent tonnage cross-check from seed
spec (chest 21,045 kg = 46.4k lbs — matches UI exactly).

**Roast (lean council: Bug Hunter · Test Skeptic · Maintainer; design surface
pre-ruled by D2/D3):** FIX FIRST → all implemented same round:
(1) duplicate/case-variant muscle tags double-counted one set → dedupe+
normalize, tested; (2) snake_case tags rendered "Rear_delts" → shared
`formatMuscleGroupLabel` reusing the app's existing idiom; (3) DST fall-back
edge could drop the window's first local hour → fetch pad +2 days;
(4) unstable offset pagination at the 1000-row seam → set_log_id order
tiebreaker. Test Skeptic ran 9 mutants: 4 survived old suite → 4 new
mutant-killing tests added (window guards, Sunday-night Chicago anchoring,
full sort order, dedupe); all mutants now die. Converged.

**Decisions carried forward:**
- D6: extract shared `ChartFrame` (empty state, card, svg shell, grid,
  footer) as the FIRST step of Slice 3's band chart — rule-of-three hits
  there. Scaling math stays per-component.
- D7: projections.ts splits (time.ts + per-domain) only if a 4th domain
  lands — not during this build.

---

## Slice 3 — Nutrition 30-day trend ✅ (2026-07-28)

**Built:** D6 honored — `ChartFrame` extracted (empty state, card, svg shell,
grid, footer; scaling math stays per-chart), ProgressionChart + VolumeBarChart
refactored onto it; NEW `BandChart` sibling (min–max band + midline + dashed
target zone, eager-children guard); `getMealsForDateRange` (nutrition domain);
pure `buildNutritionBands` (per-day range sums, unlogged days omitted, partial
today kept on chart but excluded from averages); pure `nutritionWindowStart`
in nutrition/projections (injectable clock); NutritionTrendSection (calories +
protein cards, avg/day stats, target-zone legend only when targets exist).

**Verified:** 33 fixture tests + NEW 9-case chart render smoke test
(`scripts/verify-charts.ts` — degenerate inputs, NaN/Infinity assertions on
markup; found none post-fix); tsc+lint green; screenshots — avg kcal/day
cross-checked by hand from seed spec (1772 exact match).

**Roast (lean: Bug Hunter · Test Skeptic):** FIX FIRST → implemented:
(1) history exercise fetch was still unpaginated (same 1000-row trap fixed in
analytics — now paginated with tiebreakers); (2) partial today biased the
averages → partialDayKey rule + tests; (3) "DASHED = TARGET ZONE" legend
rendered with no targets → conditional; (4) 4 surviving mutants (protein
min/max swap, sort drop, rounding, NaN-vs-null masking in check()) → pinned
with dedicated tests incl. Object.is NaN check; (5) window arithmetic
untestable → moved to pure helper + month-boundary test. Bug Hunter cleared
all 4 suspected chart-math edges with SSR probes (no NaN/Infinity leaks).
Seed gap found during verify (missing cal columns) — seed now derives
calories 4/4/9 like the app. Converged.

---

## Slice 4 — Bodyweight trend ✅ (2026-07-28) — migration gate PENDING

**Built:** migration `021_bodyweight_logs.sql` (one row per user per local
day, kg stored, RLS matching the app pattern — NOT applied to remote, gated
on Marcus); `src/lib/bodyweight/` mutations (upsert + profiles.bodyweight_kg
sync, session-derived user id) + queries (windowed, graceful
`available: false` when the table is missing — PGRST205); pure
`buildBodyweightTrend`; `BodyweightSection` client component (quick-log lbs
input, trend chart, current + delta); `bodyweight_logs` types hand-added to
generated types.ts (regen after db push).

**Verified:** builder fixture tests; typecheck+lint; screenshots — page
renders the graceful "apply migration 021" state against the live DB (found
+ fixed en route: missing-table code is PGRST205, not 42P01 — the 500 this
caused was caught by screenshot verification). Live log→chart flow verified
after Marcus applies the migration.

**Roast (Bug Hunter · Security):** FIX FIRST → implemented: (1) partial
success (log written, profile sync failed) reported as failure — now
three-state result; input clears, chart refreshes, warning is non-blocking;
(2) trend window start used server-UTC day against device-local log_date —
now dayKeyDaysAgo (the file's own documented convention); (3) isPending only
covered the post-save refresh — whole submit now runs in an async transition
so the button actually disables during the save. Security: no exploitable
findings (WITH CHECK defaults verified; upsert blocked on both arms by RLS);
adopted hardening: mutation derives user id from the session instead of a
trusted prop. Final-pass check prescribed: RLS audit across all migrations.

---

## Slice 5 (unplanned) — App timezone fix 🕐 (2026-07-28)

Marcus hit the pre-existing server-timezone bug live ("still Tuesday 8pm
Central but the app jumped to the next day") — the exact flaw the councils
had flagged as out-of-scope wrinkle. Root cause: every "what day is it"
decision used the server clock (UTC on Vercel), rolling the app's day at 7pm
Central.

**Built:** migration `022_profile_timezone.sql` (profiles.timezone, default
America/Chicago); `src/lib/time/appDay.ts` (pure, fixture-tested day clock:
dateStringInTz, dayOfWeekInTz, dayKeyDaysAgo, addDaysToDayKey,
startOfDayInTzIso) + `src/lib/time/server.ts` (getAppTimezone — React-cached
profile read with graceful pre-migration/invalid fallback + observable
logging, getAppToday, getAppDayOfWeek); timezone picker in Settings→Profile
(full IANA list); EVERY day-clock call site rewired: today page (incl.
completed-today boundary), workout logger (completion find/create boundary),
log page day guard, nutrition day-type + meal filing, trends windows,
history charts, bodyweight windows.

**Verified:** dev server restarted with TZ=UTC (Vercel simulation) at the
live repro moment (Tue 8:19pm CDT = Wed 01:19 UTC): Today and Fuel both
show TUE · JUL 28 — bug reproduced-then-fixed with evidence. Fixture tests
pin the 7pm boundary (8pm Central = same day, UTC tz = next day). All 5
touched pages drive 200 at both viewports under UTC.

**Final whole-build roast (Architect · Operator): FIX FIRST → all 6
implemented:** (1) day-clock authority consolidated — dead getAppToday now
THE entry point, nutrition getTodayDateString deleted, dayKeyDaysAgo moved
to lib/time; (2) builder timeZone params made REQUIRED (an optional Chicago
default would silently recreate the bug class for forgotten call sites);
(3) bodyweight log_date now authored by the app clock, not the device
clock (one-clock law, fixed before migration = before any data);
(4) settings save no longer reports ok while dropping the timezone
pre-migration (warning surfaced, stays on page); (5) getAppTimezone logs
unexpected errors instead of swallowing outages into the fallback;
(6) getSetLogWindow got a MAX_FETCH_PAGES=20 runaway guard.

---

## ✅ BUILD COMPLETE (2026-07-28)

**Shipped:** /trends analytics hub (6th nav tab) — e1RM spotlights (top-4 by
recent volume, delta badges, links to history), weekly sets+tonnage per
muscle group (8-week zero-filled bars), nutrition 30-day calorie+protein
bands vs target zone (partial-today excluded from averages), bodyweight
quick-log + trend (migration-gated with graceful pre-migration state);
history exercise chart upgraded to e1RM (reps fallback for bodyweight
exercises); shared chart family (ChartFrame + line/bar/band siblings);
app-timezone day clock with Settings picker (the "jumped to next day" bug,
fixed at the root).

**Verification totals:** 47 fixture assertions (analytics math, timezone
boundaries, mutation-tested against surviving mutants) + 9 chart render
smoke cases + tsc + eslint green; authed Playwright drives of all 5 touched
pages at mobile+desktop, key chart values independently hand-computed
against seeded data (e1RM 245/+33, tonnage 46.4k, kcal avg 1772 — all exact
matches); static RLS audit: 22/22 tables have RLS + policies; live
TZ=UTC repro of the reported bug before/after.

**Roast rounds:** 5 councils, 16 adversarial reviews, 17 must-fixes found
and implemented pre-ship (incl. 1000-row silent truncations ×2, UTC day
bucketing, seed-script blast radius, double-counted muscle tags, partial-
success UI lie, timezone-save lie). All converged; nothing ships with a
known unaddressed must-fix.

**To go live (Marcus):**
1. Apply migrations 021 + 022 (`supabase db push`, or paste both files into
   the Supabase dashboard SQL editor) — BEFORE merging, which makes the
   deploy window a non-issue (both are backward-compatible with deployed code).
2. Merge redesign/instrument → main, push (Vercel auto-deploys).
3. Optional: `supabase gen types` to regenerate types.ts.

Everything is uncommitted on redesign/instrument — commit when ready.

