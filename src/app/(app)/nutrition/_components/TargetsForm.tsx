"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Control } from "react-hook-form";

import { useDiscardChangesGuard } from "@/app/(app)/library/_components/DiscardChangesDialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
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

const CALORIES_GROUP: { min: FieldName; max: FieldName } = {
  min: "cal_min",
  max: "cal_max",
};

const MACRO_GROUPS: {
  label: string;
  min: FieldName;
  max: FieldName;
}[] = [
  { label: "Protein", min: "protein_min_g", max: "protein_max_g" },
  { label: "Carbs", min: "carbs_min_g", max: "carbs_max_g" },
  { label: "Fat", min: "fat_min_g", max: "fat_max_g" },
];

const GOAL_MODES: { value: GoalMode; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "maintain", label: "Maintain" },
  { value: "lean_bulk", label: "Lean bulk" },
];

/** A single numeric range input (one bound). Centered mono value with the
 * accessible label; shares styling between the calorie and macro rows. */
function RangeField({
  control,
  name,
  label,
  inputClassName,
}: {
  control: Control<TargetsFormValues>;
  name: FieldName;
  label: string;
  inputClassName?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex-1">
          <FormControl>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label={label}
              className={`h-auto text-center font-mono font-semibold tabular-nums ${inputClassName ?? ""}`}
              value={Number.isNaN(field.value) ? "" : field.value}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              onChange={(event) =>
                field.onChange(event.currentTarget.valueAsNumber)
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

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
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between gap-4 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => requestConfirmation(goBack)}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <h1 className="text-sm font-semibold text-foreground">Targets</h1>
          <button
            type="submit"
            form="targets-form"
            disabled={form.formState.isSubmitting}
            className="text-sm font-bold text-accent transition-colors hover:text-accent/80 disabled:opacity-50"
          >
            Save
          </button>
        </header>

        {seeded ? (
          <p className="text-sm text-muted-foreground">
            Pre-filled with {goalMode.replace("_", " ")} defaults — adjust to
            your numbers and save.
          </p>
        ) : null}

        <Form {...form}>
          <form
            id="targets-form"
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(handleSubmit)(event);
            }}
          >
            <div className="space-y-2">
              <p className="eyebrow tracking-[0.16em]">Goal mode</p>
              <div className="flex gap-1.5 rounded-xl border border-border bg-input p-1.5">
                {GOAL_MODES.map((mode) => (
                  <span
                    key={mode.value}
                    aria-current={mode.value === goalMode ? "true" : undefined}
                    className={
                      mode.value === goalMode
                        ? "flex-1 rounded-lg bg-accent py-2.5 text-center font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-accent-foreground"
                        : "flex-1 rounded-lg py-2.5 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground"
                    }
                  >
                    {mode.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="eyebrow tracking-[0.16em]">
                Daily calories · range
              </p>
              <div className="flex items-center gap-2.5">
                <RangeField
                  control={form.control}
                  name={CALORIES_GROUP.min}
                  label="Calories minimum"
                  inputClassName="py-3 text-lg"
                />
                <span className="font-mono text-sm font-semibold text-faint">
                  –
                </span>
                <RangeField
                  control={form.control}
                  name={CALORIES_GROUP.max}
                  label="Calories maximum"
                  inputClassName="py-3 text-lg"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="eyebrow tracking-[0.16em]">Macros · range (g)</p>
              <div className="space-y-2.5">
                {MACRO_GROUPS.map((group) => (
                  <div key={group.label} className="flex items-center gap-3">
                    <span className="w-16 flex-none text-xs font-semibold text-subtle">
                      {group.label}
                    </span>
                    <RangeField
                      control={form.control}
                      name={group.min}
                      label={`${group.label} minimum`}
                      inputClassName="py-2.5 text-sm"
                    />
                    <span className="font-mono text-sm font-semibold text-faint">
                      –
                    </span>
                    <RangeField
                      control={form.control}
                      name={group.max}
                      label={`${group.label} maximum`}
                      inputClassName="py-2.5 text-sm"
                    />
                  </div>
                ))}
              </div>
              <p className="font-mono text-[11px] tracking-[0.04em] text-faint">
                Day-type frameworks derive from these + goal mode.
              </p>
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
          </form>
        </Form>
      </div>
      {discardDialog}
    </>
  );
}
