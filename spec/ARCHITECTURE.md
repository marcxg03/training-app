# ARCHITECTURE.md

## 1. Tech Stack Decision

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server components for data-heavy reads; client components for interactive surfaces. Already in stack. |
| Language | TypeScript (strict) | Catches schema-drift bugs at compile time. |
| Styling | Tailwind CSS | Utility-first matches dark/lilac design system. |
| UI primitives | shadcn/ui | Accessible Radix primitives, owned in-repo. |
| Icons | lucide-react | shadcn-native; consistent stroke weights. |
| Backend | Supabase (Postgres + Auth) | Postgres for relational integrity; RLS for user scoping; Auth for magic-link. |
| Auth | Supabase magic-link | Lowest-friction auth. Session via @supabase/ssr cookies. |
| State | React built-in + Supabase client cache | useState / useReducer / Context. No Redux, Zustand, SWR, or React Query. |
| Forms | React Hook Form + Zod | Uncontrolled inputs (no per-keystroke re-render). Zod schemas double as types. |
| Charts | Recharts | One chart in MVP (PR ladder). |
| PWA | @ducanh2912/next-pwa | Active fork with App Router support. Workbox under the hood. |
| Sync | Custom queue-on-failure | Direct Supabase writes; on failure, queue in localStorage with retry on reconnect. |
| Date | date-fns | Tree-shakeable. |
| Package mgr | pnpm | Faster than npm; strict deps; native Vercel support. |
| Runtime | Node 20 LTS | Stable across Vercel and Supabase SDKs. |
| Lint/format | ESLint + Prettier | Next.js defaults. Format on save. |

Decisions explicitly NOT made and why:
- No React Query / SWR. Single user, low concurrency. Direct Supabase
  queries with router.refresh() after mutations is enough.
- No Server Actions for mutations. Supabase client SDK from a client
  component is simpler for the Logger's offline-tolerant write path.
- No Drizzle / Prisma. Supabase JS client is the access layer.
  Migration files in /supabase/migrations/ are the schema source of
  truth.

## 2. File Inventory (Slice 5)

New files (Slice 5):
  src/lib/sync/queue.ts
  src/lib/sync/drain.ts
  src/lib/sync/handlers.ts
  src/lib/sync/classify.ts
  src/lib/sync/triggers.ts
  src/lib/sync/useQueueState.ts
  src/components/log/QueueIndicator.tsx
  src/components/log/QueuePanel.tsx

Modified files (Slice 5):
  src/components/log/LoggerShell.tsx
    — register drain triggers on mount
    — render <QueueIndicator /> in header slot
  src/components/log/SetEntryForm.tsx
    — on save failure, classify error; if retryable, enqueue;
      otherwise show inline error (current behavior)
    — pre-generate set_log_id client-side (UUID v4) before insert
      so retries are idempotent against the UNIQUE constraint
  src/components/log/LoggerShell.tsx (block_complete handler)
    — on "Done with this block" failure, same classify-and-route
      pattern as SetEntryForm
  src/components/log/SessionSummary.tsx
    — same pattern for "End session" / "End early" actions
  src/lib/auth/signOut.ts
    — check queue is non-empty for current user; if so, show
      confirmation modal; on confirm, proceed; on cancel, abort
  src/lib/supabase/types.ts
    — no changes (queue is localStorage, not DB)

Unchanged files (Slice 5):
  src/lib/pr-detection.ts (Slice 4 PR detection logic — invoked by
    handlers.ts after successful set_log_insert retry)
  All Slice 4 PR detection acceptance criteria still pass

## 3. File and Folder Structure

training-app/
├── .env.example
├── .env.local                  # gitignored
├── .gitignore
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── CHANGELOG.md
├── DECISIONS.md
├── KNOWN_ISSUES.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs             # next-pwa config
├── postcss.config.mjs
├── components.json             # shadcn config
│
├── public/
│   ├── manifest.webmanifest
│   ├── icons/                  # PWA icons (180, 192, 512)
│   ├── splash/                 # iOS splash images
│   └── favicon.ico
│
├── spec/
│   ├── PROJECT_BRIEF.md
│   ├── MASTER_SPEC.md
│   ├── ARCHITECTURE.md
│   └── slices/
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_init_auth_profile.sql
│   │   ├── 002_plan_structure.sql
│   │   ├── 003_logging.sql
│   │   ├── 004_pr_history.sql
│   │   ├── 005_nutrition.sql
│   │   ├── 006_plan_templates.sql
│   │   └── 007_rls_policies.sql
│   └── seed/
│       └── seed-from-wiki.ts
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── auth/callback/route.ts
│   │   ├── (app)/
│   │   │   ├── layout.tsx      # bottom tab bar
│   │   │   ├── today/
│   │   │   │   ├── page.tsx                     # 1A
│   │   │   │   ├── workout/[sessionId]/page.tsx # 1B
│   │   │   │   └── workout/[sessionId]/complete/page.tsx # 1C
│   │   │   ├── plan/
│   │   │   │   ├── page.tsx                     # 2A
│   │   │   │   └── [day]/page.tsx               # 2B
│   │   │   ├── history/                         # see §16 Tab 3 — History (Slice 6)
│   │   │   │   ├── page.tsx                     # PR Timeline
│   │   │   │   ├── exercises/[exercise_id]/page.tsx   # Exercise Progress
│   │   │   │   ├── sessions/page.tsx            # All Sessions list
│   │   │   │   └── sessions/[completion_id]/page.tsx  # Session Detail
│   │   │   ├── nutrition/
│   │   │   │   ├── page.tsx                     # 4A
│   │   │   │   └── log/page.tsx                 # 4B
│   │   │   └── settings/
│   │   │       ├── page.tsx                     # 5A
│   │   │       ├── plan/page.tsx                # 5B
│   │   │       ├── exercises/page.tsx           # 5C list
│   │   │       ├── exercises/[id]/page.tsx      # 5C edit
│   │   │       ├── targets/page.tsx             # 5D
│   │   │       ├── profile/page.tsx             # 5E
│   │   │       └── goal-mode/recommend/page.tsx # 5E.1
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn primitives
│   │   ├── layout/
│   │   │   └── BottomTabBar.tsx
│   │   ├── today/
│   │   ├── workout/
│   │   ├── plan/
│   │   ├── history/
│   │   ├── nutrition/
│   │   └── settings/
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts       # browser client
│   │   │   ├── server.ts       # server client
│   │   │   └── types.ts        # generated DB types
│   │   ├── methodology/
│   │   │   ├── pr-detection.ts
│   │   │   ├── day-type.ts
│   │   │   ├── meal-framework.ts
│   │   │   ├── schedule-rules.ts
│   │   │   └── goal-mode-defaults.ts
│   │   ├── sync/
│   │   │   ├── queue.ts
│   │   │   ├── retry.ts
│   │   │   └── set-log-writer.ts
│   │   ├── schemas/            # Zod schemas
│   │   │   ├── meal.ts
│   │   │   ├── set-log.ts
│   │   │   ├── plan.ts
│   │   │   ├── targets.ts
│   │   │   └── profile.ts
│   │   └── utils/
│   │       ├── macros.ts       # calorie derivation
│   │       ├── dates.ts
│   │       └── cn.ts           # tailwind merge
│   │
│   └── types/
│       └── domain.ts
│
└── tests/                      # placeholder folder, not in MVP

