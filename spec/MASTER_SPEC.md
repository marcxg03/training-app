# MASTER_SPEC.md

## 1. Problem Statement
Marcus's training methodology — block + bank programming, schedule-anchored
nutrition with full macro tracking, ATG + traditional split, 1 warm-up + 2
working sets to failure — currently lives across six markdown files. There
is no clean interface to view today's session, log sets in real time with
PR detection, track macros against day-type target ranges, or evolve the
plan as it changes. This app is a UI that encompasses the entire
methodology, with every methodology concept (Block, Bank, day-type,
prescribed range, in-range PR) as a first-class entity.

## 2. Target Users
- **MVP**: Marcus only. Single-user UX, app-developer technical level.
- **Phase 4 (community-ready, not built in MVP)**: followers loading
  Marcus's plan as a template and training alongside him. Architecture
  posture is community-ready; UI posture is personal-first.

## 3. User Stories

### Daily training loop
1. As Marcus, I want to open the app on my iPhone and immediately see
   today's sessions (lifting + cardio + recovery) and macro progress, so
   I never have to navigate to figure out what I'm doing today.
2. As Marcus, I want to start a lifting session with one tap and walk
   through every block in order, so the app drives the workout — not me.
3. As Marcus, I want to pick any exercise from the block's bank fresh
   each session, so rotation is the default and habituation is the
   exception.
4. As Marcus, I want WU + W1 + W2 enforced on every failure block and a
   different protocol on mobility/corrective blocks, so the methodology
   is encoded in the UI.
5. As Marcus, I want PRs auto-detected and flagged the moment I log the
   set, so I see the win in the moment and don't have to compute it
   later.
6. As Marcus, I want to mark cardio and recovery sessions done with a
   single tap, so they're tracked without being treated as lifting.
7. As Marcus, I want the app to remember an in-progress session if I
   close it mid-workout, so a phone restart or accidental close doesn't
   destroy a session's data.

### Nutrition loop
8. As Marcus, I want today's meal framework to appear automatically based
   on what kind of training day it is, so I never have to think about
   what to eat — only how much.
9. As Marcus, I want to log meals with protein, carbs, and fat in grams
   and have calories auto-derived, so I'm tracking what actually drives
   the targets.
10. As Marcus, I want to see daily macro totals against four target
    ranges (calories, protein, carbs, fat) at a glance, so I know
    whether to eat more before bed or stop.
11. As Marcus, I want my goal mode (Cut / Maintain / Lean Bulk) to drive
    macro defaults and meal-framework logic, so changing my training
    phase doesn't require manually rewriting targets.

### History and review
12. As Marcus, I want to see every PR I've hit on every exercise,
    grouped by muscle group, so progress is legible at a glance.
13. As Marcus, I want a chart of the weight ladder over time for any
    exercise, so I can see plateau and acceleration patterns.
14. As Marcus, I want a session history showing only days I actually
    trained, so rest days don't pad the list.

### Plan management
15. As Marcus, I want to edit the structure of any day (sessions, block
    order, gym, recovery add-ons) in-app, so the plan can evolve without
    editing markdown.
16. As Marcus, I want to add or remove exercises from any block's bank
    in-app, so the bank grows organically as I find new exercises that
    fit.
17. As Marcus, I want to edit per-exercise notes once and have them
    appear everywhere that exercise appears, so notes are global to the
    exercise, not duplicated per location.

## 4. Feature List

### P0 — MVP (must ship)
- Magic-link authentication via Supabase
- Today dashboard with session cards (lifting / cardio / recovery) and
  4-bar macro summary + Log Meal CTA
- Live workout logger with WU + W1 + W2 protocol on failure blocks,
  alternative protocol on mobility/corrective blocks
- Exercise selection from flat bank per block, fresh each session
- Read-only exercise notes panel in logger (edit via Exercise Bank)
- Type A (Weight PR / "ladder") detection on every W1 and W2
- Type B (In-Range Rep PR) detection using prescribed range pinned to
  the SetLog at write time
- Session Complete screen showing block / set / PR counts
- Cardio session "Mark Done" tap completion
- Abandoned session recovery via in_progress status + resume prompt
- Weekly Plan view (card per day, all sessions in chronological order)
- Day Detail view (read-only, all sessions and recovery shown)
- PR Tracker grouped by muscle group with current PR per exercise
- PR drill-down with weight-ladder chart + full log
- Session history (completed sessions only, dynamically computed set
  counts)
- Nutrition Dashboard with auto-generated day-type meal framework and
  4 progress bars
- Log Meal screen with free-form meal type, P/C/F entry, calories
  auto-derived
- Nutrition Targets editor with macro-to-calorie consistency check
- Goal Mode selector (Cut / Maintain / Lean Bulk) driving macro
  defaults and meal-framework logic
- Plan Editor (sessions per day, block order, gym, recovery)
- Exercise Bank (per-block exercises + per-exercise notes editing)
- Profile screen with bodyweight + height as editable fields
- PWA install configuration (manifest, icons, service worker via
  next-pwa)
- Queue-on-failure sync for SetLog writes

