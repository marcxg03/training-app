"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { validateSchedule } from "@/lib/methodology/plan-schedule";
import { saveDay } from "@/lib/plan/mutations";
import type { DayEditData } from "@/lib/plan/projections";
import { daySchema, type DayFormValues } from "@/lib/plan/schemas";
import { createClient } from "@/lib/supabase/client";

type DayEditFormProps = {
  day: string;
  dayLabel: string;
  data: DayEditData;
};

const TYPE_LABEL: Record<string, string> = {
  lifting: "Lifting",
  cardio: "Cardio",
  recovery: "Recovery",
};

const TIMINGS = [
  { value: "am", label: "AM" },
  { value: "anytime", label: "Anytime" },
  { value: "pm", label: "PM" },
] as const;

export function DayEditForm({ day, dayLabel, data }: DayEditFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const initialWorkoutIds = data.workouts
    .map((w) => w.workout_id)
    .filter((id): id is string => id !== null);

  const form = useForm<DayFormValues, unknown, DayFormValues>({
    resolver: zodResolver(daySchema),
    defaultValues: {
      is_rest_day: data.is_rest_day,
      workouts: data.workouts.map((w) => ({ ...w, gym: w.gym ?? "" })),
    },
    mode: "onBlur",
  });
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "workouts",
  });
  const { discardDialog, requestConfirmation } = useDiscardChangesGuard({
    isDirty: form.formState.isDirty,
  });

  const watched = useWatch({ control: form.control });
  const validation = validateSchedule({
    isRestDay: watched.is_rest_day ?? data.is_rest_day,
    workouts: (watched.workouts ?? []).map((w, index) => ({
      workout_type: w?.workout_type ?? "lifting",
      timing: w?.timing ?? "anytime",
      display_order: index,
    })),
    otherDaysHaveRest: data.other_days_have_rest,
  });
  const blocked = validation.hardErrors.length > 0;

  const goBack = () => router.push(`/plan/${day}`);

  const handleSubmit = async (values: DayFormValues) => {
    setSubmitError(null);
    if (validation.hardErrors.length > 0) {
      return;
    }

    const currentIds = new Set(
      values.workouts
        .map((w) => w.workout_id)
        .filter((id): id is string => id !== null),
    );
    const removedWorkoutIds = initialWorkoutIds.filter(
      (id) => !currentIds.has(id),
    );

    const supabase = createClient();
    const result = await saveDay(supabase, {
      schedule_id: data.schedule_id,
      is_rest_day: values.is_rest_day,
      workouts: values.workouts,
      removed_workout_ids: removedWorkoutIds,
    });

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    form.reset(values);
    router.push(`/plan/${day}`);
    router.refresh();
  };

  const submitLabel =
    validation.softWarnings.length > 0
      ? `Save anyway — overriding ${validation.softWarnings.length} warning${
          validation.softWarnings.length === 1 ? "" : "s"
        }`
      : "Save changes";

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-6">
        <button
          type="button"
          onClick={() => requestConfirmation(goBack)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {dayLabel}
        </button>

        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Plan
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Edit {dayLabel}
          </h1>
        </header>

        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(handleSubmit)(event);
            }}
          >
            <FormField
              control={form.control}
              name="is_rest_day"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(value) =>
                          field.onChange(Boolean(value))
                        }
                      />
                    </FormControl>
                    <span className="font-medium text-foreground">
                      Rest day
                    </span>
                  </label>
                </FormItem>
              )}
            />

            <div className="space-y-3">
              {fields.map((row, index) => (
                <div
                  key={row.id}
                  className="space-y-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                      {TYPE_LABEL[row.workout_type] ?? row.workout_type}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={index === fields.length - 1}
                        onClick={() => move(index, index + 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={row.has_history}
                        onClick={() => remove(index)}
                        aria-label="Remove session"
                        title={
                          row.has_history
                            ? "This session has logged history and can't be removed"
                            : "Remove session"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name={`workouts.${index}.workout_name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Session name</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name={`workouts.${index}.timing`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timing</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIMINGS.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`workouts.${index}.gym`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gym</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="off" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {row.has_history ? (
                    <p className="text-xs text-muted-foreground">
                      Has logged history — can be edited but not removed.
                    </p>
                  ) : null}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({
                    workout_id: null,
                    workout_name: "",
                    workout_type: "lifting",
                    timing: "anytime",
                    gym: "",
                    display_order: fields.length,
                    has_history: false,
                  })
                }
              >
                Add lifting session
              </Button>
            </div>

            {blocked ? (
              <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {validation.hardErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : null}

            {!blocked && validation.softWarnings.length > 0 ? (
              <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                {validation.softWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
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
              <Button
                type="submit"
                disabled={blocked || form.formState.isSubmitting}
              >
                {submitLabel}
              </Button>
            </div>
          </form>
        </Form>
      </div>
      {discardDialog}
    </>
  );
}