## 4. Module Map

One responsibility per module. Cross-cutting logic in src/lib/, scoped
to a single concern per file.

### Methodology layer (src/lib/methodology/)
- pr-detection.ts — Given a SetLog (exercise_id, weight, reps,
  set_type, prescribed_min, prescribed_max), returns
  { weight_pr: bool, in_range_rep_pr: bool }. Pure function. Reads
  current pr_history for that exercise. No side effects.
- day-type.ts — Given a list of today's sessions, returns the day-
  type label (Run + Lift / Lift Only / Two-Session / Rest / etc.).
  Pure function. No DB access.
- meal-framework.ts — Given a day-type and a goal_mode, returns the
  meal framework structure. Pure function.
- schedule-rules.ts — Given a proposed plan structure, returns
  { hard_violations: [...], soft_warnings: [...] }. Pure function.
- goal-mode-defaults.ts — Given a goal_mode, returns recommended
  macro target ranges. Pure function.

### Sync layer (src/lib/sync/)
- queue.ts — Reads/writes the localStorage offline queue.
  pending_writes key. Each entry is
  { id, table, payload, attempts, last_error }.

### Data access (src/lib/supabase/)
- client.ts — Browser Supabase client. Used in client components.
- server.ts — Server Supabase client (reads cookies). Used in server
  components and route handlers.
- types.ts — Generated by supabase gen types typescript.

No repository pattern. Server components query Supabase directly via
the server client; client components use the browser client.
Methodology functions take plain data, not DB rows.

### Sync layer (src/lib/sync/) — Slice 5 additions

src/lib/sync/
  queue.ts            // localStorage read/write; key namespacing per
                      // user_id; serialization; quota error handling
  drain.ts            // drainQueue() — re-entrant, dispatches each row
                      // by kind to its handler; manages drainState
                      // module-scope flag for re-entrancy guard
  handlers.ts         // per-kind handlers (set_log_insert,
                      // session_completion_start, _block_complete, _end);
                      // each handler returns { ok: boolean, retryable: boolean }
  classify.ts         // isRetryable(error | response) → boolean;
                      // single source of truth for retry classification
  triggers.ts         // setupDrainTriggers(): registers 'online' event
                      // listener and provides hooks for mount-time and
                      // manual-retry triggers
  pre-detect.ts       // (Slice 4 PR detection — UNCHANGED in Slice 5)
                      // imported by handlers.ts as a derived effect of
                      // successful set_log_insert retries

src/components/log/
  QueueIndicator.tsx  // dot indicator in Logger header; reads queue
                      // state via useQueueState() hook; renders gray /
                      // lilac / amber based on state
  QueuePanel.tsx      // expanded panel content; per-row list with
                      // attempt counts; manual retry button at bottom

src/lib/sync/
  useQueueState.ts    // React hook; subscribes to queue change events;
                      // returns { rows, drainState, lastDrainAt }

src/lib/auth/
  signOut.ts          // (existing module — MODIFIED in Slice 5 to add
                      // queue-non-empty check and confirmation modal
                      // gate before clearing session)

## 5. API Contract

There is no custom HTTP API in MVP. All data access is direct Supabase
client calls authenticated via the user's session. RLS policies
enforce per-user scoping at the database layer.

### Reads

getTodaySchedule(userId, date) →
  {
    sessions: Session[],
    blocks: Map<sessionId, Block[]>,
    inProgressWorkout: WorkoutSession | null,
    macroTotals: { cal, p, c, f },
    targets: NutritionTargets,
    dayType: DayTypeLabel
  }

getWorkoutContext(workoutSessionId) →
  {
    workoutSession: WorkoutSession,
    blocks: Block[],
    bankByBlock: Map<blockId, Exercise[]>,
    setLogs: SetLog[],
    prHistoryByExercise: Map<exerciseId, PRHistory[]>
  }

getActivePlan(userId) →
  {
    plan: TrainingPlan,
    schedules: DailySchedule[],
    sessionsBySchedule: Map<scheduleId, Session[]>
  }

// History tab read contract — see §16 Tab 3 — History (Slice 6) for the
// full Phase 2 spec. The four data-layer functions there
// (getPRTimeline, getExerciseProgress, getAllSessions,
// getSessionDetail) supersede the v0-era getPRTracker /
// getExercisePRHistory sketches.

getNutritionContext(userId, date) →
  {
    dayType: DayTypeLabel,
    framework: MealFramework,
    targets: NutritionTargets,
    todayEntries: MealEntry[],
    totals: { cal, p, c, f }
  }

### Writes

writeSetLog({
  workoutSessionId, blockId, exerciseId, setType,
  weightKg, reps, reachedFailure, prescribedMin, prescribedMax
}) → SetLog
// Side effect: PR detection runs server-side via DB trigger.
// Failure path: queued in localStorage; UI updates optimistically.

markSessionComplete({ sessionId, date }) → SessionCompletion

startWorkoutSession({ sessionId, date }) → WorkoutSession
completeWorkoutSession(workoutSessionId) → WorkoutSession
discardWorkoutSession(workoutSessionId) → void

writeMealEntry({
  date, mealType, proteinG, carbsG, fatG, note
}) → MealEntry
// Calories derived in client (P*4 + C*4 + F*9), stored in row.

savePlanStructure({ planId, dayChanges }) →
  | { ok: true, plan: TrainingPlan }
  | { ok: false, hardViolations: [...], softWarnings: [...] }
savePlanStructureWithOverride({ planId, dayChanges, ackWarnings }) →
  { ok: true, plan: TrainingPlan }

upsertExercise({
  exerciseId?, name, notes, prescribedMin, prescribedMax,
  muscleGroups, isCompound
}) → Exercise
addExerciseToBlock({ blockId, exerciseId }) → BlockExercise
removeExerciseFromBlock({ blockId, exerciseId }) → void

upsertProfile({ bodyweightKg, heightCm }) → Profile
setGoalMode({ goalMode }) → Profile
upsertNutritionTargets({ ...nineFields }) → NutritionTargets

## 6. Component / Function Contracts (Slice 5)

### queue.ts

  enqueue(row: QueueRow): void
    — writes row to localStorage under
      training-app:queue:<user_id>:<row.id>
    — throws QuotaExceededError on storage full; caller responsible
      for surfacing inline error
    — emits 'queue-change' event on window for useQueueState() to
      react to

  dequeue(rowId: string): void
    — removes row from localStorage
    — emits 'queue-change' event

  loadQueue(userId: string): QueueRow[]
    — scans localStorage for keys matching
      training-app:queue:<userId>:*
    — returns rows sorted by enqueued_at ascending
    — does NOT touch other users' queues

  updateAttempt(rowId: string, error: string | null): void
    — increments attempts counter
    — sets last_attempt_at to now
    — sets last_error to truncated error message (max 200 chars)
    — emits 'queue-change' event