7. Sync queue (Slice 5)
   7.1. Queue-on-failure for set_log inserts and session_completion updates
   7.2. localStorage persistence keyed by user_id
   7.3. Three drain triggers: window 'online' event, LoggerShell mount,
        manual retry from queue indicator
   7.4. Queue indicator in Logger header: gray (idle), lilac (syncing),
        amber (pending), expand-on-tap panel
   7.5. Sign-out confirmation when queue non-empty; queue persists for
        same-user re-sign-in

### P1 — Phase 2 (next horizon)
- Progress charts beyond the basic PR ladder (volume, frequency, e1RM
  trends)
- Refinements to Goal Mode logic based on real usage

### P2 — Phase 3 and beyond
- Claude API natural language set logging ("just hit 225 × 5 on bench")
- Plan versioning (save / restore prior plan versions)
- Export (PDF or shareable summary)
- Phase 4 community features (publicly loadable plan templates,
  follower onboarding mapping Marcus's blocks to a follower's schedule,
  optional shared PR feed, nutrition template sharing)

## 5. Screens, Pages, and Flows

Five tabs, sixteen screens total in MVP. Bottom tab bar always visible.

### Tab 1 — Today
- 1A Today Dashboard (default landing)
- 1B Live Workout Logger
- 1C Session Complete

### Tab 2 — Plan
- 2A Weekly Schedule (card per day)
- 2B Day Detail (read-only)

### Tab 3 — History
See `## 12. Tab 3 — History` (Phase 1 spec) for the full route map,
data contracts, and use cases. This subsection is intentionally
brief — superseded by the dedicated tab spec at the end of the
document.

### Tab 4 — Nutrition
- 4A Nutrition Dashboard (day-type framework + 4 progress bars)
- 4B Log Meal

### Tab 5 — Settings
- 5A Settings Menu
- 5B Plan Editor
- 5C Exercise Bank (list + per-exercise edit screen)
- 5D Nutrition Targets
- 5E Profile (bodyweight, height, goal mode)
- 5E.1 Goal Mode Recommendation (shown only after goal mode change)

### Key flows
1. Daily entry flow: app open → 1A renders today's sessions and macros
   → tap lifting card → 1B → walk blocks → 1C.
2. Mid-session abandonment recovery: 1B in_progress → app closed →
   reopen → 1A detects in_progress WorkoutSession → resume prompt →
   1B (resumed at last block) OR 1A (discarded).
3. Meal logging: 1A "+ Log Meal" OR Tab 4 → 4A "+ Log Meal" → 4B →
   save → 4A and 1A both reflect updated totals.
4. Plan edit: Tab 5 → 5A → 5B (day structure) OR 5C (exercises and
   notes) → save → schedule validation runs → if hard rule fails, save
   blocked; if soft rule warns, save button changes to "Save anyway —
   I'm overriding [N] warning(s)" and requires explicit tap.
5. Goal mode change: 5A → 5E → select mode → confirm mode change →
   5E.1 Goal Mode Recommendation shows current target ranges alongside
   recommended defaults for the new mode → per-field "apply default"
   toggles → save applies only the toggled fields → the rest remain at
   current values. Past meal logs and target history unchanged.

## 6. Data Model

Pseudo-schema. Field types are intent, not Postgres syntax.
ARCHITECTURE.md will translate to actual SQL with Supabase RLS.

### User profile
profiles
  user_id            uuid (FK auth.users) PK
  display_name       text
  bodyweight_kg      numeric (nullable)
  height_cm          numeric (nullable)
  goal_mode          enum {cut, maintain, lean_bulk}
  created_at         timestamptz
  updated_at         timestamptz

### Plan structure
training_plans
  plan_id            uuid PK
  user_id            uuid FK
  name               text
  is_active          boolean
  created_at         timestamptz

daily_schedules
  schedule_id        uuid PK
  plan_id            uuid FK
  day_of_week        enum {mon,tue,wed,thu,fri,sat,sun}
  is_rest_day        boolean

sessions
  session_id         uuid PK
  schedule_id        uuid FK
  session_type       enum {lifting, cardio, recovery}
  session_name       text
  timing             enum {am, pm, anytime}
  gym                text (nullable)
  description        text (nullable)            -- recovery free text
  display_order      integer
  -- cardio-only structured fields (nullable for non-cardio sessions)
  cardio_format      enum (nullable)
  cardio_distance    text (nullable)
  cardio_target_zone enum (nullable)

The exact enum values for cardio_format and cardio_target_zone are
determined by supplementary wiki docs at seed time (Slice 2). The
schema decision is "structured, with enums" — exact value set is
sourced from the methodology, not invented.

blocks
  block_id           uuid PK
  session_id         uuid FK   (lifting sessions only)
  block_name         text
  block_type         enum {failure, mobility, corrective}
  display_order      integer

exercises
  exercise_id        uuid PK
  user_id            uuid FK
  name               text
  notes              text                       -- global to exercise
  prescribed_min     integer                    -- rep range floor
  prescribed_max     integer                    -- rep range ceiling
  muscle_groups      text[]
  is_compound        boolean

