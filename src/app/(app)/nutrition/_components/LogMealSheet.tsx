"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, ImageIcon, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";

import { useDiscardChangesGuard } from "@/components/shared/DiscardChangesDialog";
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
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  type AcceptedImageType,
  type MacroEstimate,
} from "@/lib/nutrition/macro-estimate";
import { macroCalories } from "@/lib/methodology/nutrition";
import { logMeal, updateMeal } from "@/lib/nutrition/mutations";
import type { MealEntry } from "@/lib/nutrition/projections";
import { mealSchema, type MealFormValues } from "@/lib/nutrition/schemas";
import { createClient } from "@/lib/supabase/client";

/**
 * The single meal-entry surface. All three input paths live in here — photo,
 * description + AI estimate, and manual P/C/F — and the user picks whichever
 * one they want once the sheet is open. Nutrition therefore shows ONE "Log
 * meal" button rather than three pre-committing entry buttons (Marcus,
 * 2026-09-23); there is deliberately no `intent` nudge or auto-focus.
 */
type LogMealSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  date: string;
  meal?: MealEntry;
  /** Whether the Claude-vision photo estimator is configured (ANTHROPIC_API_KEY). */
  aiEnabled: boolean;
  /** When editing, a request to delete this meal (parent owns the confirm). */
  onDelete?: () => void;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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
  aiEnabled,
  onDelete,
}: LogMealSheetProps) {
  const router = useRouter();
  const isEdit = Boolean(meal);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = useMemo(
    () => (meal ? mealToValues(meal) : EMPTY),
    [meal],
  );
  const [rangeMode, setRangeMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

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
    setEstimateError(null);
    setEstimating(false);
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

  // A photo estimate is inherently a range, so it always lands in range mode.
  // Macros are prefilled outright; name/note only fill when the user left them
  // blank, so estimating never clobbers what they already typed.
  const applyEstimate = (estimate: MacroEstimate) => {
    setRangeMode(true);
    const set = (name: keyof MealFormValues, value: number | string) =>
      form.setValue(name, value as never, {
        shouldDirty: true,
        shouldValidate: true,
      });
    set("protein_min_g", estimate.protein_min_g);
    set("protein_max_g", estimate.protein_max_g);
    set("carbs_min_g", estimate.carbs_min_g);
    set("carbs_max_g", estimate.carbs_max_g);
    set("fat_min_g", estimate.fat_min_g);
    set("fat_max_g", estimate.fat_max_g);
    if (!form.getValues("meal_type")) {
      set("meal_type", estimate.meal_type);
    }
    if (!form.getValues("note")) {
      set("note", estimate.notes);
    }
  };

  // Shared estimate call — works with a photo, a description, or both. Always
  // sends the current description; the route requires at least one input.
  const runEstimate = async (image?: { base64: string; mediaType: string }) => {
    setEstimateError(null);
    setEstimating(true);
    try {
      const response = await fetch("/api/estimate-macros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: image?.base64,
          mediaType: image?.mediaType,
          note: form.getValues("note"),
        }),
      });
      const data = (await response.json()) as MacroEstimate | { error: string };
      if (!response.ok) {
        setEstimateError("error" in data ? data.error : "Estimation failed.");
        return;
      }
      applyEstimate(data as MacroEstimate);
    } catch {
      setEstimateError("Estimation failed. Enter macros manually.");
    } finally {
      setEstimating(false);
    }
  };

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    if (!file) {
      return;
    }
    setEstimateError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as AcceptedImageType)) {
      setEstimateError("Use a JPEG, PNG, WebP, or GIF photo.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setEstimateError("That photo is too large. Try one under 4 MB.");
      return;
    }
    const dataUrl = await readAsDataUrl(file);
    const base64 = dataUrl.split(",")[1] ?? "";
    await runEstimate({ base64, mediaType: file.type });
  };

  const handleDescribe = async () => {
    if (!form.getValues("note")?.trim()) {
      setEstimateError("Write a description of the meal first.");
      return;
    }
    await runEstimate();
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
              {aiEnabled
                ? "Three ways, your pick: add a photo, describe it and let AI estimate, or enter protein, carbs, and fat yourself. Calories always derive automatically."
                : "Enter grams of protein, carbs, and fat — calories are derived automatically. Toggle ranges to log an estimate."}
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
                      <FormLabel className="eyebrow">Meal type</FormLabel>
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

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="eyebrow">
                        Description{aiEnabled ? "" : " (optional)"}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={
                            aiEnabled
                              ? "e.g. 8 oz grilled chicken, 1.5 cups rice, drizzle of olive oil"
                              : "Optional note"
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {aiEnabled ? (
                  <div className="space-y-1.5">
                    {/* Two inputs so the primary control is camera-first
                        (Marcus's call) while an existing photo is still
                        reachable: `capture="environment"` jumps straight to
                        the rear camera on iOS/Android; the library input omits
                        `capture` so the OS shows the photo picker. */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhoto}
                    />
                    <input
                      ref={libraryInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhoto}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={estimating}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-cardio bg-cardio/10 px-3 py-3 text-xs font-bold uppercase tracking-[0.06em] text-cardio transition-colors hover:bg-cardio/15 disabled:pointer-events-none disabled:opacity-60"
                      >
                        <Camera className="h-5 w-5" />
                        Photo
                      </button>
                      <button
                        type="button"
                        disabled={estimating}
                        onClick={handleDescribe}
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-cardio bg-cardio/10 px-3 py-3 text-xs font-bold uppercase tracking-[0.06em] text-cardio transition-colors hover:bg-cardio/15 disabled:pointer-events-none disabled:opacity-60"
                      >
                        <Sparkles className="h-5 w-5" />
                        Description
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={estimating}
                      onClick={() => libraryInputRef.current?.click()}
                      className="flex min-h-11 w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-subtle disabled:pointer-events-none disabled:opacity-60"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Choose an existing photo
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {estimating
                        ? "Estimating…"
                        : "Estimate macros from a photo, your description, or both — Claude fills the fields for you to review. Or enter them manually below."}
                    </p>
                    {estimateError ? (
                      <p className="text-sm text-danger">{estimateError}</p>
                    ) : null}
                  </div>
                ) : null}

                {/* The third path: entering P/C/F by hand. Labelled so it reads
                    as a real option next to the two AI controls above, not as
                    the leftover fields they happen to fill. */}
                {aiEnabled ? (
                  <p className="eyebrow pt-1">Or enter macros yourself</p>
                ) : null}

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
                      <Label className="eyebrow">{macro.label}</Label>
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

                <div className="flex items-center justify-between rounded-xl border border-border bg-card-alt px-4 py-3">
                  <span className="eyebrow">Calories</span>
                  <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                    {calLabel} kcal
                  </span>
                </div>

                {submitError ? (
                  <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {submitError}
                  </div>
                ) : null}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  {isEdit && onDelete ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onDelete}
                      className="gap-2 border-danger/40 text-danger hover:bg-danger/10 hover:text-danger sm:mr-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  ) : null}
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
