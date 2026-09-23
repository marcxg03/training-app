"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { LogMealSheet } from "@/app/(app)/nutrition/_components/LogMealSheet";
import { SessionRowButton } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteMeal } from "@/lib/nutrition/mutations";
import type { MealEntry } from "@/lib/nutrition/projections";
import { createClient } from "@/lib/supabase/client";

type MealsSectionProps = {
  meals: MealEntry[];
  userId: string;
  date: string;
  /** Whether the Claude macro estimator is configured (ANTHROPIC_API_KEY). */
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

  // ONE entry point (Marcus, 2026-09-23). The sheet itself already carries all
  // three input paths — photo, description + AI estimate, manual P/C/F — so the
  // user picks inside it rather than committing to a path out here.
  const openCreate = () => {
    setEditing(undefined);
    setSheetOpen(true);
  };

  // A tapped meal row opens the same sheet in edit mode.
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
    <section className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
        Today&apos;s meals
      </span>

      {meals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No meals logged yet today.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {meals.map((meal) => {
            const macrosStr = `P ${range(
              meal.protein_min_g,
              meal.protein_max_g,
            )} · C ${range(meal.carbs_min_g, meal.carbs_max_g)} · F ${range(
              meal.fat_min_g,
              meal.fat_max_g,
            )}`;
            // Macros are always shown; a note is appended (never replaces them).
            const subtitle = meal.note
              ? `${macrosStr} · ${meal.note}`
              : macrosStr;

            // FUTURE_WORK #12: meals don't yet persist a photo, so every row
            // shows the plain "badge" tile. When photo persistence lands, pass
            // the image as `icon` with iconVariant="accent" for a thumbnail.
            return (
              <SessionRowButton
                key={meal.meal_id}
                onClick={() => openEdit(meal)}
                aria-label={`Edit ${meal.meal_type}`}
                icon="◍"
                iconVariant="badge"
                title={meal.meal_type}
                subtitle={subtitle}
                trailing={
                  <span className="text-sm tabular-nums text-subtle">
                    {range(meal.cal_min, meal.cal_max)}
                  </span>
                }
              />
            );
          })}
        </div>
      )}

      {/* ONE log button — photo / description+AI / manual all live in the sheet */}
      <div className="flex flex-col gap-2 pt-1.5">
        <button
          type="button"
          onClick={openCreate}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-[12px] font-bold uppercase tracking-wider text-accent-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Log meal
        </button>
        <p className="px-1 text-[11px] leading-relaxed text-faint">
          {aiEnabled
            ? "Photo, description, or enter P/C/F yourself."
            : "Enter protein, carbs, and fat — calories auto-derive."}
        </p>
      </div>

      <LogMealSheet
        key={editing?.meal_id ?? "new"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        userId={userId}
        date={date}
        meal={editing}
        aiEnabled={aiEnabled}
        onDelete={
          editing
            ? () => {
                const target = editing;
                setSheetOpen(false);
                setDeleteTarget(target);
              }
            : undefined
        }
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
