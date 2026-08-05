# Future Work — Trends & Analytics build (2026-07-28)

Deferred deliberately; none block the shipped build.

## Charts / analytics

- **Range toggles** (7/30/90-day) on Trends sections — builders are already
  parameterized; a searchParams-driven re-render is all it needs.
- **Consistency heatmap** (workouts/week calendar) and **cardio load**
  (duration × perceived intensity from activity_completions) — the two chart
  ideas cut at scoping.
- **Historical meal dates**: evening meals logged before the timezone fix
  (2026-07-28) may carry the next day's `date` (they were filed by the UTC
  server clock). Cosmetic in trend charts; correct at source if it ever
  matters.

## Housekeeping

- **Regenerate `src/lib/supabase/types.ts`** after applying migrations
  021+022+023 (`supabase gen types`) — the bodyweight_logs,
  profiles.timezone, and set_logs.completion_id entries were hand-added to
  match the migrations and regen will also re-alphabetize them.
- **e2e hardening (D5)**: committed test password in `seed-auth.mjs`
  (pre-existing) — generate at runtime; e2e test-user email constant is
  duplicated across `env.ts` and the .mjs scripts — single-source it.
- **Analytics day-math home**: `dayKeyOf`/`weekKeyOf`/`dayLabelOf` still live
  in `analytics/projections.ts` (dayKeyDaysAgo already moved to `lib/time`).
  If a 4th consumer appears, finish the move (decision D7).
- **profiles UPDATE policies** rely on Postgres's implicit WITH CHECK
  defaulting; writing explicit `WITH CHECK` app-wide would make intent
  self-documenting (Security, cosmetic).

## Product ideas (unscoped)

- Backdated bodyweight/meal entry (log for a past day).
- Per-exercise e1RM goal lines on the progression charts.
