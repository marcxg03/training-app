"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUp, ArrowDown, GripVertical, Plus, Trash2 } from "lucide-react";
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

// New-row session types. Existing rows keep their original type (rendered as a
// read-only badge); only new rows expose this picker (slice spec §2).
const WORKOUT_TYPES = [
  { value: "lifting", label: "Lifting" },
  { value: "cardio", label: "Cardio" },
  { value: "recovery", label: "Recovery" },
] as const;

// Cardio formats — mirrors cardio_format_enum. A new cardio session requires one
// (DB CHECK: cardio ⇒ cardio_format NOT NULL).
const CARDIO_FORMATS = [
  { value: "endurance_run", label: "Endurance run" },
  { value: "speed_run", label: "Speed run" },
  { value: "basketball", label: "Basketball" },
] as const;

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
      // cardio_format is a form-only field for NEW rows; existing rows are never
      // re-inserted, so seeding null here can't overwrite a stored cardio format.
      workouts: data.workouts.map((w) => ({
        ...w,
        gym: w.gym ?? "",
        cardio_format: null,
      })),
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
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => requestConfirmation(goBack)}
            className="text-[13px] font-medium text-subtle transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <h1 className="text-sm font-semibold text-foreground">
            Edit {dayLabel}
          </h1>
          <button
            type="submit"
            form="day-edit-form"
            disabled={blocked || form.formState.isSubmitting}
            className="font-mono text-[13px] font-bold uppercase tracking-[0.03em] text-accent transition-colors hover:text-accent/80 disabled:opacity-40"
          >
            Save
          </button>
        </div>

        <Form {...form}>
          <form
            id="day-edit-form"
            className="space-y-6 pt-[18px]"
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
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-[14px] py-[13px]">
                    <span className="text-[13px] font-semibold text-foreground">
                      Rest day
                    </span>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(value) =>
                          field.onChange(Boolean(value))
                        }
                      />
                    </FormControl>
                  </label>
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <p className="eyebrow">Sessions</p>
              {fields.map((row, index) => {
                const isNew = row.workout_id === null;
                const rowType =
                  watched.workouts?.[index]?.workout_type ?? row.workout_type;
                return (
                <div
                  key={row.id}
                  className="space-y-3 rounded-xl border border-border bg-card p-[14px]"
                >
                  <div className="flex items-center gap-2.5">
                    <GripVertical
                      className="h-[18px] w-[18px] shrink-0 text-faint"
                      aria-hidden="true"
                    />
                    <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle">
                      {TYPE_LABEL[rowType] ?? rowType}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
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
                      <button
                        type="button"
                        disabled={row.has_history}
                        onClick={() => remove(index)}
                        aria-label="Remove session"
                        title={
                          row.has_history
                            ? "This session has logged history and can't be removed"
                            : "Remove session"
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-danger transition-colors hover:bg-danger/10 disabled:pointer-events-none disabled:opacity-40"
                      >
                        <Trash2 className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                  </div>

                  {isNew ? (
                    <FormField
                      control={form.control}
                      name={`workouts.${index}.workout_type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="eyebrow">Type</FormLabel>
                          <FormControl>
                            <div className="flex gap-1.5">
                              {WORKOUT_TYPES.map((t) => {
                                const active = field.value === t.value;
                                return (
                                  <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => {
                                      field.onChange(t.value);
                                      if (t.value !== "cardio") {
                                        form.setValue(
                                          `workouts.${index}.cardio_format`,
                                          null,
                                          { shouldValidate: true },
                                        );
                                      }
                                    }}
                                    aria-pressed={active}
                                    className={
                                      active
                                        ? "flex-1 rounded-lg bg-accent px-2 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-black"
                                        : "flex-1 rounded-lg border border-border px-2 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle transition-colors hover:border-faint"
                                    }
                                  >
                                    {t.label}
                                  </button>
                                );
                              })}
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ) : null}

                  {isNew && rowType === "cardio" ? (
                    <FormField
                      control={form.control}
                      name={`workouts.${index}.cardio_format`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="eyebrow">
                            Cardio format
                          </FormLabel>
                          <FormControl>
                            <div className="flex gap-1.5">
                              {CARDIO_FORMATS.map((f) => {
                                const active = field.value === f.value;
                                return (
                                  <button
                                    key={f.value}
                                    type="button"
                                    onClick={() => field.onChange(f.value)}
                                    aria-pressed={active}
                                    className={
                                      active
                                        ? "flex-1 rounded-lg bg-accent px-2 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-black"
                                        : "flex-1 rounded-lg border border-border px-2 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle transition-colors hover:border-faint"
                                    }
                                  >
                                    {f.label}
                                  </button>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}

                  <FormField
                    control={form.control}
                    name={`workouts.${index}.workout_name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="eyebrow">Session name</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`workouts.${index}.timing`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="eyebrow">Timing</FormLabel>
                        <FormControl>
                          <div className="flex gap-1.5">
                            {TIMINGS.map((t) => {
                              const active = field.value === t.value;
                              return (
                                <button
                                  key={t.value}
                                  type="button"
                                  onClick={() => field.onChange(t.value)}
                                  aria-pressed={active}
                                  className={
                                    active
                                      ? "flex-1 rounded-lg bg-accent px-2 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-black"
                                      : "flex-1 rounded-lg border border-border px-2 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle transition-colors hover:border-faint"
                                  }
                                >
                                  {t.label}
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`workouts.${index}.gym`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="eyebrow">Gym</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {row.has_history ? (
                    <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
                      Has logged history — can be edited but not removed.
                    </p>
                  ) : null}
                </div>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  append({
                    workout_id: null,
                    workout_name: "",
                    workout_type: "lifting",
                    cardio_format: null,
                    timing: "anytime",
                    gym: "",
                    display_order: fields.length,
                    has_history: false,
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3.5 text-[13px] font-semibold text-subtle transition-colors hover:border-faint hover:text-foreground"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add session
              </button>
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

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
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
