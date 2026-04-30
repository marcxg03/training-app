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

## 2. File and Folder Structure

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

## 3. Module Map

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
- retry.ts — Listens for online event and visibilitychange; drains
  queue with exponential backoff capped at 60s.
- set-log-writer.ts — Wraps SetLog writes specifically: optimistic
  local update, attempt Supabase write, queue on failure, run PR
  detection on the optimistic record.

### Data access (src/lib/supabase/)
- client.ts — Browser Supabase client. Used in client components.
- server.ts — Server Supabase client (reads cookies). Used in server
  components and route handlers.
- types.ts — Generated by supabase gen types typescript.

No repository pattern. Server components query Supabase directly via
the server client; client components use the browser client.
Methodology functions take plain data, not DB rows.

## 4. API Contract

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

## 5. State Management

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
Two pieces of UI state cross component boundaries; both use Context:
- OfflineStatus — read by the global banner, written by sync layer.
  { pending: number, lastError?: string, isOnline: boolean }.
- ActiveWorkoutSession — read by the bottom tab bar, written by the
  Logger.

Everything else is local state inside the route or component that
owns it. No global store.

## 6. Auth Flow

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

## 7. Key Dependencies

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

## 8. Schema Details and RLS Policies

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

## 9. PR Detection Implementation

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

## 10. Sync Strategy — Queue-on-Failure

The Logger is the only critical write path. SetLog writes use this
flow:

1. User taps ✓ on a set row.
2. Compute prescribed_min, prescribed_max from the active Exercise.
3. Optimistic UI update: row marked complete, advance enabled.
4. Try supabase.from('set_logs').insert(payload).
   On success: PR detection runs server-side via trigger; UI updates
     with PR flag.
   On failure (network):
     a. Push payload to localStorage queue
     b. Show "offline — will sync" banner
     c. Continue workout normally
5. retry.ts listens for online and visibilitychange; drains queue in
   FIFO order with exponential backoff.
6. On successful drain, server-side PR detection runs for any queued
   rows representing W1/W2 sets.

PR detection runs server-side as canonical source. If a client-side
optimistic flag turns out to be wrong, server's version wins on next
refresh. Single-writer in MVP makes this almost impossible.

## 11. Module Boundaries — What Lives Where

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

## 12. Goal Mode Recommendation Flow

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
