# SLICE_6_1_HISTORY_READ_SCAFFOLD.md

> Slice 6.1 of 10 (split from Slice 6 in Phase 2 — Slice 6.2 covers Exercise Progress + Session Detail)
> Phase 4 — feature slice
> Spec source: MASTER_SPEC §12, ARCHITECTURE §16
> Discovery decisions: DECISIONS.md "Slice 6 — History tab Discovery decisions (May 2, 2026)"

## 1. Goal

Ship the read-side scaffold for the History tab: PR Timeline (landing surface) and All Sessions list, plus the cross-link component contract and the History data layer that both surfaces — and the future Slice 6.2 surfaces — will share.

## 2. Acceptance Criteria

1. Navigating to `/history` (authenticated) renders the PR Timeline as a Server Component with rows from `pr_history` for the current user, ordered by `achieved_at DESC`, default windowed to last 90 days.
2. Each PR Timeline row displays exercise name, PR type badge (`weight` or `in_range_rep`), weight × reps, and a session caption in the format `<sessions.session_name> · <date>` (e.g., `Pull · May 1`).
3. Tapping an exercise name on a PR Timeline row navigates to `/history/exercises/{exercise_id}` (placeholder route — full surface ships in Slice 6.2).
4. Tapping a session caption on a PR Timeline row navigates to `/history/sessions/{completion_id}` (placeholder route — full surface ships in Slice 6.2).
5. PR Timeline shows a "Show all" toggle. Tapping it navigates to `/history?showAll=1`, which removes the 90-day window and renders the user's full PR history. Tapping again navigates back to `/history`.
6. PR Timeline empty state: when no PRs exist in the current window, the surface renders `"No PRs in the last 90 days. Tap Show all to see your full history, or All Sessions to browse past sessions."` (or equivalent for the `showAll=1` window: `"No PRs yet."`).
7. PR Timeline has a header link labeled "All Sessions" that navigates to `/history/sessions`.
8. Navigating to `/history/sessions` (authenticated) renders the All Sessions list as a Server Component with rows from `session_completions` for the current user, ordered by `started_at DESC`, full history (no default window).
9. Each All Sessions row displays the session display name (`<sessions.session_name> · <date>` format), a state badge (`complete` | `in progress` | `ended early`), a blocks-completed summary in the form `N of M blocks` where M is the count of blocks for that session template, and a PR count when greater than zero.
10. State derivation on All Sessions rows: `completed_at IS NOT NULL AND was_ended_early = false` → `complete`; `was_ended_early = true` → `ended early`; otherwise → `in progress`. Each state has a distinct visual treatment per ARCHITECTURE §16.3 (`SessionStateBadge`).
11. Tapping any All Sessions row navigates to `/history/sessions/{completion_id}` (placeholder route — full surface ships in Slice 6.2).
12. PR count on All Sessions rows uses the hybrid query (FK + time window) per ARCHITECTURE §16.4 — rows with `pr_history.set_log_id IS NULL` are excluded from the count.
13. All Sessions empty state: `"No completed sessions yet."`
14. Both `/history` and `/history/sessions` are protected by the existing auth middleware. Unauthenticated requests redirect to the existing sign-in flow.
15. RLS enforces `user_id = auth.uid()` on every read. Cross-user data is never returned. (Verified by inspection — Slice 6.1 introduces no new RLS policies and changes none.)
16. Both surfaces are Server Components. The "Show all" toggle on PR Timeline is the only client component in Slice 6.1.
17. Both surfaces respond within 200ms server-side query time on a realistic dataset per MASTER_SPEC §12.8 NFRs (best-effort verification — Phase 4 will spot-check, not benchmark formally).
18. The shared cross-link components `ExerciseLink` and `SessionLink` are created in `src/components/shared/` and used by all PR Timeline and All Sessions row components. Direct `<Link>` usage for these targets is forbidden — the cross-link contract goes through the shared components.
19. Placeholder routes for `/history/exercises/[exercise_id]` and `/history/sessions/[completion_id]` exist and render a minimal placeholder (e.g., `"Coming soon — Slice 6.2"`) so cross-link navigation does not 404. The placeholder pages do NOT fetch any data.
20. No new schema, RLS policies, or migrations are introduced. No write paths added. No new dependencies (Recharts is deferred to Slice 6.2).
21. P1 features F7 (Exercise Picker) and F8 (PR-type visual distinction) from MASTER_SPEC §12.4 are NOT in scope for Slice 6.1. F8 is partially satisfied by AC #2 (PR type badge displayed); deeper visual distinction is deferred.

## 3. Files to Create or Modify

Create:

