# SLICE_3_TODAY_DASHBOARD.md

## 1. Goal

Build the Today tab — Screens 1A (today landing) and 1B (today session detail) — as a read-only consumer of Slice 2's seeded data, with a stubbed Logger entry button on lifting sessions navigating to a placeholder route.

## 2. Acceptance Criteria

1. The Today tab loads at `/today` and renders without errors when authenticated.
2. The page determines today's `day_of_week` server-side at render time (Server Component, no client-side date logic).
3. The Today landing (Screen 1A) shows a header with today's day name (e.g., "Monday") and date (e.g., "April 30, 2026").
4. The Today landing renders all sessions for today's day_of_week, in chronological order (am → anytime → pm), using the same SessionSummaryRow / DayCard styling primitives from the Plan tab.
5. Each lifting session on Today landing displays a "Start Workout" button styled as the primary action (lilac accent).
6. Tapping "Start Workout" navigates to `/log/[session_id]`, which renders a placeholder page with text "Workout logger coming in Slice 4" and a "Back to today" link.
7. Each non-lifting session (cardio, recovery) on Today landing has no "Start Workout" button — those sessions are informational only.
8. Tapping any session card body (not the Start Workout button) navigates to `/today/session/[session_id]` (Screen 1B), which renders the full session detail using SessionDetailPanel from the Plan tab.
9. Screen 1B for a lifting session shows the session header, all blocks via BlockList, expandable exercise banks via ExerciseBankList, AND a "Start Workout" button at the top.
10. Screen 1B for a cardio or recovery session shows session header + description text, no blocks, no Start Workout button.
11. Screen 1B has a "Back to today" link in the top-left, mirroring Plan tab's "Back to week" pattern.
12. If today has zero sessions in the database (rest day fallback), Today landing shows an empty state: header with day/date, then a centered card with text "No sessions today. Rest up." and no further interaction.
13. The Today tab does NOT render any edit affordances (no add/edit/delete buttons, no pencil icons).
14. Other tabs (Plan, History, Nutrition, Settings) continue to render their existing slice-specific content; the bottom tab bar correctly highlights "Today" when on `/today` and any descendant route.
15. The Today tab respects authentication: unauthenticated visits redirect to `/login`.
16. Server-side data fetching uses one round-trip per route: `/today` fetches today's sessions in one query; `/today/session/[session_id]` fetches the session + its blocks + their bank exercises in the minimum required queries.

## 3. Files to Create or Modify

**Create:**
- `src/app/(app)/today/page.tsx` — REPLACE the Slice 1 placeholder with Screen 1A
- `src/app/(app)/today/session/[session_id]/page.tsx` — Screen 1B
- `src/app/(app)/log/[session_id]/page.tsx` — Logger placeholder (Slice 4 will replace contents)
- `src/components/today/TodayHeader.tsx`
- `src/components/today/TodaySessionList.tsx`
- `src/components/today/TodaySessionCard.tsx`
- `src/components/today/StartWorkoutButton.tsx`
- `src/components/today/RestDayEmpty.tsx`
- `src/lib/methodology/today.ts` — `getTodayDayOfWeek()` server-side helper

**Modify:**
- None outside the create list. The existing Plan-tab components (`SessionDetailPanel`, `BlockList`, `ExerciseBankList`) are imported as-is from `src/components/plan/`.

**Import boundaries:**
- Today components MAY import from `src/components/plan/` for shared session-detail rendering. This is intentional reuse. If a Today-specific divergence ever emerges, the affected component should be lifted to `src/components/shared/` rather than duplicated. Do not pre-emptively rename or move anything in Slice 3.

## 4. Component / Function Contracts

### `getTodayDayOfWeek(): DayOfWeek`
- Input: none (reads `new Date()` server-side)
- Output: lowercase 3-letter day code matching `daily_schedules.day_of_week`: `'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'`
- Side effects: none

### `TodayHeader`
- Props: `{ dayOfWeek: DayOfWeek, date: Date }`
- Renders: H1 with full day name, subtitle with formatted date
- Server Component

### `TodaySessionList`
- Props: `{ sessions: Session[] }`
- Renders: vertical list of TodaySessionCard, ordered by timing (am → anytime → pm), then by display_order within timing
- Server Component

### `TodaySessionCard`
- Props: `{ session: Session }`
- Renders: card with session type badge, name, timing, gym; card body is a Link to /today/session/[id]; lifting sessions also include StartWorkoutButton positioned to stop propagation
- Server Component (the Link does navigation; StartWorkoutButton is the only client-side handler)

