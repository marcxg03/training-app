# SLICE_12_MULTIPLE_PLANS.md

> Slice 12 — Multiple training plans + active-plan switcher. Solo-built. No
> migration (uses existing `training_plans` + `daily_schedules`).

## Goal

Let the user keep several training plans and choose which one is active. The
active plan drives Today, the Plan week, the Plan Editor, and the Nutrition
day-type. Create + select + rename; delete is out of scope (cascade risk).

## Scope

- Plan switcher on `/plan`: a Select of the user's plans (active selected),
  switching activates that plan; "New plan" (name dialog) and "Rename" (active
  plan) dialogs.
- `createPlan` seeds a 7-day rest-day skeleton (`daily_schedules` mon–sun,
  is_rest_day=true); the new plan is inactive unless the user has no active
  plan (so there's always exactly one active).
- `activatePlan` enforces single-active in app code: deactivate the user's
  other plans, then activate the chosen one (deactivate-first so a partial
  failure degrades to zero-active/empty rather than two-active/crash).
- `renamePlan`; friendly 23505 ("name already exists").
- A new empty plan is built out via the existing Plan Editor (Slice 10).

## Contracts

- `src/lib/plan/plan-mutations.ts` (browser client): `createPlan`,
  `activatePlan`, `renamePlan` → `{ ok }` results.
- `src/app/(app)/plan/_components/PlanControls.tsx` (client): switcher +
  dialogs.
- `src/app/(app)/plan/page.tsx`: `getPlans()` + renders `PlanControls`;
  handles zero-plans / no-active states.

## Acceptance criteria

1. `/plan` shows a switcher with all plans; the active one is selected.
2. Create a plan → it appears in the switcher with a 7-day rest skeleton.
3. Switching the switcher activates that plan; Today/Plan/Nutrition follow.
4. Exactly one plan is active at all times (enforced in `activatePlan`).
5. Rename updates the active plan; duplicate names show a friendly error.
6. No migration, no new dependency, no delete. typecheck/lint/format/build
   clean.

## Out of scope (FUTURE_WORK)

- Atomic active-plan switch (RPC / partial unique index) — current switch is
  two non-transactional statements (KNOWN_ISSUES 🟡).
- Deleting a plan (cascades schedules → workouts → set_logs; needs guards).
- Cloning a plan.