### drain.ts

  drainQueue(userId: string): Promise<DrainResult>
    — re-entrancy guard: if drainState.inProgress, returns immediately
      with { skipped: true }
    — sets drainState.inProgress = true
    — loads queue via queue.loadQueue(userId)
    — for each row in order: dispatch to handlers[row.kind](row)
      • on { ok: true }: dequeue(row.id); run derived effects
        (pr-detect for set_log_insert kind only)
      • on { ok: false, retryable: true }: updateAttempt(row.id);
        leave row in queue; continue to next row
      • on { ok: false, retryable: false }: this should not happen
        in the queue layer (retryable check happens at enqueue
        time); log error, leave row in queue, continue
    — sets drainState.inProgress = false
    — sets drainState.lastDrainAt = now
    — returns { skipped: false, succeeded: number, failed: number }

  drainState (module-scope, not exported):
    inProgress: boolean
    lastDrainAt: ISO timestamp | null

### handlers.ts

  HandlerResult: { ok: boolean, retryable: boolean }

  handlers: Record<QueueRow['kind'], (row: QueueRow) => Promise<HandlerResult>>

  set_log_insert handler:
    — POSTs to Supabase set_logs with row.payload
    — on success: returns { ok: true, retryable: false }
      → drain.ts will trigger pr-detection.runDetection()
        with the inserted set_log
    — on 23505 / 409 (UNIQUE violation): returns { ok: true, retryable: false }
      → row already exists in DB from earlier successful retry;
        drain.ts will STILL trigger pr-detection (idempotent via
        existing pr_history UNIQUE)
    — on retryable error: returns { ok: false, retryable: true }
    — on non-retryable error: returns { ok: false, retryable: false }
      (logged; should not happen if enqueue did its job)

  session_completion_start handler:
    — INSERT into session_completions with payload
    — on UNIQUE violation (re-start of existing completion):
      returns { ok: true, retryable: false } (idempotent)

  session_completion_block_complete handler:
    — UPDATE session_completions SET completed_block_ids =
        array_append(completed_block_ids, $1)
        WHERE completion_id = $2
        AND NOT ($1 = ANY(completed_block_ids))
    — the WHERE clause makes this idempotent on retry
    — on 0 rows affected: still returns { ok: true, retryable: false }
      (block was already in array — success)

  session_completion_end handler:
    — UPDATE session_completions SET completed_at = $1,
        was_ended_early = $2 WHERE completion_id = $3
    — idempotent by nature (UPDATE to same values is no-op)

### classify.ts

  isRetryable(errorOrResponse: Error | Response): boolean
    — Error (network failure, fetch abort, etc.): true
    — Response with status 408, 429, 5xx: true
    — Response with status 4xx other: false
    — Response with status 2xx: never reaches this function (success path)
    — Response with status 23505 (Postgres) / 409 (HTTP):
      false IF first attempt (real conflict, surface to user);
      true IF on retry (idempotency boundary, treated as success
      in handlers.ts before this fn is consulted)

### triggers.ts

  setupDrainTriggers(userId: string): () => void
    — registers window 'online' event listener → calls drainQueue(userId)
    — returns cleanup function for useEffect deregistration
    — does NOT register mount-time trigger (caller's responsibility,
      see LoggerShell integration below)

### useQueueState.ts

  useQueueState(userId: string): {
    rows: QueueRow[]
    drainState: { inProgress: boolean, lastDrainAt: string | null }
    pendingCount: number  // rows.length, but cached
  }
    — subscribes to 'queue-change' window events
    — re-reads queue on event fire
    — re-reads drainState on event fire
    — cleanup on unmount

## 7. State Management

Three layers:

### Server-rendered initial state
Server components fetch initial data per route. No client fetch on
first paint for any tab.

### Client mutations + revalidation
Client components mutate via Supabase browser client. After a
successful write, call router.refresh() to re-fetch server data. For
optimistic UX (Logger), the mutation updates local React state
immediately and refreshes server data in the background.

### Cross-component state
One piece of UI state crosses component boundaries; it uses Context:
- ActiveWorkoutSession — read by the bottom tab bar, written by the
  Logger.

Everything else is local state inside the route or component that
owns it. No global store.

### Slice 5 — queue layer hybrid state pattern

The queue layer uses a hybrid state pattern:

- localStorage is the source of truth (durable across reloads)
- React state in useQueueState() is a cache, updated via
  'queue-change' events
- Module-scope drainState in drain.ts is the source of truth for
  in-progress flag (not React state, because it must persist across
  hook unmounts during drain)

This is intentionally NOT in a global store (Zustand, Redux, etc.).
The whole point of the queue is durability beyond React's lifecycle;
storing it in React state would defeat that. The 'queue-change' event
pattern is sufficient for the limited UI consumers (QueueIndicator,
QueuePanel) without needing a full state management layer.

## 8. Auth Flow

Supabase magic-link, three steps end-to-end.

1. User visits /login
2. Enters email → supabase.auth.signInWithOtp({ email })
3. Email arrives, user taps link → /auth/callback?code=xxx
4. /auth/callback (route handler) calls
   supabase.auth.exchangeCodeForSession
5. Session cookie set via @supabase/ssr cookie helpers
6. Redirect to /today

/today and every other authenticated route are wrapped in the (app)
route group with a layout that:
1. Reads the session via the server Supabase client
2. Redirects to /login if no session
3. Reads the user's profile (or creates a default one if first login)
4. Renders the bottom tab bar