- `src/app/(app)/history/page.tsx` — PR Timeline route (Server Component)
- `src/app/(app)/history/sessions/page.tsx` — All Sessions list route (Server Component)
- `src/app/(app)/history/exercises/[exercise_id]/page.tsx` — placeholder route, AC #19
- `src/app/(app)/history/sessions/[completion_id]/page.tsx` — placeholder route, AC #19
- `src/app/(app)/history/_components/PRTimelineRow.tsx` — Server, presentational
- `src/app/(app)/history/_components/PRTimelineShowAllToggle.tsx` — Client, local state
- `src/app/(app)/history/_components/AllSessionsRow.tsx` — Server, presentational
- `src/app/(app)/history/_components/SessionStateBadge.tsx` — Server, presentational
- `src/app/(app)/history/_components/PRTypeBadge.tsx` — Server, presentational
- `src/app/(app)/history/_components/HistoryHeaderLink.tsx` — Server, "All Sessions" link
- `src/lib/history/queries.ts` — `getPRTimeline`, `getAllSessions` only (Slice 6.2 adds the other two)
- `src/lib/history/projections.ts` — TS types for the four projections used in Slice 6.1: `PRTimelineRow`, `AllSessionsRow`. Other projections deferred to Slice 6.2.
- `src/lib/history/displayName.ts` — `formatSessionDisplayName` per ARCHITECTURE §16.3
- `src/lib/history/crossLinks.ts` — `exerciseProgressHref`, `sessionDetailHref`, `allSessionsHref` per ARCHITECTURE §16.3
- `src/components/shared/ExerciseLink.tsx` — Server, F6 cross-link enforcement
- `src/components/shared/SessionLink.tsx` — Server, F6 cross-link enforcement

Modify:

- `src/components/nav/BottomNav.tsx` (or wherever the existing bottom-tab History entry lives) — ensure the History tab links to `/history` and is reachable from all bottom-nav contexts. If the History tab is already wired correctly from prior slice planning, no change needed; verify and report.

NOT touched (allowlist enforcement):

- Any file under `src/app/(app)/log/` (Logger — Slice 4/5 territory)
- Any file under `src/lib/sync/` (Slice 5)
- Any file under `src/lib/auth/` (Slice 5)
- `src/app/(app)/settings/page.tsx` (Slice 5)
- Any migration files
- Any RLS policy files
- `package.json` / `pnpm-lock.yaml` (no dependency changes)

## 4. Component / Function Contracts

### Data layer

```typescript
// src/lib/history/projections.ts

export type PRTimelineRow = {
  pr_id: string;
  achieved_at: string; // ISO timestamp
  exercise_id: string;
  exercise_name: string;
  pr_type: "weight" | "in_range_rep";
  weight_kg: number;
  reps: number;
  is_bodyweight: boolean;
  set_log_id: string;
  completion_id: string;
  session_display_name: string; // pre-formatted by queries.ts
};

export type AllSessionsRow = {
  completion_id: string;
  session_display_name: string; // pre-formatted by queries.ts
  started_at: string; // ISO timestamp
  state: "complete" | "in_progress" | "ended_early";
  blocks_completed_count: number;
  blocks_total_count: number;
  pr_count: number;
};
```

### Query functions

```typescript
// src/lib/history/queries.ts

export async function getPRTimeline(opts: {
  showAll: boolean;
}): Promise<PRTimelineRow[]>;
// SQL shape per ARCHITECTURE §16.4 getPRTimeline. Server-side only.
// MUST filter `pr.set_log_id IS NOT NULL`.
// Calls formatSessionDisplayName during projection.

export async function getAllSessions(): Promise<AllSessionsRow[]>;
// SQL shape per ARCHITECTURE §16.4 getAllSessions. Server-side only.
// pr_count subquery uses hybrid (FK + time window) per Q2 resolution.
// State derivation in projection per AC #10.
// Calls formatSessionDisplayName during projection.
```

### Display name helper

```typescript
// src/lib/history/displayName.ts

export function formatSessionDisplayName(
  sessionName: string,
  startedAt: Date | string,
): string;
// Returns "<sessionName> · <formatted_date>".
// Date format: "MMM D" if startedAt is in the current calendar year,
//              "MMM D, YYYY" otherwise.
// Uses Intl.DateTimeFormat. NO date library.
// Examples: "Pull · May 1", "Lower ATG · Dec 12, 2025"
```

### Cross-link href builders

```typescript
// src/lib/history/crossLinks.ts

export function exerciseProgressHref(exerciseId: string): string;
// Returns `/history/exercises/${exerciseId}`

export function sessionDetailHref(completionId: string): string;
// Returns `/history/sessions/${completionId}`

export function allSessionsHref(): string;
// Returns `/history/sessions`
```

### Cross-link components (shared)

```typescript
// src/components/shared/ExerciseLink.tsx

type ExerciseLinkProps = {
  exerciseId: string;
  children: React.ReactNode;
  className?: string;
};
// Server Component. Wraps children in a Next.js <Link> with href from crossLinks.ts.
// Renders nothing besides the <Link>. No data fetching.

// src/components/shared/SessionLink.tsx
// Same pattern, completionId instead of exerciseId.
```

### Page route signatures

```typescript
// src/app/(app)/history/page.tsx

export default async function PRTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ showAll?: string }>;
}): Promise<JSX.Element>;
// Reads searchParams.showAll. Calls getPRTimeline({ showAll }).
// Renders header (HistoryHeaderLink + page title), PRTimelineRow[],
// PRTimelineShowAllToggle. Empty state per AC #6.

// src/app/(app)/history/sessions/page.tsx

export default async function AllSessionsPage(): Promise<JSX.Element>;
// Calls getAllSessions(). Renders AllSessionsRow[]. Empty state per AC #13.
```

### Show all toggle

```typescript
// src/app/(app)/history/_components/PRTimelineShowAllToggle.tsx

"use client";

type PRTimelineShowAllToggleProps = {
  showAll: boolean;
};
// Renders a Next.js <Link> to either /history or /history?showAll=1
// based on inverse of current showAll prop.
// No useState — toggle state derived from URL via the prop.
```