block_exercises
  block_id           uuid FK
  exercise_id        uuid FK
  PRIMARY KEY (block_id, exercise_id)

### Workout logging
workout_sessions
  workout_session_id uuid PK
  user_id            uuid FK
  session_id         uuid FK
  date               date
  status             enum {in_progress, complete, abandoned}
  started_at         timestamptz
  completed_at       timestamptz (nullable)

set_logs
  set_log_id         uuid PK
  workout_session_id uuid FK
  block_id           uuid FK
  exercise_id        uuid FK
  set_type           enum {WU, W1, W2, mobility}
  weight_kg          numeric (nullable)
  reps               integer
  reached_failure    boolean (nullable)
  prescribed_min     integer
  prescribed_max     integer
  logged_at          timestamptz

session_completions
  completion_id      uuid PK
  user_id            uuid FK
  session_id         uuid FK
  date               date
  completed_at       timestamptz

### PR tracking (append-only)
pr_history
  pr_id              uuid PK
  user_id            uuid FK
  exercise_id        uuid FK
  set_log_id         uuid FK
  pr_type            enum {weight, in_range_rep}
  weight_kg          numeric
  reps               integer
  achieved_at        timestamptz

### Nutrition
nutrition_targets
  target_id          uuid PK
  user_id            uuid FK (unique)
  cal_min            integer
  cal_max            integer
  protein_min_g      integer
  protein_max_g      integer
  carbs_min_g        integer
  carbs_max_g        integer
  fat_min_g          integer
  fat_max_g          integer
  updated_at         timestamptz

meal_entries
  meal_id            uuid PK
  user_id            uuid FK
  date               date
  meal_type          text                       -- free-form
  protein_g          numeric
  carbs_g            numeric
  fat_g              numeric
  calories           numeric                    -- derived, stored
  note               text (nullable)
  logged_at          timestamptz

### Phase 4 forward-compatibility
plan_templates
  template_id        uuid PK
  owner_user_id      uuid FK
  version            integer
  is_public          boolean (default false)
  snapshot_json      jsonb
  created_at         timestamptz

The plan_templates table is created in MVP but unused by the UI. Its
existence at MVP time means Phase 4 ("Train with Marcus") requires
zero schema migration — only a UI surface and a snapshot writer.

### Slice 5 — localStorage (not Postgres)

The queue does not add new database tables. Queue rows live in
localStorage under the key pattern:

  training-app:queue:<user_id>:<queue_row_id>

Queue row schema (in-memory representation):

  QueueRow:
    id              string  // UUID
    kind            'set_log_insert' | 'session_completion_start' |
                    'session_completion_block_complete' |
                    'session_completion_end'
    payload         object  // shape varies by kind
    attempts        number  // increments on each drain attempt
    enqueued_at     ISO timestamp
    last_attempt_at ISO timestamp | null
    last_error      string | null  // truncated error message for UI

Payload shapes by kind:

  set_log_insert:
    set_log_id    UUID  // pre-generated client-side for idempotent retry
    user_id       UUID
    session_id    UUID
    block_id      UUID
    exercise_id   UUID
    set_index     integer
    set_kind      'wu' | 'w1' | 'w2' | 'free_form'
    weight_kg     numeric(7,3) | null  // 0 for bodyweight
    reps          integer
    is_failure    boolean
    notes         text | null
    logged_at     ISO timestamp

  session_completion_start:
    completion_id UUID  // pre-generated client-side
    user_id       UUID
    session_id    UUID
    started_at    ISO timestamp

  session_completion_block_complete:
    completion_id UUID
    block_id      UUID  // appended to completed_block_ids array idempotently

  session_completion_end:
    completion_id UUID
    completed_at  ISO timestamp
    was_ended_early boolean

## 7. External Integrations
- Supabase Auth: magic-link email authentication. Single integration
  point; no other auth flow in MVP.
- No third-party APIs in MVP beyond Supabase itself.
- Phase 3: Claude API for natural language set logging. Out of MVP
  scope.

## 8. Non-Functional Requirements

### Performance
- Today dashboard renders within 1s on a cold app open with cached
  data, within 2s on a network round-trip. Service worker caches the
  app shell so the UI is visible before any network request resolves.
- Set log writes complete in under 500ms on a normal connection. On
  network failure, the write queues to localStorage and the UI updates
  optimistically.
- PR detection runs after every W1 and W2 write. The check is a
  single indexed query; target latency under 100ms.

### Security
- Row Level Security on every user-scoped table. No table allows
  reads or writes outside the authenticated user's own rows.
- Magic-link tokens follow Supabase defaults (single-use, time-bound).
- No secrets in client code. Supabase anon key is the only key shipped
  to the client; service role key never leaves the server.
- .env never committed. .env.example documents required keys.

### Accessibility
- Touch targets minimum 44px (iOS HIG).
- Color is never the sole carrier of meaning. PRs are flagged with
  both a star icon and the lilac accent. Macro range status uses both
  color (grey/green/red) and an explicit label.