### `StartWorkoutButton`
- Props: `{ sessionId: string }`
- Renders: primary-action button with lilac accent, navigates to /log/[sessionId]; stops event propagation so clicking does not trigger the card body navigation
- Client Component (uses onClick to stop propagation)

### `RestDayEmpty`
- Props: none
- Renders: centered Card with "No sessions today. Rest up."
- Server Component

## 5. Edge Cases to Handle

1. **No sessions today** (rest day): show RestDayEmpty.
2. **No active training plan** (zero `training_plans` rows for the user, or all `is_active = false`): show RestDayEmpty with same copy. Future Slice 8 will add a "Create your first plan" CTA in this case.
3. **Multiple lifting sessions today**: each gets its own Start Workout button. No restriction.
4. **session_id in /today/session/[session_id] does not match any session, OR matches a session not belonging to today's day_of_week, OR belongs to another user** (RLS would already filter the latter): redirect to `/today` with no error toast.
5. **session_id in /log/[session_id] is invalid**: placeholder page renders the placeholder text regardless. Slice 4 will add proper validation.
6. **Authenticated session expired mid-render**: handled by existing middleware (Slice 1 behavior). No new handling needed.
7. **Today is Sunday** in the seeded plan: one recovery session (Hot Yoga or Sauna). Renders as a card with no Start Workout button; body navigates to Screen 1B which shows the description. NOT the empty state.

## 6. Test Cases

### Phase 1 — Today landing (Screen 1A)
1. Navigate to `/today` while authenticated. Page loads, header shows today's day and date.
2. Today's sessions render in chronological order matching the Plan tab's Day Detail for the same day.
3. Each lifting session has a "Start Workout" button.
4. Each cardio session has NO Start Workout button.
5. Each recovery session has NO Start Workout button.
6. Bottom nav highlights "Today".

### Phase 2 — Logger stub navigation
7. Tap "Start Workout" on any lifting session. URL changes to `/log/[session_id]`. Page renders "Workout logger coming in Slice 4" placeholder.
8. Tap "Back to today" link. Returns to `/today`.

### Phase 3 — Session detail (Screen 1B)
9. Tap a lifting session card body (anywhere except Start Workout). URL becomes `/today/session/[session_id]`. SessionDetailPanel renders with all blocks visible.
10. Tap a block. Bank expands inline showing exercises with muscle-group captions.
11. Screen 1B for a lifting session shows a Start Workout button at the top.
12. Tap the Start Workout button on Screen 1B. Navigates to `/log/[session_id]`.
13. Tap a cardio session card body. URL becomes `/today/session/[session_id]`. Cardio description renders. No blocks. No Start Workout button.
14. Tap a recovery session card body. URL becomes `/today/session/[session_id]`. Recovery description renders. No blocks. No Start Workout button.
15. "Back to today" link returns to `/today`.

### Phase 4 — Edge cases
16. Manually flip today's `daily_schedules.is_rest_day` to true (or temporarily delete today's sessions) via Supabase SQL editor. Refresh `/today`. RestDayEmpty renders. Restore the data when done.
17. Manually navigate to `/today/session/<random-uuid>`. Redirects to `/today`.
18. Sign out, then visit `/today` directly. Redirected to `/login`.

### Phase 5 — Other tabs unaffected
19. Click Plan tab. Renders correctly with all 7 day cards.
20. Click History, Nutrition, Settings tabs. Each renders its existing Slice 1 placeholder.

### Phase 6 — Code quality
21. `pnpm lint` clean
22. `pnpm typecheck` clean
23. `pnpm format:check` clean
24. `git status` shows only expected new and modified files

## 7. Codex Generation Prompt