Middleware refreshes the session on every request (handled by
@supabase/ssr's updateSession helper).

First-login profile creation is automatic: on the first session
exchange, the auth callback also inserts a default profiles row with
goal_mode = 'maintain' and null bodyweight/height.

### Slice 5 — sign-out flow modification

Sign-out flow is modified in Slice 5:

1. User taps "Sign out" in Settings (or wherever sign-out is exposed)
2. signOut.ts checks queue.loadQueue(currentUserId).length > 0
   - If false: proceed with existing Supabase signOut() flow
   - If true: open confirmation modal
     • Modal: "You have N unsynced sets. They'll be saved next time
       you sign in to this account on this device."
     • Buttons: [Cancel] [Sign out anyway]
     • On Cancel: close modal, do nothing
     • On Sign out anyway: proceed with Supabase signOut()
3. The queue is NOT cleared on sign-out. It persists in localStorage
   under its user_id-namespaced keys until that user signs back in
   (which triggers loadQueue(userId) and a drain attempt).

## 9. Key Dependencies

next, react, react-dom, typescript
@supabase/supabase-js, @supabase/ssr
@ducanh2912/next-pwa
tailwindcss, postcss, autoprefixer
class-variance-authority, clsx, tailwind-merge
lucide-react
react-hook-form, zod, @hookform/resolvers
recharts
date-fns
@dnd-kit/core, @dnd-kit/sortable

Dev: eslint, eslint-config-next, prettier, prettier-plugin-tailwindcss,
@types/node, @types/react, @types/react-dom, supabase (CLI).

Deliberately excluded: zustand, redux, jotai, swr, tanstack-query,
prisma, drizzle, axios, lodash, moment, sentry, posthog,
react-icons.

### Slice 5 — no additions

No new packages. Slice 5 uses:
- localStorage (built-in browser API)
- crypto.randomUUID() (built-in for client-side UUID generation)
- Existing @supabase/ssr client (no new SDK)
- Existing React hooks (no new state management library)

## 10. Schema Details and RLS Policies

### Migration file order
001_init_auth_profile.sql        — profiles, default goal_mode
002_plan_structure.sql           — plans, schedules, sessions, blocks,
                                   exercises, block_exercises
003_logging.sql                  — workout_sessions, set_logs,
                                   session_completions
004_pr_history.sql               — pr_history (append-only)
005_nutrition.sql                — nutrition_targets, meal_entries
006_plan_templates.sql           — plan_templates (Phase 4)
007_rls_policies.sql             — RLS enabled + policies on all
                                   tables

### RLS pattern (all user-scoped tables)
Every user-scoped table gets four policies:

CREATE POLICY "select_own" ON <table>
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON <table>
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON <table>
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON <table>
  FOR DELETE USING (auth.uid() = user_id);

pr_history and set_logs get only SELECT and INSERT — no UPDATE, no
DELETE — to enforce append-only at the DB layer.

### Key indexes
CREATE INDEX idx_pr_history_exercise_user
  ON pr_history (user_id, exercise_id, weight_kg DESC, reps DESC);
CREATE INDEX idx_set_logs_workout
  ON set_logs (workout_session_id, block_id);
CREATE INDEX idx_set_logs_exercise_user
  ON set_logs (user_id, exercise_id, logged_at DESC);
CREATE INDEX idx_meal_entries_user_date
  ON meal_entries (user_id, date);
CREATE INDEX idx_workout_sessions_user_status
  ON workout_sessions (user_id, status, started_at DESC);

## 11. PR Detection Implementation

Pure function in src/lib/methodology/pr-detection.ts. Runs after every
successful W1 or W2 SetLog write (server-side via a DB trigger as
canonical truth; client-side optimistically for instant UI flag).

Input: { exercise_id, weight_kg, reps, set_type,
         prescribed_min, prescribed_max, user_id }

Skip if set_type is WU or mobility.

Type A (Weight PR / "ladder"):
  current_max_weight =
    SELECT MAX(weight_kg) FROM pr_history
     WHERE user_id = $u AND exercise_id = $e AND pr_type = 'weight'
  if weight_kg > current_max_weight (or null):
    INSERT INTO pr_history (..., pr_type='weight', ...)
    return weight_pr = true

Type B (In-Range Rep PR):
  if reps NOT BETWEEN prescribed_min AND prescribed_max:
    return in_range_rep_pr = false
  prev_best_in_range_at_weight =
    SELECT MAX(reps) FROM pr_history
     WHERE user_id = $u AND exercise_id = $e
       AND pr_type = 'in_range_rep' AND weight_kg = $w
  if reps > prev_best_in_range_at_weight (or null):
    INSERT INTO pr_history (..., pr_type='in_range_rep', ...)
    return in_range_rep_pr = true

Both checks run on every qualifying set; both can fire on the same
set. PRHistory entries reference the originating SetLog by set_log_id
for traceability.

DB trigger: AFTER INSERT trigger on set_logs calls a pl/pgsql function
that runs detection and inserts pr_history rows in the same
transaction.

## 12. Sync Strategy — Queue-on-Failure

The queue-on-failure pattern is locked across three sections of this
document and one section of MASTER_SPEC.md. This section exists as
the navigational anchor.

For the canonical end-to-end save → enqueue → drain → success flow,
see §13 Critical Path: Queue Lifecycle. For module-by-module
contracts (queue.ts, drain.ts, handlers.ts, classify.ts, triggers.ts,
useQueueState.ts), see §6 Component / Function Contracts (Slice 5).
For idempotency, retry classification, durability envelope, and the
explicit out-of-scope items (cross-device sync, retry cap, periodic
drain), see MASTER_SPEC.md §8 Sync semantics.

The queue handles four operation kinds: set_log_insert,
session_completion_start, session_completion_block_complete, and
session_completion_end. Pr_history is not queued — it is recomputed
client-side as a derived effect of successful set_log_insert retries
(see §11 PR Detection Implementation, unchanged from Slice 4).

## 13. Critical Path: Queue Lifecycle

This is the canonical path through the queue layer for a save that
fails and recovers. Reading this end-to-end is the fastest way to
understand the whole subsystem.

1. User taps "Save set" in SetEntryForm.
2. SetEntryForm validates input client-side. If invalid (empty weight
   etc.), shows inline error and stops. (Slice 4 behavior, unchanged.)
3. SetEntryForm pre-generates set_log_id (UUID v4 client-side).
4. SetEntryForm POSTs to Supabase set_logs.
5. Path A — Success: row inserted, response returned, SetEntryForm
   updates local state to show the saved set, advances to next set
   form. PR detection runs on the response. Done.
6. Path B — Failure: response (or thrown error) classified by
   isRetryable():
   - Not retryable (validation, schema mismatch, auth): SetEntryForm
     shows inline error. (Slice 4 behavior, unchanged.) Done.
   - Retryable (network, 5xx, etc.): SetEntryForm calls
     queue.enqueue({ kind: 'set_log_insert', id: <uuid>,
     payload: { set_log_id, ...form data }, attempts: 0,
     enqueued_at: now, last_attempt_at: null, last_error: null }).
     SetEntryForm updates local state to show the set as "saved
     locally — will sync" (UI to be designed during slice doc).
     Advances to next set form. Drain attempt fires (best-effort).
7. Drain fires (from any of: 'online' event, mount, manual retry):
8. drainQueue() acquires drainState.inProgress lock.
9. drainQueue() loads queue rows for current user.
10. For each row: handler dispatched.
11. set_log_insert handler POSTs to set_logs.
    - Success: row removed from queue. PR detection runs.
    - 23505 (already exists): row removed from queue (idempotent).
      PR detection still runs (idempotent at pr_history layer).
    - Retryable error: row stays, attempts incremented, error logged.
    - Non-retryable error: row stays (logged, should not happen).
12. drainQueue() releases lock. emits 'queue-change'.
13. QueueIndicator re-renders (via useQueueState). Color updates.
14. If queue is empty: dot turns gray. If still has rows: dot stays
    amber. If drain is in progress at any point: dot is lilac with
    pulse animation.

The same critical path applies to the three session_completion
handlers, with the database operation differing per handler kind
but the queue mechanics identical.

## 14. Module Boundaries — What Lives Where

The most common drift in past projects was logic creeping out of the
methodology layer into UI components. The rules:

- src/lib/methodology/ is pure. No Supabase imports. No React. Pure
  functions over plain data. Unit-testable without a DB.
- src/lib/sync/ knows about Supabase and localStorage. No React. No
  methodology logic.
- src/components/ is React-only. Reads methodology functions and
  Supabase clients. Owns presentation. No business rules in components
  beyond simple display logic.
- src/app/ is routes only. Pages own data fetching and pass props to
  components.

If a slice asks Codex to put PR-detection logic inside the Logger
component, the quality review pass moves it to pr-detection.ts.

## 15. Goal Mode Recommendation Flow

User selects new goal_mode in 5E (Profile). On save:
1. setGoalMode({ goalMode }) writes to profiles.
2. Frontend reads recommended defaults from goal-mode-defaults.ts.
3. Reads current nutrition_targets.
4. Routes to /settings/goal-mode/recommend (5E.1) with both sets of
   values.
5. UI shows side-by-side: current vs recommended for cal/p/c/f (min
   and max each — eight rows total).
6. Per-row toggle: "apply this default."
7. Save writes only the toggled fields to nutrition_targets.

If the user backs out of 5E.1 without saving, profile.goal_mode is
already updated but targets are unchanged. The mode change itself is
the user's commitment; applying defaults is a separate, granular
decision.

## 16. Tab 3 — History (Slice 6)

> Per MASTER_SPEC §12 (History tab, ten-section spec). Read-only — no
> schema/RLS/auth changes. Phase 0 Discovery decisions logged in
> DECISIONS.md "Slice 6 — History tab Discovery decisions (May 2, 2026)".

### 1. Tech Stack Decision

Slice 6 inherits the Slices 1–5 stack with one addition. No removals, no substitutions.

Inherited from prior slices, unchanged:

- Next.js 15 App Router with React 19
- TypeScript strict mode
- Tailwind CSS + shadcn/ui (existing component library)
- Supabase JS client v2.x (existing instance, RLS enforced)
- pnpm + Node 20 LTS
- @ducanh2912/next-pwa (PWA wrapper, unaffected by Slice 6)
- Existing dark theme tokens (#000 background, #9b7fd4 lilac accent)

New dependency:

- recharts — charting library for the Exercise Progress weight-over-time line chart. React-native, declarative API, mobile-friendly defaults, small bundle relative to Chart.js or D3-based alternatives. Version pinned in §7 Key Dependencies, resolves MASTER_SPEC §12.10 Q3.

Rationale: Recharts was selected during Phase 0 Discovery for fit with the existing React/shadcn idiom and bundle size. The single line chart in Exercise Progress is a Recharts Cartesian LineChart with date-typed x-axis and weight_kg-typed y-axis — a primitive use of the library, no exotic features. If Recharts ever needs to be swapped (e.g., for visx or react-chartjs-2), the swap surface is contained to a single client component (see §3 Module Map).

Server Components vs Client Components split:

- Server Components: route entries (page.tsx) for /history, /history/exercises/[exercise_id], /history/sessions, /history/sessions/[completion_id]. Data fetching happens in these.
- Client Components: only the chart + "Show all" toggle in Exercise Progress, and the "Show all" toggle in PR Timeline. State is local to these components; no global store.

This split serves three goals: smaller client bundle (no Supabase client shipped to browser), faster first paint (HTML streamed with data), and clean RLS enforcement (queries always run server-side with the user's auth context).

### 2. File / Folder Structure

```
src/
├── app/
│   └── (app)/
│       └── history/
│           ├── page.tsx                              # PR Timeline (server)
│           ├── exercises/
│           │   └── [exercise_id]/
│           │       └── page.tsx                      # Exercise Progress (server)
│           ├── sessions/
│           │   ├── page.tsx                          # All Sessions list (server)
│           │   └── [completion_id]/
│           │       └── page.tsx                      # Session Detail (server)
│           └── _components/
│               ├── PRTimelineRow.tsx                 # Server, presentational
│               ├── PRTimelineShowAllToggle.tsx       # Client, local state
│               ├── ExerciseProgressChart.tsx         # Client, Recharts
│               ├── ExerciseProgressShowAllToggle.tsx # Client, local state
│               ├── ExerciseProgressSetLogList.tsx    # Server, presentational
│               ├── AllSessionsRow.tsx                # Server, presentational
│               ├── SessionDetailBlock.tsx            # Server, presentational
│               ├── SessionStateBadge.tsx             # Server, presentational
│               ├── PRTypeBadge.tsx                   # Server, presentational
│               └── HistoryHeaderLink.tsx             # Server, "All Sessions" link
│
├── lib/
│   └── history/
│       ├── queries.ts          # All Supabase read queries for History
│       ├── projections.ts      # Pseudo-schema → TS types from MASTER_SPEC §12.6
│       ├── displayName.ts      # Session display name formatting (Q1 resolution)
│       └── crossLinks.ts       # Cross-link href construction (F6 contract)
│
└── components/
    └── shared/
        ├── ExerciseLink.tsx    # Cross-cutting exercise→progress link (F6)
        └── SessionLink.tsx     # Cross-cutting session→detail link (F6)
```

Key structural decisions:

- Routes live under `src/app/(app)/history/` matching the existing `(app)` route group convention used by Logger and Settings in prior slices.
- `_components/` (with leading underscore) is an internal route-scoped components folder; Next.js App Router treats it as private to the route subtree. History-specific components that aren't reused live here.
- The two cross-link components (ExerciseLink, SessionLink) live in `src/components/shared/` not in History's `_components/`, because the F6 cross-link contract from MASTER_SPEC §12.4 says exercise names and session captions should be tappable everywhere — these components must be importable from outside History (e.g., when Slice 7's Plan tab needs to link into a session). Sharing them now prevents Slice 7 from re-implementing the same link semantics.
- `src/lib/history/` is the data layer. Components import from here; they do not call Supabase directly. This is the same pattern Slice 5 used for sync-layer modules.

### 3. Module Map

Each module has a single clear responsibility. The list maps cleanly to the file structure in §2.

#### Data layer modules (src/lib/history/)

**queries.ts**

Responsibility: All Supabase read queries for History surfaces. Exports one function per surface, each returning the corresponding projection type from MASTER_SPEC §12.6.

Exports:

- `getPRTimeline(opts: { showAll: boolean }): Promise<PRTimelineRow[]>`
- `getExerciseProgress(exerciseId: string, opts: { showAll: boolean }): Promise<ExerciseProgressData>` where `ExerciseProgressData = { currentPR: PRTimelineRow | null; chartPoints: ExerciseProgressChartPoint[]; setLog: ExerciseProgressSetLogRow[]; exercise: { id, name, is_bodyweight } }`
- `getAllSessions(): Promise<AllSessionsRow[]>`
- `getSessionDetail(completionId: string): Promise<SessionDetailData>` where `SessionDetailData = { session: { name, started_at, completed_at, was_ended_early, state }; blocks: SessionDetailBlock[] }`

Constraint: never imports React, never returns JSX. Pure data functions. Always called from Server Components.

**projections.ts**

Responsibility: TypeScript type definitions for the pseudo-schemas in MASTER_SPEC §12.6 Data Model.

Exports the seven types: PRTimelineRow, ExerciseProgressChartPoint, ExerciseProgressSetLogRow, AllSessionsRow, SessionDetailBlock, SessionDetailSet, plus the two composite return types (ExerciseProgressData, SessionDetailData) used by queries.ts.

**displayName.ts**

Responsibility: Format `session_display_name` consistently across surfaces. Resolves MASTER_SPEC §12.10 Q1.

Decision: Format (a) — `<sessions.name> · <formatted_date>` — confirmed. Date format: "MMM D" for current year, "MMM D, YYYY" for prior years. Examples: "Pull · May 1", "Lower ATG · Dec 12, 2025".

Exports:

- `formatSessionDisplayName(sessionName: string, startedAt: Date): string`

This is a one-liner module, but isolating it serves three purposes: (1) all surfaces use the same format without copy-paste; (2) future format changes are one-file; (3) queries.ts can call it during projection rather than duplicating the format logic in SQL or per-component.

**crossLinks.ts**

Responsibility: Build href strings for F6 cross-link navigation contract. One source of truth for the URL shape.

Exports:

- `exerciseProgressHref(exerciseId: string): string` → `/history/exercises/{exerciseId}`
- `sessionDetailHref(completionId: string): string` → `/history/sessions/{completionId}`
- `allSessionsHref(): string` → `/history/sessions`

If the URL shape ever changes, this is the only file to edit. ExerciseLink and SessionLink (the shared components) consume from here.

#### Component modules

PR Timeline route (page.tsx):

- Calls `getPRTimeline({ showAll })` server-side
- Renders `<PRTimelineRow>` per row
- Renders `<PRTimelineShowAllToggle>` (client) at the bottom

PRTimelineRow.tsx:

- Server component, presentational
- Renders one row: exercise name (via ExerciseLink), PR type badge, weight × reps, session caption (via SessionLink)

PRTimelineShowAllToggle.tsx:

- Client component
- Local state: `showAll: boolean`
- On toggle, navigates to `/history?showAll=1` (or back to `/history`)
- Server route reads the query param and passes to `getPRTimeline`

Exercise Progress route (page.tsx):

- Receives `exercise_id` route param
- Calls `getExerciseProgress(exerciseId, { showAll })` server-side
- Renders header (current PR), `<ExerciseProgressChart>` (client), `<ExerciseProgressSetLogList>`, `<ExerciseProgressShowAllToggle>` (client)

ExerciseProgressChart.tsx:

- Client component (because Recharts mounts in the browser DOM)
- Receives `chartPoints: ExerciseProgressChartPoint[]` as props
- Renders a Recharts LineChart with `weight_kg` over `logged_at`
- Dots colored by `pr_type` field per Phase 0 Discovery decision 4
- Empty state: hides the chart entirely if `chartPoints.length === 0`

ExerciseProgressSetLogList.tsx:

- Server component, presentational
- Receives `setLog: ExerciseProgressSetLogRow[]` as props
- Renders chronologically newest-first with full set detail

ExerciseProgressShowAllToggle.tsx:

- Client component, mirror of PRTimelineShowAllToggle pattern
- Toggles `?showAll=1` query param

All Sessions route (page.tsx):

- Calls `getAllSessions()` server-side
- Renders `<AllSessionsRow>` per row

AllSessionsRow.tsx:

- Server component, presentational
- Renders one row: session display name (via SessionLink), date, `<SessionStateBadge>`, blocks-completed summary, PR count if > 0

SessionStateBadge.tsx:

- Server component, presentational
- Receives `state: 'complete' | 'in_progress' | 'ended_early'`
- Returns appropriate badge styling

Session Detail route (page.tsx):

- Receives `completion_id` route param
- Calls `getSessionDetail(completionId)` server-side
- Renders session header, then `<SessionDetailBlock>` per block

SessionDetailBlock.tsx:

- Server component, presentational
- Receives one `SessionDetailBlock` projection
- Renders block name, exercise (via ExerciseLink), all sets

PRTypeBadge.tsx:

- Server component, presentational
- Receives `pr_type: 'weight' | 'in_range_rep'`
- Returns badge with appropriate label (P1 feature F8 — visual distinction)

HistoryHeaderLink.tsx:

- Server component, presentational
- Renders the "All Sessions" link as a header affordance
- Used on `/history` and `/history/exercises/[id]` (and could be used on Session Detail too, but redundant since you came from there)

#### Shared cross-link components (src/components/shared/)

ExerciseLink.tsx:

- Server component
- Receives `exerciseId: string`, `children: ReactNode`
- Wraps children in a Next.js `<Link href={exerciseProgressHref(exerciseId)}>`
- Single source of truth for "exercise name → progress view" navigation
- Importable by any future slice that displays exercise names

SessionLink.tsx:

- Same pattern, for session captions → Session Detail
- Importable by any future slice that displays session references

### 4. API Contract

Every History query is a server-side Supabase call. No HTTP API endpoints are introduced — all data fetching is in-process inside Server Components via the existing Supabase server client.

The "API Contract" here documents the four data-layer functions in `src/lib/history/queries.ts`, since those are the read contract that the UI layer consumes.

#### `getPRTimeline(opts)`

Input:

- `opts.showAll: boolean` — false: 90-day window; true: full history

Returns: `PRTimelineRow[]` ordered by `achieved_at DESC`.

Query shape:

```sql
SELECT
  pr.pr_id, pr.achieved_at, pr.pr_type, pr.weight_kg, pr.reps,
  ex.exercise_id, ex.name AS exercise_name, ex.is_bodyweight,
  sl.set_log_id, sl.session_id,
  sc.completion_id, sc.started_at,
  s.name AS session_name
FROM pr_history pr
JOIN exercises ex ON ex.exercise_id = pr.exercise_id
JOIN set_logs sl ON sl.set_log_id = pr.set_log_id
JOIN session_completions sc
  ON sc.session_id = sl.session_id
  AND sc.user_id = pr.user_id
  AND sc.started_at <= pr.achieved_at
  AND (sc.completed_at IS NULL OR sc.completed_at >= pr.achieved_at)
JOIN sessions s ON s.session_id = sc.session_id
WHERE pr.user_id = auth.uid()
  AND pr.set_log_id IS NOT NULL  -- skips rows where FK is NULL (see Q2 resolution)
  -- AND pr.achieved_at >= now() - interval '90 days'  -- omitted if showAll
ORDER BY pr.achieved_at DESC
```

The application then constructs `session_display_name` via `formatSessionDisplayName(session_name, started_at)` in projection.ts.

#### `getExerciseProgress(exerciseId, opts)`

Input:

- `exerciseId: string` — UUID, validated at route layer
- `opts.showAll: boolean` — false: 6-month window; true: full history

Returns: `ExerciseProgressData`.

Three sub-queries (or one with subqueries; Phase 4 implementation choice):

Query 1 — Current PR header:

```sql
SELECT pr_id, pr_type, weight_kg, reps, achieved_at
FROM pr_history
WHERE user_id = auth.uid() AND exercise_id = $1
ORDER BY achieved_at DESC
LIMIT 1
```

Query 2 — Chart points + set log (same data, two presentations):

```sql
SELECT
  sl.set_log_id, sl.logged_at, sl.weight_kg, sl.reps, sl.set_index,
  sl.is_to_failure, sl.notes,
  pr.pr_type AS pr_badge
FROM set_logs sl
LEFT JOIN pr_history pr ON pr.set_log_id = sl.set_log_id
WHERE sl.user_id = auth.uid() AND sl.exercise_id = $1
  -- AND sl.logged_at >= now() - interval '6 months'  -- omitted if showAll
ORDER BY sl.logged_at ASC
```

Query 3 — Exercise metadata:

```sql
SELECT exercise_id, name, is_bodyweight
FROM exercises
WHERE exercise_id = $1
```

(Slice 6 implementation may roll Query 3 into Query 2's JOIN if performance warrants; spec only requires the data is reachable.)

#### `getAllSessions()`

Input: none.

Returns: `AllSessionsRow[]` ordered by `started_at DESC`.

Query shape:

```sql
SELECT
  sc.completion_id, sc.started_at, sc.completed_at, sc.was_ended_early,
  sc.session_id,
  s.name AS session_name,
  array_length(sc.completed_block_ids, 1) AS blocks_completed_count,
  (SELECT COUNT(*) FROM blocks b WHERE b.session_id = sc.session_id) AS blocks_total_count,
  (SELECT COUNT(*) FROM pr_history pr
   JOIN set_logs sl ON sl.set_log_id = pr.set_log_id
   WHERE pr.user_id = sc.user_id
     AND sl.session_id = sc.session_id
     AND pr.achieved_at >= sc.started_at
     AND pr.achieved_at <= COALESCE(sc.completed_at, now())) AS pr_count
FROM session_completions sc
JOIN sessions s ON s.session_id = sc.session_id
WHERE sc.user_id = auth.uid()
ORDER BY sc.started_at DESC
```

The pr_count subquery uses BOTH the FK join (`sl.set_log_id = pr.set_log_id`) AND the time-window check (`achieved_at BETWEEN started_at AND completed_at`) — see Q2 resolution below for why this hybrid is correct.

State derivation (in projection):

- `completed_at IS NOT NULL AND was_ended_early = false` → `'complete'`
- `was_ended_early = true` → `'ended_early'`
- otherwise (i.e., `completed_at IS NULL AND was_ended_early = false`) → `'in_progress'`

#### `getSessionDetail(completionId)`

Input:

- `completionId: string` — UUID, validated at route layer

Returns: `SessionDetailData`.

Three sub-queries:

Query 1 — Session header:

```sql
SELECT sc.completion_id, sc.started_at, sc.completed_at,
       sc.was_ended_early, sc.completed_block_ids,
       s.name AS session_name, s.session_id
FROM session_completions sc
JOIN sessions s ON s.session_id = sc.session_id
WHERE sc.completion_id = $1 AND sc.user_id = auth.uid()
```

Query 2 — Blocks for this session template:

```sql
SELECT block_id, name, protocol_type, order_index, prescribed_min, prescribed_max
FROM blocks
WHERE session_id = $session_id_from_query_1
ORDER BY order_index ASC
```

Query 3 — Sets logged in this session, with PR badges:

```sql
SELECT
  sl.set_log_id, sl.block_id, sl.exercise_id, sl.set_index,
  sl.weight_kg, sl.reps, sl.is_to_failure, sl.notes,
  ex.name AS exercise_name,
  pr.pr_type AS pr_badge
FROM set_logs sl
JOIN exercises ex ON ex.exercise_id = sl.exercise_id
LEFT JOIN pr_history pr ON pr.set_log_id = sl.set_log_id
WHERE sl.user_id = auth.uid()
  AND sl.session_id = (SELECT session_id FROM session_completions WHERE completion_id = $1)
ORDER BY sl.block_id, sl.set_index ASC
```

The application assembles `SessionDetailBlock[]` by grouping Query 3 results by `block_id`, joining against Query 2 for block metadata. Blocks with no sets logged get `sets: []` and `exercise_id: null, exercise_name: null`. Block `was_completed` is derived: `block_id IN session.completed_block_ids`.

#### Resolution of MASTER_SPEC §12.10 Q2: PR-count-per-session derivation

Decision: hybrid query — filter by both `set_log_id` FK AND time-window.

Reasoning: The FK is more correct in principle (a PR is unambiguously tied to a specific set_log, not just a time range), but the FK is intermittently NULL per the KNOWN_ISSUES.md entry. The time-window-only approach risks attributing a PR to the wrong session if two sessions overlap in time (which shouldn't happen per the workout flow but is a real edge case across timezones or app glitches).

The hybrid: `JOIN pr_history.set_log_id → set_logs.session_id` AND `pr.achieved_at BETWEEN sc.started_at AND COALESCE(sc.completed_at, now())`.

If `set_log_id` is NULL on a pr_history row, that row is excluded from the count. This is acceptable because:

- The known-issue says FK population is intermittent, not zero. In Slice 5 verification, recent rows had populated FKs.
- A small undercount in PR count per session is preferable to incorrect attribution.
- The downstream consequence is: KNOWN_ISSUES.md `pr_history.set_log_id` entry stays at 🟢 Low (we accept the undercount), with a note that the PR count display in All Sessions may be slightly low for older sessions where the FK wasn't populated. Add an entry to FUTURE_WORK.md to backfill `set_log_id` on legacy rows when convenient.

PR Timeline (`getPRTimeline`) takes the same approach: `WHERE pr.set_log_id IS NOT NULL` filters out rows with NULL FKs to avoid JOIN failures. Rows with NULL FKs simply don't appear in PR Timeline. Acceptable trade-off for the same reasons.

### 5. State Management

Slice 6 is read-side. State management is minimal — three categories, all local in scope. No global store, no React Context for History data, no Redux/Zustand. The Server Component / Client Component split in §1 does the heavy lifting; remaining state is per-component.

#### 5.1 Server-side data state

All data state lives server-side and is fetched per-request inside Server Components. There is no client-side cache for History data, no SWR or React Query layer, no revalidation primitives beyond Next.js's built-in behavior.

Per-request flow:

1. Route's `page.tsx` (Server Component) reads route params and search params (`?showAll=1` if present)
2. Calls the corresponding `lib/history/queries.ts` function with `{ showAll }`
3. Receives the typed projection
4. Renders the component tree, passing the projection down as props

This means every navigation refetches. Acceptable per MASTER_SPEC §12.8 NFRs (sub-200ms PR Timeline, sub-500ms Exercise Progress) and matches the read-side nature of the tab — there's no live data to keep in sync.

Cache behavior: Next.js's default `force-dynamic` (since the queries use `auth.uid()` which is request-scoped) means no static caching. Slice 6 does not opt into ISR or `revalidate`. The Logger writes commit through Slice 5's queue + drain layer; History reads see whatever is in the DB at request time.

#### 5.2 Client-side toggle state

Two client components hold local state via `useState`:

**PRTimelineShowAllToggle** — `showAll: boolean`. Toggles between `/history` (90-day window) and `/history?showAll=1` (full history). Implementation: `<Link>` element styled as a toggle, no JS state needed. Even simpler: this could be a Server Component reading the search param and rendering different link targets. Phase 4 implementation choice between the two; both satisfy the contract.

**ExerciseProgressShowAllToggle** — same pattern, scoped to a specific exercise route.

These toggles work via URL state, not React state. Reasoning: bookmarkable ("show all PRs from when I started" is a shareable URL even if no one will share it), keeps the data layer purely a function of route params, and avoids the "client state diverges from server state" failure mode.

#### 5.3 Recharts internal state

Recharts manages its own hover-tooltip and active-data-point state internally. No external state machine for chart interactions. If the chart ever needs cross-component hover sync (e.g., hovering a chart point highlights the corresponding row in the set log list below), that's a Phase 4 enhancement, not a Phase 2 architectural concern. Current spec: chart and set log are independently rendered; no cross-component state.

#### 5.4 What there is no state for

- No "selected exercise" state across surfaces. Each Exercise Progress page is a fresh route navigation; the URL holds the selected exercise.
- No "favorite PRs" or "pinned exercises" feature → no state needed.
- No filtering UI (cut to P2 in MASTER_SPEC §12.3) → no filter state.
- No write paths → no optimistic updates, no pending state, no error retry state. Read failures show error states (handled per MASTER_SPEC §12.8 NFRs); no recovery flow.

### 6. Auth Flow

Inherited from prior slices, unchanged. Slice 6 introduces no new auth surfaces, no new RLS policies, no new sign-in flows.

Per-request auth flow:

1. User opens any `/history/*` route
2. Next.js middleware (existing, from Slice 1 or 2) validates the Supabase session cookie
3. If unauthenticated: redirect to sign-in (existing flow)
4. If authenticated: route renders, Server Component instantiates the Supabase server client with the user's session, calls into `lib/history/queries.ts`, queries run with `auth.uid()` available
5. RLS enforces `user_id = auth.uid()` on every read

Slice 5's sign-out gate (the `signOut.ts` helper) is unaffected by Slice 6. History routes are protected by the same middleware as Logger.

What this section explicitly does not change:

- No new RLS policies on `pr_history`, `set_logs`, `session_completions`, `exercises`, `sessions`, or `blocks` (all six tables Slice 6 reads)
- No new auth-scoped helpers in `src/lib/auth/`
- No middleware additions
- No new redirect paths
- No anonymous/public read access (History is fully personal)

If a future slice introduces shared/community PR cards or trainer-readable training logs, that would touch this section. Slice 6 does not.

### 7. Key Dependencies

The dependency surface for Slice 6 is small and largely inherited.

#### New dependency

**recharts** — single new package.

Version pin (resolves MASTER_SPEC §12.10 Q3): `^2.15.0` or whatever the latest 2.x stable major is at install time, with the constraint that it must support React 19 (which Next.js 15 includes). Phase 4 install step verifies React 19 compatibility before locking the version in `package.json`.

Why Recharts (recap from §1): React-native, declarative, mobile-friendly defaults, small bundle relative to alternatives. Used only for the Exercise Progress weight-over-time line chart — a primitive Cartesian LineChart, no exotic features. Swap surface contained to one client component (`ExerciseProgressChart.tsx`).

Bundle impact: Recharts is ~80–100 KB minified+gzipped. It loads only on the Exercise Progress route (client component, code-split per route by Next.js App Router). PR Timeline, All Sessions, and Session Detail do not include Recharts in their client bundles.

If bundle size becomes a concern at any point (e.g., target devices with slow 3G in the future), the swap candidates are:

- visx (low-level, more granular bundle control, harder to use)
- A custom SVG line chart (hand-rolled, ~5 KB, no library)
- react-chartjs-2 (similar size to Recharts, no advantage)

None of these are needed in Slice 6. Logged here for reference if the question arises in a future slice.

#### Inherited dependencies (no changes)

- `next` — App Router routes, Server / Client Component split, `<Link>`
- `react` (19.x) — Server Components, useState in toggles
- `@supabase/ssr` and `@supabase/supabase-js` — server client for queries
- `tailwindcss` — styling for all surfaces
- `@radix-ui/*` (via shadcn/ui) — header link, badges, error boundaries if any History-specific shadcn primitives are needed
- TypeScript — strict mode, projection types from `lib/history/projections.ts`

No new shadcn/ui components are pulled in for Slice 6. If the empty-state or badge components from prior slices need extending (e.g., a new "in_progress" badge variant), the extension happens in the existing shared components, not in History-specific code.

#### Dev / build dependencies

No additions.

#### What is NOT a dependency

To prevent quiet drift in Phase 4 implementation:

- No date-formatting library (date-fns, dayjs, luxon). Slice 6's date formatting is `formatSessionDisplayName` (defined in `lib/history/displayName.ts`) plus native `Intl.DateTimeFormat`. If date formatting becomes complex enough to warrant a library, it's a separate Phase 0 decision in a future slice, not a quiet add in Slice 6.
- No charting library beyond Recharts.
- No state management library (Zustand, Jotai, Redux). `useState` in two toggles is the entire client state surface.
- No additional Supabase tooling (rpc helpers, codegen). Existing patterns in `lib/supabase/` are sufficient.
- No animation library for the dot/badge styling. Tailwind classes are enough.
- No icons beyond what's already in shadcn's icon set (lucide-react, presumably already installed).

### Resolution of MASTER_SPEC §12.10 Open Questions

For audit-trail completeness, the resolutions of all three Phase 1 open questions, consolidated:

**Q1 (Session display name format):** Resolved in §3 Module Map under `displayName.ts`. Format `<sessions.name> · <formatted_date>` — "Pull · May 1" for current year, "Lower ATG · Dec 12, 2025" for prior years. Implemented as `formatSessionDisplayName(sessionName, startedAt)`.

**Q2 (PR-count-per-session derivation):** Resolved in §4 API Contract under `getAllSessions()`. Hybrid query: FK join (`pr_history.set_log_id = set_logs.set_log_id`) AND time-window (`achieved_at BETWEEN started_at AND COALESCE(completed_at, now())`). Accepts small undercount on legacy rows where FK is NULL in exchange for correct attribution. Logged in FUTURE_WORK.md as backfill candidate.

**Q3 (Recharts version pin):** Resolved in §7 Key Dependencies. `^2.15.0` or latest 2.x stable at install time, verified against React 19 in Phase 4.

All three Open Questions from MASTER_SPEC §12.10 are now closed. ARCHITECTURE is complete; Phase 2 closes here.