- Tabular numerals for all column-aligned numeric displays.
- Adequate contrast on the dark theme: white-on-black text passes
  WCAG AAA; the lilac accent is calibrated to pass AA on black for
  interactive elements.

### Offline behavior
- Service worker caches the app shell, fonts, and last-fetched plan
  and exercise data. The app loads and displays the most recent plan
  even with no network.
- Writes use queue-on-failure: SetLog and MealEntry writes attempt
  Supabase first; on failure, queued in localStorage with a pending
  flag and retried on reconnect (visibility change event + interval
  fallback). Last-write-wins (single-writer system).
- PR detection on queued writes runs server-side after the write
  lands. PR flags may appear in the UI a few seconds after a set is
  logged during reconnect — acceptable.

### Data integrity
- PRHistory is append-only. No update or delete operations exposed.
- SetLog and MealEntry are append-only after creation; corrections
  happen via new records, not edits.
- Schedule validation rules run on Plan Editor save:
  - Hard rules block save: 48-hour muscle group recovery, push/pull
    weekly balance, minimum one rest day per week, max 2 sauna
    sessions per week, no yoga + sauna same calendar day.
  - Soft rules warn but allow override via explicit "Save anyway —
    I'm overriding [N] warning(s)" tap. Soft rules: compound recovery
    window (24h), cardio-before-lifting same-day, recovery activity
    timing on two-session days.

### Observability
- Supabase logs cover all DB-side errors.
- Client errors logged to console only in MVP. No external error
  tracking (Sentry etc.) — single user, low traffic.

### Sync semantics
- Durability envelope: best-effort persistence within localStorage's
  reliability boundary. Browser data-clearing flows (devtools
  clear, Safari ITP, manual settings reset) can drop the queue
  without warning. The app does not guarantee durability beyond
  what the storage layer provides.
- Idempotency: retry of a set_log_insert that already exists in
  the database returns Postgres error 23505 (unique violation).
  The queue layer treats 23505 / HTTP 409 on retry as SUCCESS,
  removes the row from the queue, and proceeds with derived effects
  (PR detection re-run).
- Retry classification:
  - Inline error, no queue: validation failures, 4xx other than
    408/429, schema mismatches, auth failures
  - Queue and retry: network unreachable, 5xx, 408 Request Timeout,
    429 Rate Limited, fetch abort
- Retry cap: none in Slice 5. The attempts counter is tracked for
  diagnostic display but does not trigger any state change. A retry
  cap is deferred to a future slice if production usage surfaces
  stuck-queue scenarios.
- Cross-device sync: out of scope. Queue is per-device, per-user.
- Cross-tab coordination: not implemented. Multiple tabs may attempt
  to drain the queue simultaneously; idempotency at the database
  layer makes this safe but wasteful.

## 9. Edge Cases

### Slice 5 — Sync queue
E5.1. Drain attempt while drain already in progress:
      drainQueue() must be re-entrant or guarded; second concurrent
      call should no-op rather than fire duplicate requests.
E5.2. Queue contains rows with kind not recognized by current code
      (e.g., user upgraded from a future version back to current):
      log warning, leave row in queue, do not crash drain loop.
E5.3. Sign-out while queue is mid-drain: complete current row's
      attempt, then proceed with sign-out; do not interrupt an
      in-flight HTTP request.
E5.4. Logger remounts during active drain: the new mount's drain
      attempt should detect in-flight drain (via drainState flag
      in module scope) and no-op.
E5.5. Same set saved twice client-side (user double-tap on Save):
      Slice 4's existing UNIQUE constraint catches this at the DB
      layer; the second insert fails with 23505; queue layer treats
      as success.
E5.6. Block completion queued, but user later ends session early
      before that block_complete drains: both rows in queue;
      session_completion_end's payload reflects the FINAL state
      including the queued block_complete; on drain, both apply
      idempotently (array_append for block, then completed_at
      update).
E5.7. localStorage quota exceeded during enqueue:
      catch QuotaExceededError, surface inline error "Local storage
      full — clear browser data or contact support"; do not silently
      drop the write.
E5.8. User signs in as different account: queue rows for previous
      user_id are NOT loaded, NOT cleared, remain dormant in
      localStorage until that user signs in again.

## 10. Out of Scope (MVP)
- Body-fat % and progress photo tracking
- Bodyweight history (single editable field on profile, no log table)
- Goal mode change history (only the current goal is stored)
- Per-exercise edit history or note versioning
- SetLog or MealEntry edit / delete UI (append-only via UI; manual
  DB fix if needed)
- Notifications (push, in-app, or email)
- Onboarding flow for new users
- Multi-user UI (RLS supports it; UI does not surface other users)
- Plan versioning (Phase 3)
- Export, sharing, or PDF generation (Phase 3)
- Community features (Phase 4)
- Android app
- Native iOS app

### Slice 5 — Sync queue
OS5.1. Cross-device queue synchronization (queue lives only on the
       device where the write originated)
OS5.2. Periodic background drain interval (deferred — only event-driven
       triggers in Slice 5)
OS5.3. Retry attempt cap with "needs attention" UI (deferred until
       production usage surfaces stuck-queue scenarios)
