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
- 3A PR Tracker (grouped by muscle group)
- 3B Exercise PR History (drill-down with chart)
- 3C Session History

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

## 9. Out of Scope (MVP)
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

## 10. Open Questions
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
