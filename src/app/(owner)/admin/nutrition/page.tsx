import { TargetsForm } from "@/app/(app)/nutrition/_components/TargetsForm";
import { requireOwner } from "@/lib/auth/requireOwner";
import { getGoalMode, getNutritionTargets } from "@/lib/nutrition/queries";

/**
 * /admin/nutrition — nutrition targets, inside the builder (T3-F).
 *
 * WHY THIS EXISTS: targets could only be set at `/nutrition/targets`, a MEMBER
 * route in the phone shell. So from the admin hub they were unreachable —
 * Marcus reported exactly that ("i can't set nutrition targets"), and the
 * audit confirmed no admin surface linked to them at all. Opening the member
 * route from the hub would have been the same dead end T3-B removed for the
 * Library: correct destination, wrong chrome, no way back.
 *
 * It renders the SAME `TargetsForm` the member route does, deliberately.
 * Targets are one row in `nutrition_targets` keyed by user, so two forms would
 * be two ways to write one record and an invitation for them to drift. The
 * member route keeps its own page because a member needs to set their own
 * targets on their phone; this is the desktop door to the same form.
 */
export default async function AdminNutritionPage() {
  const ownerId = await requireOwner();

  const [targets, goalMode] = await Promise.all([
    getNutritionTargets(),
    getGoalMode(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1.5">
        <p className="eyebrow">Owner · Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Nutrition targets
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          The calorie and macro ranges the Nutrition tab measures against. Goal
          mode shifts the ranges; the numbers stay yours to override.
        </p>
      </header>

      <div className="max-w-2xl">
        <TargetsForm
          userId={ownerId}
          initialValues={targets}
          goalMode={goalMode}
        />
      </div>
    </div>
  );
}
