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
│   │   │   ├── history/
│   │   │   │   ├── page.tsx                     # 3A
│   │   │   │   ├── exercise/[id]/page.tsx       # 3B
│   │   │   │   └── sessions/page.tsx            # 3C
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

getPRTracker(userId) →
  {
    exercisesByMuscleGroup: Map<MuscleGroup, ExerciseWithCurrentPR[]>
  }

getExercisePRHistory(exerciseId) →
  {
    exercise: Exercise,
    weightLadder: PRHistory[],
    inRangeRepPRs: PRHistory[],
    allSetLogs: SetLog[]
  }

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
