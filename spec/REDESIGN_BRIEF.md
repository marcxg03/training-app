# Training App — Full Redesign Brief (for Claude Design)

> **Status:** Design handoff. This document is the single source of truth for redesigning
> the entire app. It was written by the engineering side after a full audit of the codebase.
> Read it top to bottom before designing.
>
> **Audience:** Claude Design (product designer). After you redesign, the work comes back to
> engineering (Claude Code) to wire into the live app.

---

## 1. How to use this brief

**What to produce:**
- A fresh, high-fidelity visual design for **every screen** listed in §4 — including the
  **new client-coaching feature** in §8 that does not exist yet.
- A coherent **component system** (the primitives in §6.2 restyled + any new components),
  consistent tokens (color, type, spacing, radius, elevation, motion).
- Mobile-first layouts (this is an installed PWA used in a gym), but account for the coach
  dashboard which may be used on a larger screen.

**The one hard rule — preserve the wiring (see §9):**
You may freely change colors, typography, spacing, layout, navigation, information
architecture, and flows. You may **not** change the *data contract*: the names of props
components receive, the names of form fields, mutation function signatures, or database
columns/enums. Restyle the input labeled "Weight (lbs)" however you like — but the field is
still `weight_kg` underneath, and the form still submits the same shape. Think of it as: **new
skin and new skeleton-of-navigation, same nervous system.**

**Format of deliverables:** organize designs so they map back to the existing component tree
(`src/components/<area>/…`). For each screen, show default, empty, loading, and error states
where relevant. Call out any new component you introduce.

---

## 2. Product overview

**Training App** is a personal training PWA built around one lifter's full methodology, now
expanding so that lifter (the **coach**) can also train **clients** he onboards.

**Who uses it:**
- **The coach (owner/operator)** — plans training, logs his own workouts, tracks nutrition and
  PRs, and now manages a roster of clients.
- **Clients (new)** — people the coach onboards; each gets their own login, follows the plan
  the coach assigns, and logs their own workouts and nutrition.

**The methodology (what makes this app specific):**
- **Block + bank lifting.** A *workout* is an ordered list of *blocks*. A *block* holds a
  *bank* of exercises (you pick which exercise to actually do from the bank during the session).
- **Two set protocols.** A block is either **failure** (a fixed 3-set structure: warm-up, work
  set 1, work set 2 — auto-completes after 3 sets) or **free-form** (log unlimited sets, mark
  the block done manually).
- **Schedule-anchored nutrition.** Each day is a *day type* (rest / lifting / cardio) derived
  from the training schedule, and that drives the macro framework shown. Macros are tracked as
  **ranges** (min–max), not single numbers.
- **Append-only PR history.** Personal records are detected automatically when a set is logged
  (a new max weight, or new max reps within the prescribed rep range). PR and set history are
  **never edited or deleted** — they only accumulate.
- **Offline-first.** Logging works without a connection; entries queue locally and sync later.

---

## 3. Information architecture

**Current primary navigation** is a fixed bottom tab bar with 6 tabs:

`Today · Plan · Library · History · Nutrition · Settings`

**Library** has its own secondary tab row: `Lifting · Workouts · Exercises · Cardio · Recovery`.

You are encouraged (scope = *visual + UX refinement*) to rethink this IA — for example, the
6-tab bar is dense, Library nests deeply, and a coaching surface now has to live somewhere.
Two real constraints:
1. **The app now serves two roles** (coach and client). The navigation must express a clear
   way for the coach to move between *their own training* and *coaching their clients* — and a
   client should only ever see their own world. Propose the role/entry model (e.g. a top-level
   mode switch, a separate "Clients" tab for coaches, or a distinct coach shell).
2. **Core lifter flows must stay fast.** Today → start workout → log is the hot path and should
   be reachable in as few taps as possible.

---

## 4. Screen inventory

Every route below is a real screen in the app today (verified against `src/app/(app)/`). Design
each one. Routes are grouped by area; bracketed segments like `[workout_id]` are dynamic.

### 4.1 Today  (`/today`)
- **Today dashboard** (`/today`): the day name + date, then today's scheduled sessions as cards.
  Each session card shows a type badge (Lift / Cardio / Recovery), name, timing (AM / Anytime /
  PM), gym, and a one-line summary; lifting cards have a **Start Workout** CTA. Rest days show an
  empty/rest state.
- **Workout detail (read-only)** (`/today/workout/[workout_id]`): full breakdown of a session —
  each block, its type badge, and the bank of exercises with muscle groups and notes. Has the
  **Start Workout** CTA (lifting only) and a link to edit the day.