## 5. Edge Cases to Handle

1. **No PRs in the user's data at all** (fresh install, brand new user). PR Timeline empty state per AC #6 (the variant for full history: "No PRs yet."). All Sessions also possibly empty per AC #13.

2. **No PRs in the 90-day window but PRs exist beyond it** (deload weeks, focused training cycle). Empty state of the 90-day window form: "No PRs in the last 90 days. Tap Show all..." per AC #6. The "Show all" link should be discoverable, not buried.

3. **`pr_history` row with `set_log_id IS NULL`**. Excluded from PR Timeline entirely (per AC #12 and ARCHITECTURE §16.4 Q2 resolution). Excluded from All Sessions PR count (same reason). Do NOT render or count these rows. Do not log a warning — this is expected per the known issue.

4. **Session in progress** (`completed_at IS NULL`, `was_ended_early = false`). Renders in All Sessions with `state: 'in_progress'` and a muted visual treatment per AC #10. The blocks_completed_count reflects the array length at query time. PR count includes any PRs achieved between `started_at` and `now()` per the hybrid query.

5. **Session ended early** (`was_ended_early = true`). Renders with `state: 'ended_early'` and its own visual treatment.

6. **Session with `completed_block_ids` empty array**. `blocks_completed_count = 0`, `blocks_total_count = M` (whatever the template defines). Display: `"0 of M blocks"`. Don't suppress the row — the audit trail shows the user started but completed nothing.

7. **Session with `blocks_total_count = 0`** (impossible per current schema, but defensive). Display: `"0 of 0 blocks"` or `"0 blocks"`. Don't crash.

8. **PR achieved before any session existed for that session_id** (theoretical legacy data). The JOIN in `getPRTimeline` will fail to match, so the row is excluded. Acceptable; this shouldn't occur in practice.

9. **Two sessions of the same template overlapping in time** (highly unusual but data-model-permitted). PR Timeline JOIN may match the wrong session_completion. Acceptable for Slice 6.1 — the AC #4 cross-link will route to one of the two sessions, which is wrong but recoverable. Log as a 🟢 Low known issue if observed during verification.

10. **Bodyweight PR row** (`is_bodyweight = true` on the exercise, `weight_kg = 0`). Display the row with weight rendered as `"BW"` or equivalent — Phase 4 implementation choice within the PR Timeline row component. Don't display `"0 lbs × 8"`.

11. **Show all toggle with no `?showAll=1` removed when no PRs at all**. AC #6 specifies the empty state copy distinguishes the windowed-empty case from the all-history-empty case. The toggle should still render in both cases (consistency); tapping "Show all" from the always-empty case stays empty with the alternate copy.

12. **Long exercise names or session names** that overflow the row width on narrow viewports (~375px). Truncate with ellipsis or wrap to a second line — Phase 4 implementation choice. Don't break the row layout.

13. **Auth middleware redirects mid-render**. Should not occur because middleware runs before the page renders, but if a session expires during the render path, the existing error boundary catches and redirects.

14. **Supabase query error** (network, RLS denial, malformed UUID elsewhere). Page-level error boundary renders a clear error state. Don't show a stack trace; show "Something went wrong loading your history. Try again." or equivalent. Existing error-boundary patterns from prior slices apply.

## 6. Test Cases

The following are user-flow tests. Each is run end-to-end manually after the Codex generation and Claude Code quality review pass complete. Each maps to one or more AC.

### Test 1 — PR Timeline default render (AC 1, 2, 3, 4, 16)

Pre-condition: User authenticated, multiple PR rows exist in `pr_history` within the last 90 days, including at least one weight PR and one in_range_rep PR.

Steps:

1. Navigate to `/history`
2. Observe rendered page

Expected:

- Page renders without errors
- PR rows display in chronological order, most recent first
- Each row shows exercise name, PR type badge, weight × reps, and session caption in `<name> · <date>` format
- Tapping an exercise name navigates to `/history/exercises/{exercise_id}` (placeholder)
- Tapping a session caption navigates to `/history/sessions/{completion_id}` (placeholder)
- View source / network tab confirms the page is server-rendered (HTML present without JS)

### Test 2 — PR Timeline with bodyweight PR (AC 2, edge case 10)

Pre-condition: At least one PR row exists for an exercise where `exercises.is_bodyweight = true` (e.g., Muscle Up).

Steps:

1. Navigate to `/history`
2. Locate the bodyweight PR row

Expected: The row renders with weight displayed as `"BW"` (or equivalent bodyweight-aware label), not `"0 lbs"` or `"0 kg"`.

### Test 3 — PR Timeline empty state, windowed (AC 6, edge case 2)

Pre-condition: No PRs in `pr_history` within the last 90 days for the current user, but at least one PR exists beyond 90 days.

Steps:

1. Navigate to `/history`

Expected: Empty state copy `"No PRs in the last 90 days. Tap Show all to see your full history, or All Sessions to browse past sessions."` (or equivalent close paraphrase). "Show all" toggle is visible and tappable.

### Test 4 — Show all toggle (AC 5)

Pre-condition: Same as Test 3.

Steps:

1. Navigate to `/history`
2. Tap the "Show all" toggle
3. Observe URL and rendered page
4. Tap the toggle again

Expected:

- Step 2 → URL becomes `/history?showAll=1`. Page now shows the user's full PR history.
- Step 4 → URL returns to `/history`. Page returns to the 90-day window.

### Test 5 — Empty state, all-history (AC 6, edge case 1)

Pre-condition: User has zero PR rows in `pr_history`. (Fresh install, or all PRs cleared during testing.)

Steps:

1. Navigate to `/history`
2. Tap "Show all"

Expected:

- Step 1 → 90-day windowed empty state copy renders.
- Step 2 → All-history empty state copy renders: `"No PRs yet."` (or equivalent close paraphrase).

### Test 6 — All Sessions list default render (AC 8, 9, 10, 11, 16)

Pre-condition: At least one `session_completions` row exists for the current user, with one row in each state (`complete`, `in_progress`, `ended_early`).

Steps:

1. Tap "All Sessions" header link from `/history`
2. Observe rendered page

Expected:

- Page renders at `/history/sessions` without errors
- Rows in chronological order by `started_at DESC`
- Each row shows session display name, state badge, `N of M blocks` summary, PR count if > 0
- Visual state badge differs between `complete`, `in_progress`, and `ended_early` rows
- Tapping a row navigates to `/history/sessions/{completion_id}` (placeholder)

### Test 7 — All Sessions PR count uses hybrid query (AC 12)

Pre-condition: At least one session exists where some PRs achieved during the session have `set_log_id IS NOT NULL` and at least one PR achieved during the session has `set_log_id IS NULL`.

Steps:

1. Navigate to `/history/sessions`
2. Locate the row for the test session
3. Manually verify expected PR count via direct SQL query

Expected: The displayed PR count matches the count of `pr_history` rows where (a) `set_log_id IS NOT NULL` AND (b) the joined `set_logs.session_id` matches the session AND (c) `achieved_at BETWEEN started_at AND COALESCE(completed_at, now())`. Rows with `set_log_id IS NULL` are excluded.

### Test 8 — All Sessions in-progress and ended-early state badges (AC 10)

Pre-condition: One in-progress session (`completed_at IS NULL`, `was_ended_early = false`) and one ended-early session (`was_ended_early = true`) exist.

Steps:

1. Navigate to `/history/sessions`
2. Locate both test rows

Expected: Each row's state badge renders distinctly — "in progress" muted styling for the in-progress row, "ended early" badge for the ended-early row, default styling for any complete rows.

### Test 9 — Empty state, no completed sessions (AC 13)

Pre-condition: `session_completions` empty for the current user.

Steps:

1. Navigate to `/history/sessions`

Expected: Empty state copy `"No completed sessions yet."` (or equivalent close paraphrase).

### Test 10 — Cross-link components in use everywhere (AC 18)

Pre-condition: Codex generation complete.

Steps:

1. Search the History route subtree for any direct `<Link href="/history/exercises/...">` or `<Link href="/history/sessions/...">` usage
2. Search for any `next/link` import in PRTimelineRow.tsx and AllSessionsRow.tsx

Expected: Zero direct `<Link>` usage targeting Exercise Progress or Session Detail routes. ExerciseLink and SessionLink are the only paths to those routes. Direct `next/link` import is permitted in HistoryHeaderLink (for "All Sessions" link) and in PRTimelineShowAllToggle (for the toggle), but NOT for cross-link affordances.

### Test 11 — Auth gate (AC 14)

Pre-condition: Sign out.

Steps:

1. Navigate to `/history`
2. Navigate to `/history/sessions`

Expected: Both navigations redirect to the existing sign-in flow without rendering History content.

### Test 12 — Placeholder routes navigable (AC 19)

Pre-condition: Codex generation complete.

Steps:

1. Tap an exercise name from PR Timeline
2. Observe rendered page
3. Back, tap a session caption
4. Observe rendered page

Expected: Both navigations land on placeholder pages with `"Coming soon — Slice 6.2"` copy (or equivalent). No 404, no data fetching, no errors.

### Test 13 — Performance smoke check (AC 17)

Pre-condition: Realistic dataset (at least 50 set_logs, 5 sessions, 5 PRs).

Steps:

1. Navigate to `/history` and observe Time-To-First-Byte in DevTools Network tab
2. Same for `/history/sessions`

Expected: TTFB under ~500ms for both surfaces on local dev. Not a strict test; a sanity check. If TTFB exceeds 1s, log a 🟡 Medium known issue and investigate the query.

## 7. Codex Generation Prompt (Phase 4A)

CONTEXT:
Building Slice 6.1 of training-app — Read scaffold for the History tab.
Stack: Next.js 15 App Router with React 19, TypeScript strict, Tailwind +
shadcn/ui, Supabase (existing instance with RLS enforced), pnpm + Node 20 LTS.
Read-only — no schema changes, no new RLS policies, no new dependencies.
This slice ships PR Timeline and All Sessions list. Slice 6.2 (next slice)
adds Exercise Progress and Session Detail.
The full spec is in spec/MASTER_SPEC.md §12 and spec/ARCHITECTURE.md §16.
The slice doc you're working from is spec/slices/SLICE_6_1_HISTORY_READ_SCAFFOLD.md.

Live database schema (relevant tables — read-only, do not modify):

```
pr_history(
  pr_id uuid PK,
  user_id uuid (RLS),
  exercise_id uuid,
  set_log_id uuid NULL,
  pr_type enum('weight', 'in_range_rep'),
  weight_kg numeric,
  reps integer,
  achieved_at timestamptz
)

set_logs(
  set_log_id uuid PK,
  user_id uuid (RLS),
  session_id uuid,
  block_id uuid,
  exercise_id uuid,
  set_index integer,
  weight_kg numeric(7,3),
  reps integer,
  is_to_failure boolean,
  prescribed_min integer,
  prescribed_max integer,
  notes text NULL,
  logged_at timestamptz
)

session_completions(
  completion_id uuid PK,
  user_id uuid (RLS),
  session_id uuid,
  started_at timestamptz,
  completed_at timestamptz NULL,
  completed_block_ids uuid[],
  was_ended_early boolean
)

sessions(
  session_id uuid PK,
  session_name text NOT NULL
  -- additional columns exist (schedule_id, session_type, timing, gym, description,
  -- display_order, cardio_format, cardio_distance, cardio_target_zone) but are
  -- out of Slice 6.1 scope.
)

blocks(
  block_id uuid PK,
  session_id uuid,
  name text,
  protocol_type enum('failure', 'mobility', 'corrective'),
  order_index integer,
  prescribed_min integer,
  prescribed_max integer
)

exercises(
  exercise_id uuid PK,
  name text,
  is_bodyweight boolean,
  muscle_group text,
  exercise_type text
)
```

TASK:
Implement Slice 6.1 — the History tab read scaffold. Build the PR Timeline
and All Sessions list as Server Components, plus the cross-link contract
components, plus the data layer. Placeholder pages for the two routes that
land in Slice 6.2.

FILES TO CREATE:

Routes (Server Components except where noted):

- src/app/(app)/history/page.tsx — PR Timeline route
- src/app/(app)/history/sessions/page.tsx — All Sessions route
- src/app/(app)/history/exercises/[exercise_id]/page.tsx — placeholder
- src/app/(app)/history/sessions/[completion_id]/page.tsx — placeholder

Components:

- src/app/(app)/history/\_components/PRTimelineRow.tsx — Server, presentational
- src/app/(app)/history/\_components/PRTimelineShowAllToggle.tsx — Client (use client)
- src/app/(app)/history/\_components/AllSessionsRow.tsx — Server, presentational
- src/app/(app)/history/\_components/SessionStateBadge.tsx — Server, presentational
- src/app/(app)/history/\_components/PRTypeBadge.tsx — Server, presentational
- src/app/(app)/history/\_components/HistoryHeaderLink.tsx — Server, "All Sessions" link

Data layer:

- src/lib/history/queries.ts — getPRTimeline, getAllSessions
- src/lib/history/projections.ts — TS types
- src/lib/history/displayName.ts — formatSessionDisplayName
- src/lib/history/crossLinks.ts — href builders

Shared cross-link components:

- src/components/shared/ExerciseLink.tsx — Server
- src/components/shared/SessionLink.tsx — Server

CONTRACTS — CRITICAL TO MATCH EXACTLY:

Type definitions in src/lib/history/projections.ts:

```ts
export type PRTimelineRow = {
  pr_id: string;
  achieved_at: string;
  exercise_id: string;
  exercise_name: string;
  pr_type: "weight" | "in_range_rep";
  weight_kg: number;
  reps: number;
  is_bodyweight: boolean;
  set_log_id: string;
  completion_id: string;
  session_display_name: string;
};

export type AllSessionsRow = {
  completion_id: string;
  session_display_name: string;
  started_at: string;
  state: "complete" | "in_progress" | "ended_early";
  blocks_completed_count: number;
  blocks_total_count: number;
  pr_count: number;
};
```

Function signatures:

```ts
// src/lib/history/queries.ts
export async function getPRTimeline(opts: {
  showAll: boolean;
}): Promise<PRTimelineRow[]>;
export async function getAllSessions(): Promise<AllSessionsRow[]>;

// src/lib/history/displayName.ts
export function formatSessionDisplayName(
  sessionName: string,
  startedAt: Date | string,
): string;

// src/lib/history/crossLinks.ts
export function exerciseProgressHref(exerciseId: string): string;
export function sessionDetailHref(completionId: string): string;
export function allSessionsHref(): string;
```

SQL QUERY SHAPES (use the existing Supabase server client, e.g.
createClient() from @/lib/supabase/server or whatever the existing pattern is).
RLS handles user_id filtering automatically; do NOT inject auth.uid() manually.

getPRTimeline:

```sql
SELECT pr.pr_id, pr.achieved_at, pr.pr_type, pr.weight_kg, pr.reps,
       ex.exercise_id, ex.name AS exercise_name, ex.is_bodyweight,
       sl.set_log_id, sl.session_id,
       sc.completion_id, sc.started_at,
       s.session_name
FROM pr_history pr
JOIN exercises ex ON ex.exercise_id = pr.exercise_id
JOIN set_logs sl ON sl.set_log_id = pr.set_log_id
JOIN session_completions sc ON sc.session_id = sl.session_id
  AND sc.user_id = pr.user_id
  AND sc.started_at <= pr.achieved_at
  AND (sc.completed_at IS NULL OR sc.completed_at >= pr.achieved_at)
JOIN sessions s ON s.session_id = sc.session_id
WHERE pr.set_log_id IS NOT NULL
  -- AND pr.achieved_at >= now() - interval '90 days'  -- omit if showAll
ORDER BY pr.achieved_at DESC
```

Then in projection: `session_display_name = formatSessionDisplayName(session_name, started_at)`

getAllSessions:

```sql
SELECT sc.completion_id, sc.started_at, sc.completed_at, sc.was_ended_early,
       sc.session_id,
       s.session_name,
       array_length(sc.completed_block_ids, 1) AS blocks_completed_count_raw,
       (SELECT COUNT(*) FROM blocks b WHERE b.session_id = sc.session_id) AS blocks_total_count,
       (SELECT COUNT(*)
          FROM pr_history pr
          JOIN set_logs sl ON sl.set_log_id = pr.set_log_id
          WHERE pr.user_id = sc.user_id
            AND sl.session_id = sc.session_id
            AND pr.achieved_at >= sc.started_at
            AND pr.achieved_at <= COALESCE(sc.completed_at, now())) AS pr_count
FROM session_completions sc
JOIN sessions s ON s.session_id = sc.session_id
ORDER BY sc.started_at DESC
```

In projection:

- `blocks_completed_count = blocks_completed_count_raw ?? 0` (Postgres returns NULL for empty array)
- `state = (completed_at !== null && was_ended_early === false) ? 'complete' : was_ended_early === true ? 'ended_early' : 'in_progress'`
- `session_display_name = formatSessionDisplayName(session_name, started_at)`

If the existing Supabase client pattern doesn't support raw SQL, implement
the queries using the JS query builder. The above SQL is the contract;
the JS implementation must produce equivalent results.

displayName format:

```
formatSessionDisplayName('Pull', new Date('2026-05-01T17:32:00Z'))
  => 'Pull · May 1'    (current year — May 2026, May 1)
formatSessionDisplayName('Lower ATG', new Date('2025-12-12T15:00:00Z'))
  => 'Lower ATG · Dec 12, 2025'    (prior year)
```

Use `Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })`
for current year.
Use `Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`
for prior years.
Detect "current year" via `new Date().getFullYear()` — done server-side
per request, no timezone games.

CONSTRAINTS:

- Next.js 15 App Router patterns. Server Components by default; only the
  toggle is 'use client'.
- TypeScript strict — no any, no @ts-ignore. Use the projection types.
- Tailwind for styling. Match the existing dark theme: #000 background,
  #9b7fd4 lilac for accent. Match shadcn/ui patterns from prior slices —
  spot existing badge / row / link components and reuse styling
  conventions.
- Mobile-first. Target 375–414px. Touch targets ≥ 44px.
- No new npm dependencies. Recharts is deferred to Slice 6.2.
- All cross-link affordances to Exercise Progress or Session Detail
  routes MUST go through ExerciseLink or SessionLink. Do NOT use
  next/link directly for these targets. (Direct next/link is fine for
  the "All Sessions" header link and the "Show all" toggle.)
- The placeholder pages do NOT fetch data. Render a minimal "Coming soon
  — Slice 6.2" page. They exist solely to prevent 404 from cross-link
  navigation.
- Empty-state copy from AC #6 and AC #13. Match the wording closely.
- Session state visual treatment: complete = default styling, in_progress
  = muted (e.g., reduced opacity or gray text), ended_early = badged with
  "ended early" label. SessionStateBadge handles the rendering.
- PR badge: weight = one styling, in_range_rep = another. Distinguishable
  but both readable. F8 (deeper visual distinction) is P1 deferred — your
  basic badge styling is sufficient.
- Bodyweight handling: when is_bodyweight=true on the exercise, render
  weight as "BW" (uppercase) instead of "0 lbs". This applies to PR
  Timeline rows specifically.
- formatSessionDisplayName must NOT use date-fns, dayjs, or luxon. Use
  native Intl.DateTimeFormat. This is a hard rule.

ACCEPTANCE CRITERIA: 21 ACs in spec/slices/SLICE_6_1_HISTORY_READ_SCAFFOLD.md
section 2. The most load-bearing for Codex:

- AC #2 (PR row format), AC #5 (toggle), AC #6 (empty states), AC #9 (All
  Sessions row format), AC #10 (state derivation), AC #12 (hybrid
  query, set_log_id IS NOT NULL filter), AC #18 (cross-link components
  used everywhere), AC #19 (placeholder routes), AC #20 (no schema
  changes, no new dependencies).

