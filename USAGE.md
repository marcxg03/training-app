# Using the Training App ("Instrument" UI)

A dark, data-dense PWA for block + bank lifting, schedule-anchored nutrition, and
append-only PR history. Mobile-first; install it to your home screen for the best
experience.

## Sign in

- Open the app → enter your email on the **Login** screen → **Send magic link**.
- Check your email and tap the link. No password.
- If a link expired, request a new one from the check-email screen.

## Install as an app (PWA)

- **iOS Safari:** Share → _Add to Home Screen_.
- **Android Chrome / desktop:** the install prompt, or browser menu → _Install_.
- Runs standalone, portrait, dark. Works offline (see below).

## The four tabs

### Today

Your day at a glance: the date, a 7-day strip (dots colored by session type —
purple = lift, teal = cardio, dim = rest), and today's sessions as cards. Tap a
**Lift** card's **Start Workout** to begin logging. The gear icon (top-right) opens
Settings; the "My Training" pill is the persona indicator.

### Plan

Your weekly schedule. The active plan drives Today, the week view, and your
nutrition day-type.

- **Edit** (top-right) renames the plan / manages rest days.
- Tap a day → **day detail**; from there **Edit** the day to add/remove/reorder
  workouts, set timing (AM / Anytime / PM) and gym, or toggle it a rest day.
- Use the plan selector to switch plans, or create a new one.

### Fuel (Nutrition)

- A **day-type framework** card tells you how to eat today (rest / lifting / cardio)
  for your goal mode.
- **Macro bars** show today's intake range vs. your target range — green = in range,
  amber = under, red = over.
- **Log Meal** to add a meal (type, calorie + macro ranges, notes). Tap **AI** to
  photograph a meal and have macros estimated — review/edit before saving (it never
  auto-saves). Requires `ANTHROPIC_API_KEY`; otherwise enter macros manually.
- The tune icon (top-right) sets your daily targets.

### Progress (History)

- **PR timeline** — your personal records over time; toggle _Last 90 days / All time_.
- **All workouts** — every completed session; tap one for a full recap.
- Tap an exercise to see its **progression chart** and PR history.

## Logging a workout (the core loop)

1. **Today** → tap a lift session → **Start Workout** (or open detail first to preview
   blocks).
2. For each **block**, pick the exercise you're actually doing from its **bank**
   ("Which exercise today?"). A block is a _choice set_, not a fixed lift.
3. Enter **weight** and **reps** (use the − / + steppers or type), toggle **to
   failure** if applicable, add notes, **Log Set**.
   - **Failure** blocks use a fixed warm-up → work-set-1 → work-set-2 progression.
   - **Free-form** blocks let you log as many sets as you want.
4. **PRs are detected automatically** as you log — a **WEIGHT PR** (accent) for a new
   heaviest set, an **IN-RANGE REP PR** (green) for more reps within the prescribed
   range. They show inline and on the summary.
5. Finish all blocks, or tap **End** to stop early (everything logged is already
   saved). You land on the **Summary** — volume, PRs, and your logged sets.

> Set and PR history are **append-only** — they accumulate and are never edited or
> deleted from the app. Log corrections as new sets.

## Offline

Logging works without a connection. Writes are saved locally and sync when you're
back online — watch the **sync indicator** (amber "syncing" → green "synced"). If you
open the app fully offline, you'll see an offline screen but logging stays usable.

## Settings & profile

Set your bodyweight, height, and **goal mode** (cut / maintain / lean bulk). Changing
goal mode suggests new nutrition targets you can accept or adjust. The **Library**
(exercises, blocks, workouts, cardio, recovery) is reached from Settings — build
exercises → blocks (banks) → workouts → assign to plan days.

## Coaching

The coaching features (client roster, assigning training, etc.) are **not available
yet** — they're built but waiting on their backend. They're hidden in this build. See
`ROLLOUT.md` and `KNOWN_ISSUES.md`.