OS5.4. Service worker integration for true offline-first behavior
       (deferred to Slice 10 PWA Configuration)
OS5.5. Queue inspection / management from Settings tab (deferred to
       Slice 9 Settings)
OS5.6. Per-row retry button (manual retry drains the entire queue;
       no per-row controls in Slice 5)
OS5.7. Drain progress percentage in queue indicator (just shows
       count, not progress bar)

## 11. Open Questions
None blocking Phase 2.

Resolutions logged from Phase 1 review:
- Muscle group taxonomy locked: Chest, Shoulders, Back, Arms, Legs,
  Core, Calves. Multi-group exercises appear under each.
- Soft rules require explicit "save anyway" override.
- Cardio sessions use structured fields (format, distance,
  target_zone) with enum values determined at seed time from
  supplementary wiki docs.
- Exercise notes are read-only during workout (no mid-workout edit
  affordance). Reconsider in Phase 2.
- Goal mode change shows per-field recommendation screen with apply
  toggles, never auto-overwrites targets.

## 12. Tab 3 — History

### 1. Problem Statement

The training-app captures session, set, and PR data through Slices 1–5 but exposes no read surface outside the Logger. The user trains week after week with no visual confirmation of progressive overload, no PR trend, and no way to recall block-variant choices from past sessions. The History tab is the read surface that answers "am I getting stronger?" as its anchor question and "what did I do last time?" as its secondary question.

### 2. Target Users

Primary: Marcus Gao. Personal-first product, single user in production for the foreseeable future. Mobile-first usage pattern; primary contexts are gym floor (pre/post workout) and couch (evening review). Comfortable interpreting line charts; uninterested in raw data tables. Engagement pattern: 5-second glance is the dominant interaction, with occasional deeper dives into exercise progress and past sessions.

Multi-user readiness: data scoping (RLS on every table) is already in place from Slices 1–4 — no Slice 6 changes needed. History remains personal-per-user even when the app eventually ships to others; no shared or exportable surfaces.

### 3. User Stories

P0 (must ship in v1):

- As Marcus, I want to open History and immediately see whether I've hit a PR recently so that I can confirm progressive overload at a glance without navigating further.
- As Marcus, I want to tap any PR row and see that exercise's weight-over-time trend so that I can validate the trajectory, not just the latest data point.
- As Marcus, I want to tap any PR row's session reference and see the full session detail so that I can recall the context (other exercises chosen, notes, what felt good) of a high-performing session.
- As Marcus, I want to find any past session by date so that I can recall what variant I picked for a given block last time.
- As Marcus, I want past sessions that I ended early or didn't complete to still appear in history with clear visual state so that the audit trail is honest, not curated.

P1 (nice to have, may ship if scope allows):

- As Marcus, I want to find an exercise's progress chart even if it hasn't recently PR'd so that I can audit slow-progressing or recently-deloaded exercises. (Reachable via search/picker, not just PR-Timeline cross-link.)
- As Marcus, I want the PR Timeline to show in_range_rep PRs distinguishably from weight PRs so that I can tell at a glance which kind of progress is happening.

