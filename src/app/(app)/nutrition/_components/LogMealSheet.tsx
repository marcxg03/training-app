"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";

import { useDiscardChangesGuard } from "@/app/(app)/library/_components/DiscardChangesDialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { macroCalories } from "@/lib/methodology/nutrition";
import { logMeal } from "@/lib/nutrition/mutations";
import { mealSchema, type MealFormValues } from "@/lib/nutrition/schemas";
import { createClient } from "@/lib/supabase/client";

type LogMealSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  date: string;
};

const EMPTY_MEAL: MealFormValues = {
  meal_type: "",
  protein_g: Number.NaN,
  carbs_g: Number.NaN,
  fat_g: Number.NaN,
  note: "",
};

const MACRO_FIELDS = [
  { name: "protein_g", label: "Protein (g)" },
  { name: "carbs_g", label: "Carbs (g)" },
  { name: "fat_g", label: "Fat (g)" },
] as const;

export function LogMealSheet({
  open,
  onOpenChange,
  userId,
  date,
}: LogMealSheetProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<MealFormValues>({
    resolver: zodResolver(mealSchema),
    defaultValues: EMPTY_MEAL,
    mode: "onBlur",
  });
  const { discardDialog, requestConfirmation } = useDiscardChangesGuard({
    isDirty: form.formState.isDirty,
  });

  const [protein, carbs, fat] = useWatch({
    control: form.control,
    name: ["protein_g", "carbs_g", "fat_g"],
  });
  const previewCalories = macroCalories(
    Number.isNaN(protein) ? 0 : protein,
    Number.isNaN(carbs) ? 0 : carbs,
    Number.isNaN(fat) ? 0 : fat,
  );

  useEffect(() => {
    form.reset(EMPTY_MEAL);
    setSubmitError(null);
  }, [form, open]);

  const closeSheet = () => {
    form.reset(EMPTY_MEAL);
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
    const result = await logMeal(supabase, userId, date, values);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    router.refresh();
    closeSheet();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-2xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Log meal</SheetTitle>
            <SheetDescription>
              Enter grams of protein, carbs, and fat — calories are derived
              automatically.
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

                <div className="grid grid-cols-3 gap-3">
                  {MACRO_FIELDS.map((macro) => (
                    <FormField
                      key={macro.name}
                      control={form.control}
                      name={macro.name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{macro.label}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              value={
                                Number.isNaN(field.value) ? "" : field.value
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

                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Calories
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    {previewCalories} kcal
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
                    Log meal
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
