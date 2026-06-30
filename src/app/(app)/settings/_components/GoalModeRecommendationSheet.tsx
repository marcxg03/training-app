"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  applyTargetToggles,
  goalModeDefaultTargets,
  type GoalMode,
  type NutritionTargetValues,
  type TargetToggles,
} from "@/lib/methodology/nutrition";
import { upsertTargets } from "@/lib/nutrition/mutations";
import type { NutritionTargets } from "@/lib/nutrition/projections";
import { createClient } from "@/lib/supabase/client";

type GoalModeRecommendationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  newMode: GoalMode;
  currentTargets: NutritionTargets | null;
  onResolved: () => void;
};

const GROUPS: {
  label: string;
  unit: string;
  min: keyof NutritionTargetValues;
  max: keyof NutritionTargetValues;
}[] = [
  { label: "Calories", unit: "kcal", min: "cal_min", max: "cal_max" },
  { label: "Protein", unit: "g", min: "protein_min_g", max: "protein_max_g" },
  { label: "Carbs", unit: "g", min: "carbs_min_g", max: "carbs_max_g" },
  { label: "Fat", unit: "g", min: "fat_min_g", max: "fat_max_g" },
];

const MODE_LABEL: Record<GoalMode, string> = {
  cut: "Cut",
  maintain: "Maintain",
  lean_bulk: "Lean bulk",
};

export function GoalModeRecommendationSheet({
  open,
  onOpenChange,
  userId,
  newMode,
  currentTargets,
  onResolved,
}: GoalModeRecommendationSheetProps) {
  const recommended = useMemo(() => goalModeDefaultTargets(newMode), [newMode]);
  // With no targets yet, the recommended set is the merge base, so un-toggled
  // fields still resolve to a valid (recommended) value.
  const base: NutritionTargetValues = currentTargets ?? recommended;
  // Default each group's toggle on when its values would actually change (or
  // when there are no targets yet) — matches the spec's "apply default" intent.
  const [groupToggles, setGroupToggles] = useState<Record<string, boolean>>(
    () =>
      GROUPS.reduce<Record<string, boolean>>((acc, group) => {
        acc[group.label] =
          !currentTargets ||
          currentTargets[group.min] !== recommended[group.min] ||
          currentTargets[group.max] !== recommended[group.max];
        return acc;
      }, {}),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const close = () => {
    setSubmitError(null);
    onOpenChange(false);
  };

  const handleApply = async () => {
    setSubmitError(null);
    setSubmitting(true);

    const toggles = GROUPS.reduce((acc, group) => {
      const on = groupToggles[group.label] ?? false;
      acc[group.min] = on;
      acc[group.max] = on;
      return acc;
    }, {} as TargetToggles);

    const next = applyTargetToggles(base, recommended, toggles);
    const supabase = createClient();
    const result = await upsertTargets(supabase, userId, next);
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    onOpenChange(false);
    onResolved();
  };

  const handleSkip = () => {
    close();
    onResolved();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleSkip();
        }
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto max-w-2xl overflow-y-auto rounded-t-[var(--radius)] bg-card"
      >
        <SheetHeader className="space-y-3 text-left">
          <span className="bg-accent/12 flex h-12 w-12 items-center justify-center rounded-xl text-accent">
            <ArrowDownUp className="h-6 w-6" />
          </span>
          <SheetTitle className="text-xl font-semibold tracking-tight">
            Switch to {MODE_LABEL[newMode]}?
          </SheetTitle>
          <SheetDescription className="text-sm leading-relaxed text-subtle">
            {currentTargets
              ? "Choose which ranges to update to the recommended defaults for your new goal mode. Unchecked rows keep their current values."
              : "You don't have targets yet — applying creates them from the recommended defaults."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {GROUPS.map((group) => {
            const checked = groupToggles[group.label] ?? false;
            return (
              <label
                key={group.label}
                className="flex items-center gap-3 rounded-xl border border-border bg-card-alt p-4"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) =>
                    setGroupToggles((prev) => ({
                      ...prev,
                      [group.label]: Boolean(value),
                    }))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {group.label}{" "}
                    <span className="font-mono text-xs text-subtle">
                      ({group.unit})
                    </span>
                  </span>
                  <span className="block font-mono text-xs tabular-nums text-subtle">
                    {currentTargets
                      ? `${currentTargets[group.min]}–${currentTargets[group.max]}`
                      : "—"}{" "}
                    <span className="text-accent">
                      → {recommended[group.min]}–{recommended[group.max]}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {submitError ? (
          <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {submitError}
          </div>
        ) : null}

        <div className="mt-6 flex gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleSkip}
          >
            Keep current
          </Button>
          <Button
            type="button"
            className="flex-[1.3]"
            onClick={handleApply}
            disabled={submitting}
          >
            Apply selected
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