### 4.2 Logger — the most important, most complex screen
- **Active logging** (`/log/[workout_id]`): runs the live session.
  - **Block progress** header ("Block 1 of 3") with block name + type badge.
  - **Exercise picker** — choose which exercise from the block's bank you're doing.
  - **Set entry** — per set: weight (shown in lbs), reps, a *to-failure* toggle, optional notes,
    and save. Failure blocks show the fixed 3-set structure; free-form blocks let you keep adding
    sets and mark the block complete.
  - **Set history** — previously logged sets for the current exercise, with **PR badges** (weight
    PR / in-range-rep PR) shown inline the moment a PR is detected.
  - **Completed blocks** collapse; **future blocks** are locked until reached.
  - **Offline/queue indicator** — must always communicate sync state (pending count, syncing,
    retry). This is core, not decorative — design it as a first-class element.
  - **End workout** confirmation dialog for ending early.
- **Workout summary** (`/log/[workout_id]/summary`): post-session recap — every set logged, PRs
  achieved (type badge + exercise + weight×reps), completion time, and whether it ended early.

### 4.3 Plan  (`/plan`)
- **Weekly plan** (`/plan`): a plan selector + a 7-day view; each day is a card showing its
  sessions (or a rest indicator). Has an **Edit plan** action.
- **Day detail (read-only)** (`/plan/[day]`): all sessions for one day, sorted AM → Anytime → PM,
  each with its full block/exercise breakdown. Links to edit the day.
- **Day edit** (`/plan/[day]/edit`): add/remove/reorder the day's workouts (pick from the workout
  library), set each session's timing, gym, and description; toggle the day as a rest day.
- **Plan edit** (`/plan/edit`): rename the plan and manage the 7 day schedules (rest toggles).

### 4.4 Library  (`/library` → tabs)
- **Lifting** (`/library/lifting`): list of lifting blocks (name, exercise count, type badge) +
  **Add Block**.
  - **Block detail** (`/library/lifting/blocks/[block_id]`): the block's exercises (name, primary
    muscle, rep range, bodyweight badge) with inline edit/delete; Edit Block / Delete Block.
  - **Block create / edit** (`/library/lifting/blocks/new`, `.../[block_id]/edit`): name, type
    (failure / free-form), and a multi-select, reorderable **bank** of exercises.
- **Workouts** (`/library/workouts`): list of reusable workout definitions (name, block count) +
  **Add Workout**.
  - **Workout detail** (`/library/workouts/[workout_def_id]`): the workout's block composition;
    Edit / Delete.
  - **Workout create / edit** (`.../new`, `.../[workout_def_id]/edit`): name + a multi-select,
    reorderable list of blocks.
- **Exercises** (`/library/exercises`): list of all exercises (name, primary muscle, rep range,
  bodyweight badge) with inline edit/delete via a **slide-out sheet** (name, muscle groups
  multi-select, prescribed rep min/max, bodyweight toggle, notes) + **Add Exercise**.
- **Cardio** (`/library/cardio`): list of cardio activities (name, format badge — distance/time,
  description) with an edit **sheet** + **Add Cardio**.
- **Recovery** (`/library/recovery`): same pattern as Cardio for recovery activities.

### 4.5 History  (`/history`)
- **PR timeline** (`/history`): chronological PRs (exercise, PR-type badge, value like
  "185 lbs × 5" or "BW × 12", linked workout, date), with a "last 90 days / all" toggle and a
  link to all workouts.
- **All workouts** (`/history/workouts`): every completed session (name, blocks completed / total,
  PR-count badge, state badge — completed / in progress), newest first.
- **Exercise detail** (`/history/exercises/[exercise_id]`) and **workout detail**
  (`/history/workouts/[completion_id]`): currently **placeholder / "coming soon"** screens —
  design them properly. Exercise detail should show that lift's history and PR progression over
  time (great candidate for a chart); workout detail should show a completed session's full log.

### 4.6 Nutrition  (`/nutrition`)
- **Nutrition today** (`/nutrition`):
  - **Day-type framework card** — today's day type (rest / lifting / cardio) and the macro
    guidance for it, based on the user's goal mode.
  - **Macro progress bars** — Calories, Protein, Carbs, Fat, each shown as a *range vs target
    range* with a status (under / in / over). This range-on-range model is central; design it so
    "in range" reads clearly.
  - **Meals** — list of today's logged meals (type, calorie + macro ranges, notes) with
    edit/delete, plus a **Log meal** action.
  - **Log-meal sheet** — meal type, calorie range, protein/carbs/fat ranges, notes, and an
    **AI photo estimate** option (take/upload a meal photo → Claude vision pre-fills the macro
    ranges). Design the photo-capture + estimate-and-confirm flow.
