"use client";

import { useState } from "react";
import { Camera, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { LogMealSheet } from "@/app/(app)/nutrition/_components/LogMealSheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteMeal } from "@/lib/nutrition/mutations";
import type { MealEntry } from "@/lib/nutrition/projections";
import { createClient } from "@/lib/supabase/client";

type MealsSectionProps = {
  meals: MealEntry[];
  userId: string;
  date: string;
  aiEnabled: boolean;
};

/** Formats a [min, max] range, collapsing to a single value when exact. */
function range(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

export function MealsSection({
  meals,
  userId,
  date,
  aiEnabled,
}: MealsSectionProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<MealEntry | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<MealEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setSheetOpen(true);
  };

  const openEdit = (meal: MealEntry) => {
    setEditing(meal);
    setSheetOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteMeal(createClient(), deleteTarget.meal_id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setDeleteTarget(null);
    router.refresh();
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow tracking-[0.16em]">Meals</h2>
        <span className="eyebrow tracking-[0.06em] text-faint">
          {meals.length} logged
        </span>
      </div>

      {meals.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No meals logged yet today. Tap “Log Meal” to start.
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {meals.map((meal) => (
            <li
              key={meal.meal_id}
              className="rounded-[14px] border border-border bg-card px-4 py-3.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-foreground">
                  {meal.meal_type}
                </span>
                <div className="flex items-center gap-1">
                  <span className="mr-1 font-mono text-xs font-semibold tabular-nums text-subtle">
                    {range(meal.cal_min, meal.cal_max)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 min-h-0 w-8"
                    aria-label="Edit meal"
                    onClick={() => openEdit(meal)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 min-h-0 w-8"
                    aria-label="Delete meal"
                    onClick={() => setDeleteTarget(meal)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tabular-nums tracking-[0.05em] text-faint">
                P {range(meal.protein_min_g, meal.protein_max_g)} · C{" "}
                {range(meal.carbs_min_g, meal.carbs_max_g)} · F{" "}
                {range(meal.fat_min_g, meal.fat_max_g)}
                {meal.note ? ` · ${meal.note.toUpperCase()}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2.5 pt-1.5">
        <Button
          type="button"
          onClick={openCreate}
          className="flex-1 gap-2 uppercase tracking-[0.07em]"
        >
          <Plus className="h-5 w-5" />
          Log Meal
        </Button>
        {aiEnabled ? (
          <Button
            type="button"
            variant="outline"
            onClick={openCreate}
            aria-label="Estimate a meal from a photo"
            className="gap-2 uppercase tracking-[0.05em]"
          >
            <Camera className="h-5 w-5 text-cardio" />
            AI
          </Button>
        ) : null}
      </div>

      <LogMealSheet
        key={editing?.meal_id ?? "new"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        userId={userId}
        date={date}
        meal={editing}
        aiEnabled={aiEnabled}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete meal?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This permanently removes “${deleteTarget.meal_type}” from today.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-sm text-danger">{deleteError}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmDelete} disabled={deleting}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