CONTEXT:
training-app — Next.js 15 App Router PWA encoding a personal training methodology, with Supabase (Postgres + Auth + RLS) backend and shadcn/ui on a dark theme with lilac (#9b7fd4 area) accents. Slice 1 shipped auth + scaffold; Slice 2 shipped the schema, seed pipeline, and read-only Plan tab. Repo is at commit 5ddd900 on main, working tree clean. /spec/MASTER_SPEC.md, /spec/ARCHITECTURE.md, /spec/slices/SLICE_2_PLAN_MIGRATION.md, and /spec/slices/SLICE_3_TODAY_DASHBOARD.md are the authoritative specs.

TASK:
Build Slice 3 — the Today Dashboard. Read-only consumer of Slice 2's data. Server-side day-of-week computation. Stub Logger entry on lifting sessions navigating to a placeholder /log/[session_id] route. Reuse Plan-tab session-detail components.

FILES TO CREATE:

src/app/(app)/today/page.tsx — REPLACE the Slice 1 placeholder with Screen 1A. Server Component. Computes today's day_of_week server-side. Fetches today's sessions via the user's active training plan. Renders TodayHeader + TodaySessionList, or RestDayEmpty if no sessions or no active plan.
src/app/(app)/today/session/[session_id]/page.tsx — Screen 1B. Server Component. Validates session_id belongs to today's day_of_week for the current user; redirect to /today on mismatch. Renders Back-to-today link + SessionDetailPanel (imported from /components/plan/). Lifting sessions also render StartWorkoutButton at the top.
src/app/(app)/log/[session_id]/page.tsx — Logger placeholder. Server Component. Renders centered card with "Workout logger coming in Slice 4" and a "Back to today" link. No data fetching, no validation in this slice.
src/components/today/TodayHeader.tsx — H1 day name + subtitle date. Server Component.
src/components/today/TodaySessionList.tsx — Sessions in am → anytime → pm order. Server Component.
src/components/today/TodaySessionCard.tsx — Session card. Body is a Link to /today/session/[id]. Lifting sessions include StartWorkoutButton. Reuse Card primitive from /components/ui/card.tsx.
src/components/today/StartWorkoutButton.tsx — Client Component. Lilac primary-action button. Navigates to /log/[sessionId] via Link or router.push. Stops event propagation on click so card body navigation doesn't also fire.
src/components/today/RestDayEmpty.tsx — Server Component. Centered Card with "No sessions today. Rest up."
src/lib/methodology/today.ts — Export getTodayDayOfWeek() returning lowercase 3-letter day code.

CONSTRAINTS:

Tech stack: Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui Card. Server Components by default. "use client" only on StartWorkoutButton (event handling on the button itself).
Naming per /spec/ARCHITECTURE.md: kebab-case for non-component files, PascalCase for components, camelCase for variables and functions.
Use only literal process.env.NEXT_PUBLIC_* access (DefinePlugin requirement; see DECISIONS.md). The Today components don't read env vars directly — they use createClient() from src/lib/supabase/server.ts.
Reuse existing components: import SessionDetailPanel, BlockList, ExerciseBankList from src/components/plan/. Do not duplicate, rename, or modify those files.
Reuse the Card primitive from src/components/ui/card.tsx.
Use the regenerated Database types from src/lib/supabase/types.ts.
Server-side data fetching: each route makes the minimum required queries. /today: query today's daily_schedule + sessions joined (one round trip if possible). /today/session/[id]: query the session + its blocks + bank exercises (relational fetch). Avoid N+1.
Authentication is enforced by existing middleware in src/middleware.ts. New pages don't re-implement auth checks.
No new state management library. Server components fetch and render directly.
No new dependencies beyond what's already in package.json.

ACCEPTANCE CRITERIA:

/today renders today's sessions in chronological order; lifting sessions have a Start Workout button.
/log/[session_id] renders a placeholder with "Workout logger coming in Slice 4" and a back link.
/today/session/[session_id] renders the session detail using SessionDetailPanel; lifting sessions show a Start Workout button at the top.
Rest day or no-active-plan shows RestDayEmpty.
session_id mismatches (wrong day, nonexistent) redirect to /today.
Bottom nav highlights "Today" on /today and all descendant routes.
No edit affordances anywhere.
pnpm lint, typecheck, format:check all pass.

DO NOT:

Modify any file in src/components/plan/ — those are reused as-is
Modify any database schema, migration, or seed file
Add features beyond Slice 3's scope (no actual logger, no editable today view, no notifications)
Add new dependencies
Leave placeholder TODOs or stub functions (the Logger placeholder page is the ONE intentional stub and is described above)
Add client-side date computation; today's day_of_week is server-side only
Use process.env[varName] dynamic access

OUTPUT:
Write the complete implementation. Do not explain — just produce the code. List at the end:

Every column name referenced from the database
Every Supabase client method called
Every env var read (expected: none new)
Every assumption made about the schema or methodology
Files modified outside the create list (expected: none)


## 8. Claude Code Quality Review Prompt

CONTEXT:
Slice 3 of training-app — Today Dashboard. Codex just generated Screens 1A and 1B for the Today tab plus a Logger placeholder route. Read-only consumer of Slice 2's seeded data. Server-side day-of-week computation. Reuses Plan-tab session-detail components.

FILES CODEX TOUCHED:
[Pull the actual list from Codex's output. Expected:

src/app/(app)/today/page.tsx (modified — replaced Slice 1 placeholder)
src/app/(app)/today/session/[session_id]/page.tsx (new)
src/app/(app)/log/[session_id]/page.tsx (new)
src/components/today/TodayHeader.tsx (new)
src/components/today/TodaySessionList.tsx (new)
src/components/today/TodaySessionCard.tsx (new)
src/components/today/StartWorkoutButton.tsx (new)
src/components/today/RestDayEmpty.tsx (new)
src/lib/methodology/today.ts (new)]

REVIEW CHECKLIST:

Server vs client component discipline:

All components default to Server Component
"use client" only on StartWorkoutButton (or wherever onClick / event propagation is required)
No accidental client-side data fetching



Reuse over duplication:

SessionDetailPanel, BlockList, ExerciseBankList imported from /components/plan/ — not copied or renamed
Card primitive imported from /components/ui/card.tsx
No "TodayBlockList" or "TodaySessionDetailPanel" duplicates



Schema fidelity:

Every database column reference matches the live schema (use src/lib/supabase/types.ts)
daily_schedules.day_of_week values match the enum exactly



Date / day-of-week handling:

getTodayDayOfWeek() is server-side only
No new Date().getDay() in client components
Returns the lowercase 3-letter code matching the enum



Performance:

/today does the minimum queries (ideally 1-2: active plan + today's sessions). Verify no N+1.
/today/session/[id] fetches session + blocks + bank exercises in minimum queries.



Authentication and redirects:

Routes don't re-implement auth (middleware handles it)
session_id validation in /today/session/[id] redirects to /today on mismatch
/log/[session_id] does NOT validate session_id (Slice 4 adds validation)



Error handling:

No-active-plan case shows RestDayEmpty
Session lookup returning null is handled gracefully (redirect, not crash)
Database query errors surface clearly (not silently swallowed)



Naming:

Files in src/components/today/ are PascalCase
Helper file in src/lib/methodology/ is kebab-case
Internal variables and functions are camelCase



Strict TypeScript:

No any
Database types come from src/lib/supabase/types.ts
Session, Block, Exercise types are correctly typed



Style and UX:

Lilac accent on the primary "Start Workout" button matches existing accent treatment
Card primitive used for session cards on Screen 1A and the RestDayEmpty
"Back to today" link on Screen 1B mirrors Plan tab's "Back to week" pattern
Bottom nav highlights "Today" on /today and /today/session/[id] (descendant route)



Read-only verification:

No edit / add / delete buttons
No form inputs
Only interactive elements: card body click → /today/session/[id], Start Workout button → /log/[id], Back link



Logger placeholder:

/log/[session_id] renders the placeholder text
"Back to today" link works
No data fetching, no validation in this slice



Slice scope:

No files modified outside the create list
No new dependencies
No schema changes


AUTO-FIX vs FLAG:

Auto-fix: items 1-13 when fixes are local and unambiguous
Flag for approval: structural refactors, splits to /components/shared/, lifting reused components out of /components/plan/

CONSTRAINTS:

Do not add features
Do not modify files in src/components/plan/, src/lib/supabase/, src/components/ui/
Do not change folder structure from /spec/ARCHITECTURE.md
Minimal, surgical changes only

OUTPUT:
Summary with four parts:

Files changed and why (one line each)
Items flagged for user approval with reasoning
Issues logged for KNOWN_ISSUES.md
Ready-for-testing verdict (yes / no — if no, what's blocking)


## 9. Claude Code Debugging Prompt (template — fill CURRENT PROBLEM when needed)

CONTEXT:
Slice 3 of training-app — Today Dashboard. Codex generated and Claude Code reviewed. Now testing.

CURRENT PROBLEM:
[Exact error message, browser console output, dev server log line, or screenshot transcription. Be specific.]

RELEVANT FILES:
[Files involved — paths from project root]

WHAT CODEX BUILT / QUALITY REVIEW COVERED:
[Brief summary of what's working and what was already addressed]

CONSTRAINTS:

Tech stack: Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui
Do not refactor outside the current problem
Do not modify files in src/components/plan/, src/lib/supabase/, src/components/ui/

ACCEPTANCE CRITERIA:
[Pull the relevant criteria from Section 2]

DO NOT:

Rewrite files that are working
Add features outside the current fix
Change folder structure from /spec/ARCHITECTURE.md
Generate a new slice from scratch — if that's needed, stop and tell me to take it to Codex first

OUTPUT:
Fix the problem. Summarize what was changed, why, and list any follow-up issues.