- **Targets** (`/nutrition/targets`): set daily calorie + macro ranges (and goal mode).

### 4.7 Settings  (`/settings`)
- **Settings home** (`/settings`): links to Profile, Nutrition targets, Exercise library; sign out.
- **Profile** (`/settings/profile`): bodyweight, height, goal mode (cut / maintain / lean bulk),
  with a recommendation sheet when goal mode changes.

### 4.8 Auth & system
- **Login**: magic-link (enter email → "check your email"); handle the error/expired-link state.
- **Offline fallback**: shown when offline and content can't load.

---

## 5. Key user flows

1. **Log a workout (hot path):** Today → tap a lifting session → Workout detail → **Start
   Workout** → Logger (pick exercise, log sets, PRs auto-detect, advance blocks) → Summary.
2. **Build a plan:** Plan → Edit plan (name, rest days) → open a day → Day edit (add workouts
   from library, set timing/gym, reorder) → back to weekly view.
3. **Build a block:** Library → Lifting → Add Block → name + type + pick exercises into the bank
   → save → Block detail.
4. **Track nutrition:** Nutrition → (set Targets if none) → Log meal (manual or AI photo estimate)
   → meals + progress bars update for the day.
5. **(New) Onboard & coach a client:** see §8.

---

## 6. Current design system (a starting point, not a constraint)

You have an **open canvas** — propose a fresh identity (light or dark, new palette, new type
system). This section exists only so you know exactly what you're replacing and so nothing gets
lost. **Treat the current look as the floor to beat, not a brand to keep.**

### 6.1 Current tokens (from `src/app/globals.css`, `tailwind.config.ts`)
Dark-only today. Colors are CSS variables consumed via Tailwind (`bg-background`, `text-accent`,
etc.). Current values (RGB):

