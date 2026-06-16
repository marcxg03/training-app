"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
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
};

/** Formats a [min, max] range, collapsing to a single value when exact. */
function range(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

export function MealsSection({ meals, userId, date }: MealsSectionProps) {
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
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Meals</h2>
        <Button onClick={openCreate}>Log meal</Button>
      </div>

      {meals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No meals logged yet today. Tap “Log meal” to start.
        </div>
      ) : (
        <ul className="space-y-2">
          {meals.map((meal) => (
            <li
              key={meal.meal_id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-foreground">
                  {meal.meal_type}
                </span>
                <div className="flex items-center gap-1">
                  <span className="mr-1 text-sm tabular-nums text-muted-foreground">
                    {range(meal.cal_min, meal.cal_max)} kcal
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    aria-label="Edit meal"
                    onClick={() => openEdit(meal)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    aria-label="Delete meal"
                    onClick={() => setDeleteTarget(meal)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-1 text-sm tabular-nums text-muted-foreground">
                P {range(meal.protein_min_g, meal.protein_max_g)}g · C{" "}
                {range(meal.carbs_min_g, meal.carbs_max_g)}g · F{" "}
                {range(meal.fat_min_g, meal.fat_max_g)}g
              </div>
              {meal.note ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {meal.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <LogMealSheet
        key={editing?.meal_id ?? "new"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        userId={userId}
        date={date}
        meal={editing}
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
