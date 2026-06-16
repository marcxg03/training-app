"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
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
import {
  caloriesConsistency,
  goalModeDefaultTargets,
  type GoalMode,
} from "@/lib/methodology/nutrition";
import { upsertTargets } from "@/lib/nutrition/mutations";
import type { NutritionTargets } from "@/lib/nutrition/projections";
import { targetsSchema, type TargetsFormValues } from "@/lib/nutrition/schemas";
import { createClient } from "@/lib/supabase/client";

type TargetsFormProps = {
  userId: string;
  initialValues: NutritionTargets | null;
  goalMode: GoalMode;
};

type FieldName = keyof TargetsFormValues;

const FIELD_GROUPS: {
  label: string;
  unit: string;
  min: FieldName;
  max: FieldName;
}[] = [
  { label: "Calories", unit: "kcal", min: "cal_min", max: "cal_max" },
  { label: "Protein", unit: "g", min: "protein_min_g", max: "protein_max_g" },
  { label: "Carbs", unit: "g", min: "carbs_min_g", max: "carbs_max_g" },
  { label: "Fat", unit: "g", min: "fat_min_g", max: "fat_max_g" },
];

export function TargetsForm({
  userId,
  initialValues,
  goalMode,
}: TargetsFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const seeded = !initialValues;
  const defaultValues = useMemo<TargetsFormValues>(
    () => initialValues ?? goalModeDefaultTargets(goalMode),
    [initialValues, goalMode],
  );
  const form = useForm<TargetsFormValues>({
    resolver: zodResolver(targetsSchema),
    defaultValues,
    mode: "onBlur",
  });
  const { discardDialog, requestConfirmation } = useDiscardChangesGuard({
    isDirty: form.formState.isDirty,
  });

  const watched = useWatch({ control: form.control });
  const consistency = useMemo(() => {
    const values = Object.values(watched ?? {});
    const allFilled =
      values.length === 8 &&
      values.every(
        (value) => typeof value === "number" && Number.isFinite(value),
      );
    if (!allFilled) {
      return null;
    }
    return caloriesConsistency(watched as TargetsFormValues);
  }, [watched]);

  const goBack = () => router.push("/nutrition");

  const handleSubmit = async (values: TargetsFormValues) => {
    setSubmitError(null);
    const supabase = createClient();
    const result = await upsertTargets(supabase, userId, values);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    router.push("/nutrition");
    router.refresh();
  };

  return (
    <>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => requestConfirmation(goBack)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to nutrition
        </button>

        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Nutrition
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Daily targets
          </h1>
          {seeded ? (
            <p className="text-sm text-muted-foreground">
              Pre-filled with {goalMode.replace("_", " ")} defaults — adjust to
              your numbers and save.
            </p>
          ) : null}
        </header>

        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(handleSubmit)(event);
            }}
          >
            <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
              {FIELD_GROUPS.map((group) => (
                <div key={group.label} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {group.label}{" "}
                    <span className="text-muted-foreground">
                      ({group.unit})
                    </span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["min", "max"] as const).map((bound) => {
                      const name = group[bound];
                      return (
                        <FormField
                          key={name}
                          control={form.control}
                          name={name}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">
                                {bound === "min" ? "Min" : "Max"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  inputMode="numeric"
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
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {consistency ? (
              <div
                className={
                  consistency.consistent
                    ? "rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
                    : "rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
                }
              >
                {consistency.message}
              </div>
            ) : null}

            {submitError ? (
              <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => requestConfirmation(goBack)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Save targets
              </Button>
            </div>
          </form>
        </Form>
      </div>
      {discardDialog}
    </>
  );
}
