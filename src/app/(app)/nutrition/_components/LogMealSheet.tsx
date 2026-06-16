"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";

import { useDiscardChangesGuard } from "@/app/(app)/library/_components/DiscardChangesDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { macroCalories } from "@/lib/methodology/nutrition";
import { logMeal, updateMeal } from "@/lib/nutrition/mutations";
import type { MealEntry } from "@/lib/nutrition/projections";
import { mealSchema, type MealFormValues } from "@/lib/nutrition/schemas";
import { createClient } from "@/lib/supabase/client";

type LogMealSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  date: string;
  meal?: MealEntry;
};

type MacroKey = "protein" | "carbs" | "fat";

const MACROS: {
  key: MacroKey;
  label: string;
  min: keyof MealFormValues;
  max: keyof MealFormValues;
}[] = [
  {
    key: "protein",
    label: "Protein (g)",
    min: "protein_min_g",
    max: "protein_max_g",
  },
  { key: "carbs", label: "Carbs (g)", min: "carbs_min_g", max: "carbs_max_g" },
  { key: "fat", label: "Fat (g)", min: "fat_min_g", max: "fat_max_g" },
];

const EMPTY: MealFormValues = {
  meal_type: "",
  protein_min_g: Number.NaN,
  protein_max_g: Number.NaN,
  carbs_min_g: Number.NaN,
  carbs_max_g: Number.NaN,
  fat_min_g: Number.NaN,
  fat_max_g: Number.NaN,
  note: "",
};

function mealToValues(meal: MealEntry): MealFormValues {
  return {
    meal_type: meal.meal_type,
    protein_min_g: meal.protein_min_g,
    protein_max_g: meal.protein_max_g,
    carbs_min_g: meal.carbs_min_g,
    carbs_max_g: meal.carbs_max_g,
    fat_min_g: meal.fat_min_g,
    fat_max_g: meal.fat_max_g,
    note: meal.note ?? "",
  };
}

const num = (value: number) => (Number.isNaN(value) ? 0 : value);

export function LogMealSheet({
  open,
  onOpenChange,
  userId,
  date,
  meal,
}: LogMealSheetProps) {
  const router = useRouter();
  const isEdit = Boolean(meal);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = useMemo(
    () => (meal ? mealToValues(meal) : EMPTY),
    [meal],
  );
  const [rangeMode, setRangeMode] = useState(false);

  const form = useForm<MealFormValues, unknown, MealFormValues>({
    resolver: zodResolver(mealSchema),
    defaultValues,
    mode: "onBlur",
  });
  const { discardDialog, requestConfirmation } = useDiscardChangesGuard({
    isDirty: form.formState.isDirty,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setSubmitError(null);
    // Open in range mode if the meal being edited already has any range.
    setRangeMode(
      meal
        ? meal.protein_min_g !== meal.protein_max_g ||
            meal.carbs_min_g !== meal.carbs_max_g ||
            meal.fat_min_g !== meal.fat_max_g
        : false,
    );
  }, [defaultValues, form, open, meal]);

  const watched = useWatch({ control: form.control });
  const calMin = macroCalories(
    num(watched.protein_min_g ?? Number.NaN),
    num(watched.carbs_min_g ?? Number.NaN),
    num(watched.fat_min_g ?? Number.NaN),
  );
  const calMax = macroCalories(
    num(watched.protein_max_g ?? Number.NaN),
    num(watched.carbs_max_g ?? Number.NaN),
    num(watched.fat_max_g ?? Number.NaN),
  );
  const calLabel = calMin === calMax ? `${calMin}` : `${calMin}–${calMax}`;

  const closeSheet = () => {
    form.reset(defaultValues);
    setSubmitError(null);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    requestConfirmation(closeSheet);
  };

  const handleSubmit = async (values: MealFormValues) => {
    setSubmitError(null);
    const supabase = createClient();
    const result = meal
      ? await updateMeal(supabase, meal.meal_id, values)
      : await logMeal(supabase, userId, date, values);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    router.refresh();
    closeSheet();
  };

  const setExact = (macro: (typeof MACROS)[number], value: number) => {
    form.setValue(macro.min, value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(macro.max, value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  // Leaving range mode collapses each max to its min so the single-input view
  // is WYSIWYG (a meal shown as one value is saved as exact, not a stale range).
  const handleRangeModeChange = (next: boolean) => {
    if (!next) {
      for (const macro of MACROS) {
        form.setValue(macro.max, form.getValues(macro.min), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
    setRangeMode(next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-2xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>{isEdit ? "Edit meal" : "Log meal"}</SheetTitle>
            <SheetDescription>
              Enter grams of protein, carbs, and fat — calories are derived
              automatically. Toggle ranges to log an estimate.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <Form {...form}>
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void form.handleSubmit(handleSubmit)(event);
                }}
              >
                <FormField
                  control={form.control}
                  name="meal_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meal</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="off"
                          placeholder="Breakfast, Lunch, Snack…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={rangeMode}
                    onCheckedChange={(value) =>
                      handleRangeModeChange(Boolean(value))
                    }
                  />
                  Log as ranges (min–max)
                </label>

                <div className="space-y-3">
                  {MACROS.map((macro) => (
                    <div key={macro.key} className="space-y-1.5">
                      <Label>{macro.label}</Label>
                      {rangeMode ? (
                        <div className="grid grid-cols-2 gap-3">
                          {(["min", "max"] as const).map((bound) => (
                            <FormField
                              key={bound}
                              control={form.control}
                              name={macro[bound]}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      min={0}
                                      placeholder={
                                        bound === "min" ? "Low" : "High"
                                      }
                                      value={
                                        Number.isNaN(field.value as number)
                                          ? ""
                                          : (field.value as number)
                                      }
                                      onBlur={field.onBlur}
                                      name={field.name}
                                      ref={field.ref}
                                      onChange={(event) =>
                                        field.onChange(
                                          event.currentTarget.valueAsNumber,
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      ) : (
                        <FormField
                          control={form.control}
                          name={macro.min}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  value={
                                    Number.isNaN(field.value as number)
                                      ? ""
                                      : (field.value as number)
                                  }
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                  onChange={(event) =>
                                    setExact(
                                      macro,
                                      event.currentTarget.valueAsNumber,
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Calories
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    {calLabel} kcal
                  </span>
                </div>

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note (optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {submitError ? (
                  <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {submitError}
                  </div>
                ) : null}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => requestConfirmation(closeSheet)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {isEdit ? "Save changes" : "Log meal"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>
      {discardDialog}
    </>
  );
}