| Token | Value | Role |
|---|---|---|
| `--background` | `0 0 0` (pure black) | page background |
| `--foreground` | `255 255 255` | primary text |
| `--accent` | `155 127 212` (#9B7FD4 purple) | buttons, active states, highlights |
| `--card` | `8 8 8` | card surfaces |
| `--muted` | `12 12 12` | secondary surfaces (tabs) |
| `--input` | `17 17 17` | form input fields |
| `--border` | `38 38 38` | borders/dividers |
| `--muted-foreground` | `163 163 163` | secondary text |
| `--ring` | `155 127 212` | focus ring |
| `--success` | `74 222 128` | success |
| `--warning` | `251 191 36` | warning |
| `--danger` | `248 113 113` | error/destructive |
| `--radius` | `0.875rem` (14px) | base corner radius |

- **Type:** Inter. Heavy use of small **uppercase, letter-spaced micro-labels** (e.g. "WEIGHT
  (LBS)", "BLOCK 1 OF 3") for a technical, data-driven feel.
- **Tabular numbers** utility exists for aligning logged numbers — keep numeric data legible.
- **Icons:** lucide-react.
- **Primitives:** shadcn/ui on Radix.

If you keep tokens as CSS variables in the same names, the reskin drops in with near-zero
engineering friction — but renaming/adding tokens is fine; engineering will map them.

### 6.2 Component primitives to cover
Restyle each: **Button** (default/outline/icon, sizes), **Card** (+ header/title/description/
content/footer), **Input**, **Textarea**, **Label**, **Checkbox**, **Select**, **Tabs**,
**Dialog** (modal/confirm), **Sheet** (slide-out for quick edits), **Popover**, **Command**
(searchable picker), **Form** field/label/error. Plus app-specific elements: **badges** (workout
type, block type, PR type, session state, cardio format, bodyweight), **progress bars** (macros),
**bottom tab bar**, **queue/sync indicator**.

### 6.3 Touch & PWA constraints (must survive the redesign)
- Minimum **44px touch targets**; one-handed, thumb-reachable primary actions.
- **Safe-area insets** (notch / home indicator) — bottom nav and sticky CTAs must respect them.
- Installed standalone PWA, **portrait**, dark-capable. Don't design anything that assumes a
  browser chrome or desktop hover as the only affordance.

---

## 7. Aesthetic direction (open canvas — design goals as the rubric)

Judge every visual choice against these goals:
- **Gym-legible.** Glanceable at arm's length, high contrast, large tap targets — usable with
  sweaty hands, gloves, bad lighting, mid-set, one hand.
- **Fast data entry.** Logging sets and meals should feel effortless and quick; minimize taps and
  keyboard friction; make numbers prominent and tabular.
- **Serious, not influencer.** This is a methodology tool for committed lifters and a coach's
  professional workspace — credible and focused, not gamified/cutesy, not hype-fitness.
- **Trustworthy with client data.** Once clients exist, the app holds other people's training and
  body data. The coaching surfaces should feel professional and private.
- **Calm hierarchy.** The current design leans on dense uppercase labels and thin borders;
  improve hierarchy, depth, and motion so the eye lands on what matters (today's work, the next
  set, whether macros are in range).

Light vs dark, palette, type pairing, and motion language are yours to propose. Provide a clear
rationale and a tokenized system so it can be implemented consistently.

---

## 8. NEW — Client coaching feature (design from scratch)

> **Important:** This feature has **no backend yet** — no tables, roles, or permissions exist.
> This section is a **design-first** spec. Engineering will build the data layer in a later
> phase. Design it so the **client-facing screens reuse the existing lifter patterns** (Today /
> Plan / Logger / Nutrition / History) as much as possible — that maximizes reuse when it's wired.

**Roles:** two kinds of user — **Coach** (the app owner) and **Client** (people the coach
onboards). Clients get their own login and log their own workouts/nutrition. A client only ever
sees their own data. A coach sees their own training **and** a coaching surface for clients.

### 8.1 Coach experience — design these screens
- **Clients roster:** list of the coach's clients with at-a-glance status — last activity,
  adherence (sessions completed vs assigned), recent PRs, and a flag for anyone falling behind.
  Include an **empty state** (no clients yet) and a clear **Onboard a client / Invite** action.
- **Onboard a client flow:** invite by email (and/or share a join link); capture the client's
  starting profile (goal mode, bodyweight/height) or let them fill it on first login. Show the
  pending/accepted state.
- **Client detail (the coach's per-client workspace):**
  - **Assign training** — pick a plan / assign workouts and blocks from the coach's existing
    **Library** to the client; set the client's weekly schedule.
  - **Set nutrition targets** for the client.
  - **Review progress** — the client's logged sets, PR timeline, completed-workout history, and
    nutrition adherence over time. Charts welcome.
  - **Coach notes** — leave notes/feedback the client can see.
- **Notifications / activity feed (optional but valuable):** new PRs, missed sessions, completed
  workouts across the roster.

### 8.2 Client experience — design these screens
- Essentially the existing app **scoped to the client's assigned plan**: their **Today**, **Plan**
  (read-mostly — assigned by coach), **Logger**, **Nutrition**, **History**.
- A lightweight sense of **"who's my coach"** and a place to see **coach notes / assigned targets**.
- Clients generally **don't author** their own library/plans (the coach does) — so the client IA
  is simpler than the coach's. Decide how much self-service (if any) a client gets.

### 8.3 Cross-cutting
- **Role entry / switching:** how does a coach move between "my training" and "my clients"? How
  does the app know on login whether you're a coach or a client and show the right shell? Propose
  this — it's a key IA decision (§3).
- **Permissions framing in the UI:** the client owns their data; the coach can view it and assign
  to them. Make that relationship legible and respectful in the design (no feeling of surveillance;
  it's coaching).
- **Empty/first-run states** for both roles.

---

## 9. THE WIRING CONTRACT — do not break

This is the most important section for a clean handoff. Redesign the presentation; keep the
contract below identical so re-integration is mechanical. All of these are real, verified exports
in the codebase.

### 9.1 Mutation functions (forms must still submit to these)
All return a result shaped like `{ ok, data?, error? }`. Restyle the forms; keep what they call
and the values they pass.
- **Nutrition** (`src/lib/nutrition/mutations.ts`): `logMeal`, `updateMeal`, `deleteMeal`,
  `upsertTargets`.
- **Library** (`src/lib/library/mutations.ts`): `createBlock`, `updateBlock`, `createExercise`,
  `updateExercise`, `createCardioActivity`, `updateCardioActivity`, `createRecoveryActivity`,
  `updateRecoveryActivity`, `createWorkoutDef`, `updateWorkoutDef`; deletion via
  `getDeletionImpact` + `deleteLibraryItem` (a single generic delete with an impact check — keep
  the "show what will be affected before deleting" UX).
- **Plan** (`src/lib/plan/mutations.ts`): `savePlan`, `saveDay`.
- **Sync** (`src/lib/sync/`): `useQueueState(userId)` (read sync state in components),
  `getDrainState()`, and the queue is drained for a user — the UI observes, it doesn't own.

### 9.2 View-model / projection shapes (props components receive)
Keep these prop shapes; restyle how they render. Real types:
- **Nutrition** (`src/lib/nutrition/projections.ts`): `NutritionTargets`, `MealEntry`, `MacroBar`,
  `MacroTotals`, `Range`, `NutritionDayType`.
- **Library** (`src/lib/library/projections.ts`): `LiftingBlockSummary`, `LiftingBlockDetail`,
  `LiftingExerciseInBlock`, `ExerciseListItem`, `CardioActivity`, `RecoveryActivity`,
  `WorkoutDefSummary`, `WorkoutDefDetail`, `BlockInWorkoutDef`, `WorkoutType`.
- **Plan** (`src/lib/plan/projections.ts`): `DayEditData`, `EditableWorkoutRow`, `PlanEditData`,
  `PlanEditDay`, `PlanEditWorkout`, `WorkoutDefOption`.
- **Logger** (`src/lib/methodology/workout-state.ts`): `LoggerWorkout`, `LoggerBlock`,
  `LoggerExercise`, `LoggerSetLog` (carries `prTypes`), `WorkoutCompletionRecord`.

### 9.3 Form field names (these map 1:1 to DB columns — keep the names)
Relabel freely in the UI, but the underlying field names are fixed. Examples:
- Sets: `weight_kg` (shown as lbs), `reps`, `is_to_failure`, `notes`, `set_index`.
- Meals/targets: `cal_min`/`cal_max`, `protein_min_g`/`protein_max_g`, `carbs_min_g`/
  `carbs_max_g`, `fat_min_g`/`fat_max_g`, `meal_type`, `note`.
- Exercises: `name`, `muscle_groups`, `is_bodyweight`, `prescribed_min`/`prescribed_max`, `notes`.

### 9.4 Database schema & enums (fixed)
Tables and enum values cannot be renamed by the redesign:
- Enums: `goal_mode` (cut / maintain / lean_bulk), `session_type` (lifting / cardio / recovery),
  `timing` (am / anytime / pm), `block_category` (lifting / cardio / recovery), `block_type`
  (failure / mobility / corrective), cardio format & target-zone enums, `pr_type` (weight /
  in_range_rep), day-of-week (mon…sun).
- **Append-only tables:** `set_logs` and `pr_history` are INSERT/SELECT only — **never** design
  an "edit set" or "delete PR" affordance. (You can design *log another set* / *correct via a new
  entry*, but logged history is immutable.)

### 9.5 Offline queue invariants (the sync indicator must keep working)
- localStorage namespace `training-app:queue`, change event `queue-change`, four queue row kinds
  (set-log insert, completion start, block-complete, completion end).
- The UI **must** keep surfacing sync state (pending count / syncing / retry) wherever logging
  happens. Design it as a real, trustworthy element — users log offline and need to know it saved.

### 9.6 Architecture expectations
- **Server-first data flow:** pages fetch data and pass projections to thin client components.
  Don't design anything that assumes a new global client-side store / state library.
- **Pure business logic stays put:** all methodology (PR detection, range/nutrition math, block
  completion, schedule rules) lives in pure modules and is fixed. The UI only presents results —
  don't bake business rules into the design that contradict §2's methodology.

---

## 10. Deliverables checklist for Claude Design

- [ ] Tokenized visual system (color, type, spacing, radius, elevation, motion), light/dark as
      proposed, with rationale.
- [ ] Every primitive in §6.2 restyled.
- [ ] Every screen in §4 designed (incl. the two **History** "coming soon" screens), with
      empty / loading / error states where relevant.
- [ ] The **Logger** treated as the flagship — fast set entry, inline PR moments, trustworthy
      sync indicator.
- [ ] The **macro range-vs-range** progress model designed so "in range" is instantly readable.
- [ ] The full **coaching** surface in §8 (coach roster, onboarding, client detail/assign/review;
      client-scoped app), with the role-entry model proposed.
- [ ] A proposed **navigation / IA** that serves both roles and keeps the lifter hot path fast.
- [ ] Notes mapping new components back to the existing `src/components/<area>/` tree.
- [ ] Respect every item in §9 (the wiring contract).

---

*Engineering appendix — key files (for the eventual re-integration, not for the designer to read
into):* tokens in `src/app/globals.css` + `tailwind.config.ts`; primitives in
`src/components/ui/*`; feature components in `src/components/{today,plan,log,library,nutrition,
history,layout}/*`; routes in `src/app/(app)/**/page.tsx`; contract in `src/lib/methodology/*`,
`src/lib/{plan,nutrition,library,history}/{queries,mutations,projections,schemas}.ts`,
`src/lib/sync/*`, `src/lib/supabase/types.ts`; AI macro estimation in
`src/app/api/estimate-macros/route.ts`.