DO NOT:

- Modify any file outside the FILES TO CREATE list, except for verifying
  the bottom-nav History link is present (and report if it isn't, don't
  add it without asking).
- Add features beyond the slice scope (no Exercise Picker, no advanced
  visual differentiation, no chart, no Session Detail rendering, no
  date library, no animations).
- Leave placeholder TODOs or "implement later" comments.
- Invent column names. Use only the schema above.
- Add new RLS policies, migrations, or schema files.
- Add Recharts or any other new dependency.
- Introduce client components beyond PRTimelineShowAllToggle. Anything
  else stays Server Component.

OUTPUT:
Write the complete implementation. Do not explain — produce the code.
At the end, list:

- Every assumption you made that wasn't explicit in the spec.
- Every column name you referenced (so I can diff against the live schema).
- Any imports of the existing Supabase client — name the path you imported
  from. (Different prior slices may have used different patterns.)
- Any existing shadcn/ui components you reused (e.g., Badge, Card).
- Any place where you had to make a judgment call on styling (e.g., "I
  used text-purple-300 for the lilac accent; the existing pattern in
  Slice 5 used text-[#9b7fd4]" — flag the divergence so I can correct it).
- Confirmation of whether the bottom-nav History tab is already wired.

Final note: the queries use auth.uid() server-side via RLS. The Supabase
client invocation must be the server-side one (createClient from server
context, not the browser client). Using the wrong client will silently
return zero rows — verify you imported the right path.

## 8. Claude Code Quality Review Prompt (Phase 4B — MANDATORY after Codex)

CONTEXT:
Slice 6.1 of training-app just generated by Codex. The slice is the
History tab read scaffold — PR Timeline and All Sessions list, plus
cross-link components and data layer. Read-only, no schema changes,
no new dependencies.

Spec sources:

- spec/MASTER_SPEC.md §12 (product spec, ten sections)
- spec/ARCHITECTURE.md §16 (technical spec, seven sections)
- spec/slices/SLICE_6_1_HISTORY_READ_SCAFFOLD.md (this slice doc)

FILES CODEX TOUCHED (read every one):

Routes:

- src/app/(app)/history/page.tsx
- src/app/(app)/history/sessions/page.tsx
- src/app/(app)/history/exercises/[exercise_id]/page.tsx
- src/app/(app)/history/sessions/[completion_id]/page.tsx

Components:

- src/app/(app)/history/\_components/PRTimelineRow.tsx
- src/app/(app)/history/\_components/PRTimelineShowAllToggle.tsx
- src/app/(app)/history/\_components/AllSessionsRow.tsx
- src/app/(app)/history/\_components/SessionStateBadge.tsx
- src/app/(app)/history/\_components/PRTypeBadge.tsx
- src/app/(app)/history/\_components/HistoryHeaderLink.tsx

Data layer:

- src/lib/history/queries.ts
- src/lib/history/projections.ts
- src/lib/history/displayName.ts
- src/lib/history/crossLinks.ts

Shared:

- src/components/shared/ExerciseLink.tsx
- src/components/shared/SessionLink.tsx

Plus any modifications Codex flagged in its assumption list (e.g.,
bottom nav verification).

REVIEW CHECKLIST:
Read every file in the list above and address, in order:

1. Naming consistency. Variables, functions, types, route segments match
   ARCHITECTURE §16.2 file structure and §16.3 module map. Specifically
   check: type names match projections.ts exactly (PRTimelineRow,
   AllSessionsRow); function names match (getPRTimeline, getAllSessions,
   formatSessionDisplayName, exerciseProgressHref, sessionDetailHref,
   allSessionsHref); component names match (PRTimelineRow,
   AllSessionsRow, SessionStateBadge, etc.).

2. Error handling. Every Supabase query has error handling. Failed
   queries don't crash the page — they bubble to the route's error
   boundary or render a clear error state. Empty results are NOT
   errors.

3. Duplicated logic. State derivation logic (complete | in_progress |
   ended_early) should appear ONCE — in the query projection, not also
   in the component. Same for session_display_name formatting — should
   be called once in the projection, never duplicated in the component.
   Date formatting via formatSessionDisplayName should be the only path;
   no inline new Intl.DateTimeFormat() calls anywhere outside
   displayName.ts.

4. Dead code. Remove any unused imports, unused props, unused state,
   unused variables. Special check: Codex sometimes imports from
   next/link in PRTimelineRow or AllSessionsRow even though those
   routes only use ExerciseLink/SessionLink. If next/link is imported
   in a file that should only use the shared components, remove it.

5. Inefficiencies. Check for: N+1 query patterns (one query per row),
   unnecessary client components, redundant Supabase round trips. The
   getPRTimeline and getAllSessions functions should each be ONE
   round trip, with all JOINs done in a single SQL query.

6. Leftover TODOs, placeholder comments, stub functions, "implement
   later" notes. Codex should not have left any. If present, either
   complete or remove.

7. Missing .env.example entries. Slice 6.1 introduces no new env vars;
   verify .env.example is unchanged.

8. Schema fidelity. Every column reference in queries.ts matches the
   live schema in spec/slices/SLICE_6_1_HISTORY_READ_SCAFFOLD.md
   section 7 Codex prompt. Specifically check: pr_history.set_log_id
   filter (must be IS NOT NULL); the hybrid PR-count subquery in
   getAllSessions; the 90-day window on getPRTimeline.

9. Cross-link contract enforcement (AC #18). Search every component
   file for direct `import Link from 'next/link'` that targets
   /history/exercises/\* or /history/sessions/{completion_id}. If found
   in PRTimelineRow.tsx or AllSessionsRow.tsx (or their children), that's
   a contract violation — replace with ExerciseLink or SessionLink.
   Direct next/link is permitted in HistoryHeaderLink (for "All
   Sessions" header link to /history/sessions, which is the All
   Sessions list and not a per-completion-id link) and in
   PRTimelineShowAllToggle (for the toggle).

10. Bodyweight handling (edge case 10). Verify PRTimelineRow renders
    "BW" (or equivalent uppercase bodyweight indicator) when
    is_bodyweight = true on the exercise, NOT "0 lbs" or "0 kg".

11. Empty state copy (AC #6, #13). Verify the empty-state strings
    closely match the spec wording. Minor paraphrases are acceptable;
    fundamental rewrites are not.

12. Date library check (HARD RULE). Search for any import of date-fns,
    dayjs, luxon, or moment. There should be NONE. formatSessionDisplayName
    must use native Intl.DateTimeFormat.

13. Server / Client Component boundaries. PRTimelineShowAllToggle is
    the ONLY 'use client' component in this slice. All other components
    must be Server Components. Common drift: a Server Component
    accidentally using useState or useEffect, or 'use client' added
    "just to be safe."

14. Placeholder routes. Verify /history/exercises/[exercise_id]/page.tsx
    and /history/sessions/[completion_id]/page.tsx render minimal
    placeholders WITHOUT data fetching. They should not import
    queries.ts or call any data function.

AUTO-FIX vs FLAG:

Auto-fix (apply directly):

- Naming inconsistencies (rename to match contract)
- Missing error handling on queries
- Removed dead code, unused imports
- Replaced direct next/link with ExerciseLink/SessionLink where AC #18 requires
- Removed leftover TODOs
- Bodyweight rendering fix if missing
- Schema drift on column names
- Removed 'use client' from Server Components that don't need it

Flag for approval (do not change without my response):

- Structural changes that affect more than one file beyond this slice
- Refactors that alter the API contract or folder structure
- Subjective styling preferences (e.g., "I'd use Card from shadcn instead
  of a div" — only flag if there's a clear consistency win with prior slices)
- Adding new dependencies for any reason
- Changes to spec docs
- Empty-state copy fundamental rewrites

CONSTRAINTS:

- Do not add features beyond the 21 ACs.
- Do not change the folder structure from ARCHITECTURE §16.2.
- Do not modify files outside the slice's allowlist (FILES CODEX TOUCHED
  + bottom-nav verification).
- Minimal, surgical changes.

OUTPUT:
Summary with four parts:

1. Files changed and why (one line each).
2. Items flagged for my approval with reasoning.
3. Any issues to log in KNOWN_ISSUES.md or FUTURE_WORK.md.
4. Ready-for-testing verdict (yes / no — if no, what's blocking).

Specific findings I want surfaced if present:

- Did Codex use the correct Supabase server client import path?
- Did Codex preserve the hybrid PR-count query (FK + time window) or
  silently simplify it?
- Did Codex correctly handle bodyweight PR rendering?
- Are there any places where Codex used a date library despite the rule?
- Are placeholder routes truly placeholder (no data fetching)?
- Did the cross-link contract (AC #18) hold?

## 9. Claude Code Debugging Prompt (Phase 4C — fill in CURRENT PROBLEM if tests fail)

CONTEXT:
Slice 6.1 of training-app — History tab read scaffold (PR Timeline +
All Sessions). Codex generated, Claude Code quality review pass complete.
Now testing the user flows per slice doc section 6.

CURRENT PROBLEM:
[Fill in the exact error message, screenshot transcription, or description
of what isn't working. Be specific — "the PR Timeline doesn't render"
isn't enough. Include browser console errors, server logs, and the
specific test number from section 6 that failed.]

RELEVANT FILES:
[List the files involved based on the failure. Default starting points
for common failures:

- Empty PR Timeline despite data existing → src/lib/history/queries.ts
  (getPRTimeline), src/app/(app)/history/page.tsx
- Wrong session display name format → src/lib/history/displayName.ts
- Cross-link goes to wrong place → src/lib/history/crossLinks.ts,
  src/components/shared/ExerciseLink.tsx or SessionLink.tsx
- State badge shows wrong color/copy → src/app/(app)/history/\_components/
  SessionStateBadge.tsx, plus state derivation in queries.ts
- Show all toggle doesn't toggle → PRTimelineShowAllToggle.tsx, history/page.tsx
- Wrong PR count on All Sessions → getAllSessions hybrid query in queries.ts]

WHAT THE CODE CURRENTLY DOES:
[Brief summary — what's working, what's broken, any notable structural
choices that should be preserved. Reference the Codex assumption list
and the Claude Code review summary.]

CONSTRAINTS:

- Next.js 15 App Router, TypeScript strict, Tailwind + shadcn.
- Do not refactor outside the current problem.
- Do not add features beyond the 21 ACs.
- Do not change the folder structure from ARCHITECTURE §16.2.
- Do not add Recharts or any new dependency.
- Cross-link contract (AC #18): all exercise/session cross-links must
  go through ExerciseLink/SessionLink. Don't bypass.
- formatSessionDisplayName uses Intl.DateTimeFormat, never a date library.
- Schema is read-only — no migrations, no RLS changes.

ACCEPTANCE CRITERIA:
[Reference the failing AC by number, e.g.:

- AC #5 (Show all toggle) must work as specified.
- AC #12 (hybrid query, set_log_id IS NOT NULL filter) must hold.
- AC #18 (cross-link components in use everywhere).
  Reproduce the failure, then verify the fix against the named ACs.]

DO NOT:

- Rewrite files that are currently working.
- Add features outside the current fix.
- Change the folder structure from ARCHITECTURE §16.2.
- Generate a new slice from scratch — if that's what's needed, stop and
  tell me to take it to Codex first.
- Bypass the cross-link contract.

OUTPUT:
Fix the problem. Summarize what was changed, why, and list any follow-up
issues for the next session. If the fix surfaces a deeper architectural
issue or contradicts a Phase 1/2 decision, flag it before applying — do
not silently rewrite the spec.