P2 (deferred to later slices, named here so they aren't quietly dropped):

- Muscle-group-grouped current-PR audit view (deferred; conscious deviation from v0)
- Body-part comparison views ("show me all my back progress")
- Date-range filtering, exercise-category filtering
- Search across session notes
- Volume calculations, training load metrics
- Cardio / recovery completion display (Slice 7)
- Calendar / week-grid views (Slice 7 — Plan tab)
- Streaks / consistency stats (Slice 7)
- PR celebration animations
- Export / share

### 4. Feature List

P0 — must ship:

- F1: PR Timeline (landing surface). Server-rendered chronological feed of pr_history rows for the current user. Default window: last 90 days. "Show all" toggle that reveals full history. Each row displays exercise name, PR type badge (weight | in_range_rep), weight × reps, and a session+date caption. Both exercise name and session caption are independently tappable as cross-links.
- F2: Exercise Progress view. Server-rendered route receiving an exercise_id. Three stacked layers: current PR header (most recent best per existing PR detection logic), weight-over-time line chart (Recharts, 6-month default with "Show all" toggle), and full chronological set log for that exercise (most recent first). Reachable from PR Timeline cross-link.
- F3: Session Detail view. Server-rendered route receiving a completion_id. Renders the session in chronological block order. For each block: block name, exercise chosen, all sets logged. Failure-protocol blocks render with WU/W1/W2 typing and W2 failure flag preserved. Free-form blocks render as flat "Set 1 / Set 2 / Set 3..." lists. Notes (if any) display under the relevant set. PR badges where applicable.
- F4: All Sessions list. Header link from every History surface. Server-rendered chronological list of session_completions rows for the current user. Each row: session name (Pull / Lower ATG / etc.), date, completion-state indicator (complete | in-progress | ended-early), and a brief summary (block count completed, PR count if any). Tap into Session Detail.
- F5: Empty state handling. PR Timeline shows a deliberate empty-state when no PRs in the default window — accepted as accurate (deload, focused training cycle) rather than supplemented with substitute content.
- F6: Cross-link navigation contract. Exercise names anywhere in History are tappable to Exercise Progress. Session captions/dates anywhere in History are tappable to Session Detail. This is a cross-cutting contract, not a single feature; enforced by a shared component.

P1 — ship if scope allows:

- F7: Exercise picker. Search/browse interface to find any exercise's progress chart even when it hasn't appeared in recent PR Timeline. Reachable from a header affordance on PR Timeline. If P1 cut, Exercise Progress is only reachable via PR cross-link.
- F8: PR-type visual distinction in PR Timeline. Distinct badge/color for weight vs. in_range_rep PR rows. Cosmetic polish; rows still render and link correctly without it.

### 5. Screens / Pages / Flows

Routes:

- /history — PR Timeline (landing). Server Component.
- /history/exercises/[exercise_id] — Exercise Progress view. Server Component for layout + set-log layers; Client Component sub-component for the Recharts chart + "Show all" toggle.
- /history/sessions — All Sessions list. Server Component.
- /history/sessions/[completion_id] — Session Detail view. Server Component.

Navigation flows:

- Daily-glance flow (anchor): Open app → bottom nav → History → land on PR Timeline → glance at most recent PR → close. Zero further navigation.
- Progressive-overload validation flow: PR Timeline → tap exercise name on a PR row → Exercise Progress → review chart → optionally scroll to set log → back.
- Block-variant journal flow: PR Timeline → header "All Sessions" link → All Sessions list → tap session row by date → Session Detail → review block-by-block → back.
- Cross-context flow (PR row → session context): PR Timeline → tap session caption on a PR row → Session Detail (jumps directly to that session) → optionally tap an exercise within that session to Exercise Progress.

State indicators on All Sessions list:

- Complete (completed_at IS NOT NULL AND was_ended_early = false): default styling.
- Ended early (was_ended_early = true): muted styling, "ended early" badge.
- In progress (completed_at IS NULL AND was_ended_early = false): muted styling, "in progress" badge. Tappable; Session Detail handles partial data gracefully.

Empty states:

- PR Timeline empty: "No PRs in the last 90 days. Tap Show all to see your full history, or All Sessions to browse past sessions." — never substitute content.
- Exercise Progress empty (no set_logs for that exercise): "No history for this exercise yet." Chart hidden; set log shows the empty message.
- All Sessions empty: "No completed sessions yet." (Realistic only on a fresh install.)
- Session Detail with zero set_logs: shows the session header and any logged blocks (which may have zero sets); no errors.

### 6. Data Model

Slice 6 is read-only against the existing schema. No new tables, columns, indexes, RLS policies, or views are introduced. The data model section documents what Slice 6 reads from, the access patterns, and the entity relationships that History surfaces depend on.

#### Tables read from (existing, unchanged by Slice 6)

- session_completions — one row per training session attempt. Slice 6 reads: completion_id (PK), user_id (RLS), session_id, started_at, completed_at, completed_block_ids (uuid[]), was_ended_early.
- set_logs — one row per logged set. Slice 6 reads: set_log_id (PK), user_id (RLS), session_id, block_id, exercise_id, set_index, weight_kg, reps, is_to_failure, prescribed_min, prescribed_max, notes, logged_at.
- pr_history — one row per detected PR (append-only). Slice 6 reads: pr_id (PK), user_id (RLS), exercise_id, set_log_id, pr_type (enum: weight | in_range_rep), weight_kg, reps, achieved_at.
- exercises — exercise catalog. Slice 6 reads: exercise_id (PK), name, is_bodyweight, muscle_group, exercise_type (compound | isolation | etc.).
- sessions — session-template catalog (Pull, Push, Lower ATG, etc.). Slice 6 reads: session_id (PK), name.
- blocks — block-template catalog. Slice 6 reads: block_id (PK), session_id, name, protocol_type (failure | mobility | corrective), order_index, prescribed_min, prescribed_max.

#### Access patterns by surface

PR Timeline (/history):

- Primary query: pr_history for current user, ordered by achieved_at DESC, default windowed to last 90 days. JOIN to exercises for name and to set_logs (via set_log_id FK) for session context.
- Secondary lookup per row: derive session display name (e.g., "Pull · May 1") from the set_logs.session_id FK joined to a session_completions row matching that session_id and the closest started_at <= achieved_at. The Architecture phase will resolve whether this is a single denormalized join or a separate query per row; the spec only requires the data is reachable.
- Cross-link payloads: each rendered row carries exercise_id (for exercise cross-link) and completion_id (for session cross-link). Resolved at query time, not at click time.

Exercise Progress (/history/exercises/[exercise_id]):

- Header: most recent pr_history row for (user_id, exercise_id) ordered by achieved_at DESC LIMIT 1. Used to display the current PR.
- Chart data: all set_logs for (user_id, exercise_id), ordered by logged_at ASC, default windowed to last 6 months. The chart plots weight_kg over logged_at. Each data point is annotated with whether a PR fired on that set (LEFT JOIN to pr_history on set_log_id).
- Set log layer: same set_logs query as the chart, but rendered chronologically newest-first with full set detail (weight × reps, set_index, notes if any, PR badge if applicable).

All Sessions (/history/sessions):

- Primary query: session_completions for current user, ordered by started_at DESC, full history (no default window — assumes session count per user grows slowly enough that paging is not P0; revisit if usage proves otherwise).
- Per-row enrichment: session display name from sessions.name via session_id FK; PR count for the session via COUNT(\*) FROM pr_history WHERE achieved_at BETWEEN started_at AND COALESCE(completed_at, NOW()) (Architecture phase resolves the precise temporal-bounds query — the spec specifies "PRs that fired during this session," not the SQL).
- State derivation: complete | in_progress | ended_early derived from (completed_at IS NULL, was_ended_early) at query time, not stored.

Session Detail (/history/sessions/[completion_id]):

- Session header: session_completions row for completion_id. JOIN to sessions for the name.
- Block list: blocks for this session_id from blocks, ordered by order_index ASC. For each block: was it in completed_block_ids? (read-only check against the array column.)
- Per-block sets: set_logs filtered by (user_id, session_id, block_id), ordered by set_index ASC. JOIN to exercises for the chosen exercise's name. PR badge per set: LEFT JOIN to pr_history on set_log_id.

#### Entity relationship summary

```
exercises 1───* set_logs *───1 sessions
                  ▲                      ▲
                  │                      │
                  │ (set_log_id, FK)     │ (session_id, FK)
                  │                      │
              pr_history              session_completions
                                          ▲
                                          │ (block_id IN completed_block_ids)
                                          │
                                       blocks
```

Slice 6 traverses these relationships in queries; it never modifies any of them.

#### Pseudo-schema (read-side projections, not new tables)

For Architecture phase reference. These are the shapes the UI components consume; the actual SQL projection is decided in Phase 2.

```
PRTimelineRow {
  pr_id: uuid
  achieved_at: timestamp
  exercise_id: uuid
  exercise_name: string
  pr_type: 'weight' | 'in_range_rep'
  weight_kg: number
  reps: number
  is_bodyweight: boolean
  set_log_id: uuid
  completion_id: uuid
  session_display_name: string
}

ExerciseProgressChartPoint {
  logged_at: timestamp
  weight_kg: number
  reps: number
  is_pr: boolean
  pr_type: 'weight' | 'in_range_rep' | null
}

ExerciseProgressSetLogRow {
  set_log_id: uuid
  logged_at: timestamp
  weight_kg: number
  reps: number
  set_index: number
  is_to_failure: boolean
  notes: string | null
  pr_badge: 'weight' | 'in_range_rep' | null
}

AllSessionsRow {
  completion_id: uuid
  session_display_name: string
  started_at: timestamp
  state: 'complete' | 'in_progress' | 'ended_early'
  blocks_completed_count: number
  blocks_total_count: number
  pr_count: number
}

SessionDetailBlock {
  block_id: uuid
  block_name: string
  protocol_type: 'failure' | 'mobility' | 'corrective'
  was_completed: boolean
  exercise_id: uuid | null
  exercise_name: string | null
  sets: SessionDetailSet[]
}

SessionDetailSet {
  set_log_id: uuid
  set_index: number
  weight_kg: number
  reps: number
  is_to_failure: boolean
  notes: string | null
  pr_badge: 'weight' | 'in_range_rep' | null
}
```

### 7. External Integrations

None. Slice 6 is fully self-contained against the existing Supabase schema and uses no external APIs, third-party services, or webhooks.

The two existing infrastructure dependencies that Slice 6 inherits from prior slices but does not modify:

- Supabase (auth, RLS, Postgres) — same client as Slices 1–5.
- Recharts (NPM dependency, to be added in Phase 2 / installed in Phase 4 if not already present) — bundled with the app, no external service call.

### 8. Non-Functional Requirements

#### Performance

- PR Timeline initial render: under 200ms server-side query time on a realistic dataset (estimate: ~1,200 PRs/year over multi-year usage). Default 90-day window keeps the working query small. The "Show all" toggle is permitted to be slower (up to ~1s) on large datasets — it's a deep-engagement surface, not a glance surface.
- Exercise Progress chart: 6-month default windowed query and chart render combined under 500ms. Recharts handles ~200 data points without strain; a 6-month window for a frequently-trained exercise yields ~50–100 points.
- All Sessions list: acceptable up to ~500 rows (estimate: 10 sessions/week × 52 weeks = ~500 sessions/year) without pagination. Beyond that, pagination is added — but P2, not P0.
- Session Detail: under 300ms for typical sessions (5–10 blocks, 15–30 sets). No streaming or skeleton needed at typical sizes.

#### Security & access control

- All queries enforce user_id = auth.uid() via existing RLS policies. Slice 6 introduces no new policies and changes no existing ones.
- No surface accepts user input that becomes part of a query string beyond the route params (exercise_id, completion_id). Both are UUIDs validated at the route layer.
- No data leaves the user's account. No exports, no shareable URLs, no cross-user references.

#### Accessibility

- All cross-link affordances (exercise names, session captions, "Show all" toggles) are keyboard-navigable and have descriptive accessible labels.
- The Recharts chart includes ARIA attributes for the data series; the set log layer below the chart serves as the screen-reader-accessible representation of the same data (already a P0 feature, not an a11y add-on).
- Dark theme contrast meets WCAG AA for body text against #000 background with the existing lilac (#9b7fd4) accent — same standards as prior slices.
- Empty states use plain prose, not icon-only signaling.

#### Mobile-first responsive behavior

- All four routes designed for ~375–414px viewport width as the primary target. Layouts are vertical stacks; no horizontal scrolling on charts or set logs.
- The Recharts chart adapts width to viewport. On narrow screens the chart's x-axis tick density auto-reduces (Recharts default behavior).
- Touch targets ≥ 44×44 CSS px for all tappable elements per existing app conventions.

#### Reliability

- Read failures (Supabase unreachable, RLS denial, malformed UUID in route param) render a clear error state per surface, not a blank page or a thrown exception. Error boundaries already in place from prior slices.
- Slice 6 has no write paths, so no offline queue / sync layer integration is needed. The existing queue (Slice 5) is unaffected.

#### Maintainability

- The cross-link navigation contract (F6) is enforced via a single shared component used by every History surface. Renaming or restyling cross-links later is a one-file change, not a hunt across four routes.
- Query shapes are documented in Phase 2 (ARCHITECTURE.md) so the same projections are not re-derived per surface.

### 9. Out of Scope

The following are intentionally not part of Slice 6 and will not be added mid-build. Each is named explicitly to prevent quiet scope creep:

- Cardio and Recovery activity completion display. Logged in FUTURE_WORK.md as a Slice 7 item with its own data-model decision (activity_completions table vs. UNION with session_completions).
- Calendar / week-grid views — Plan tab territory (Slice 7).
- Streaks, consistency stats, training frequency metrics — Plan tab.
- Body-part-grouped audits ("show me all my back exercise progress at once"). v1 anchors on chronological PR Timeline; the muscle-group-grouped alternative was a v0 plan feature consciously deferred per DECISIONS.md "Slice 6 — History tab Discovery decisions" entry 1.
- Comparison views ("Pull this month vs. last month").
- Date-range filtering, exercise-category filtering, full-text search across notes or session content.
- PR celebration animations, confetti, badges-as-rewards — not aligned with the glance-and-close usage pattern.
- Volume calculations (sets × reps × weight, weekly tonnage, etc.).
- Body metrics tracking (weight, body fat, measurements) — Phase 2 enhancement per v0 master plan; not Slice 6.
- Export, sharing, public PR cards. All of History is personal-only.
- In-Logger "last time I did this exercise" reference. This is a Logger-side feature; Slice 6's Exercise Progress view serves the History-side audit case, not the in-workout reference case.
- Pagination on All Sessions list — assumed unnecessary at expected data scale; revisit only if usage proves otherwise (P2).
- Real-time updates of History surfaces while a workout is in progress. History reflects committed data. The Logger is the live surface.
- Editing or deleting historical data from any History surface. Read-only. Data corrections happen at the DB layer (manual SQL) until a future data-editing surface is specced.

### 10. Open Questions

Three items where Phase 1 surfaces a decision that Phase 2 (Architecture) must resolve before Phase 4 builds. Each is named with the resolution deadline and the current leaning, so Phase 2 is not starting from a blank page.

Q1: Session display name format.
PR Timeline rows and All Sessions rows need a "session_display_name" string (e.g., "Pull · May 1"). Two construction options:
(a) `<sessions.name> · <formatted_date>` — current leaning, matches v0 master plan's session-naming convention.
(b) Just `<formatted_date>` with the session name as a separate sub-line element. Cleaner but adds vertical density.
Resolution: Phase 2 ARCHITECTURE Module Map. Default to (a) unless a layout constraint surfaces in chart or list density.

Q2: PR-count-per-session derivation.
All Sessions rows show a PR count per session. The query needs to bound "PRs that fired during this session" — either by achieved_at falling between started_at and completed_at (or NOW() if NULL), or by joining pr_history.set_log_id to set_logs and filtering by session_id. The second is more correct (a PR is unambiguously tied to a specific set_log, not just a time window) but requires the FK to be populated, which prior verification showed is path-specific (KNOWN_ISSUES.md entry on pr_history.set_log_id intermittent FK population).
Resolution: Phase 2 ARCHITECTURE API Contract. Default to FK-based join; fallback to time-window query if FK is not reliable. The intermittent-FK known issue may need to be promoted from 🟢 Low back to 🟡 Medium if Phase 2 finds the FK-based query is unsafe.

Q3: Recharts version pin and bundle impact.
Recharts will be added as a dependency (assuming not already present). Phase 2 ARCHITECTURE Key Dependencies must specify the version. Default to whatever the latest stable major is at install time, with the constraint that it must work with React 19 (which Next.js 15 includes).
Resolution: Phase 2 install verification.
