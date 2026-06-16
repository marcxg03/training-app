"use client";

import type { UseFormReturn } from "react-hook-form";

import { type ExerciseFormValues } from "@/lib/library/schemas";
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
import { Textarea } from "@/components/ui/textarea";
import { MuscleGroupMultiSelect } from "@/app/(app)/library/_components/MuscleGroupMultiSelect";

type ExerciseFormProps = {
  form: UseFormReturn<ExerciseFormValues>;
  mode: "create" | "edit";
  submitError: string | null;
  onSubmit: (values: ExerciseFormValues) => Promise<void>;
  onCancel: () => void;
};

export function ExerciseForm({
  form,
  mode,
  submitError,
  onSubmit,
  onCancel,
}: ExerciseFormProps) {
  return (
    <Form {...form}>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit(onSubmit)(event);
        }}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="muscle_groups"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Muscle groups</FormLabel>
              <FormControl>
                <MuscleGroupMultiSelect
                  value={field.value}
                  onChange={field.onChange}
                  error={Boolean(fieldState.error)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_bodyweight"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/70 px-4 py-3">
              <div className="space-y-1">
                <FormLabel>Bodyweight movement</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Marks the exercise as bodyweight-based in list views.
                </p>
              </div>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(Boolean(checked))
                  }
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="prescribed_min"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum reps</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={Number.isNaN(field.value) ? "" : field.value}
                    inputMode="numeric"
                    type="number"
                    min={1}
                    onChange={(event) =>
                      field.onChange(event.currentTarget.valueAsNumber)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="prescribed_max"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum reps</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={Number.isNaN(field.value) ? "" : field.value}
                    inputMode="numeric"
                    type="number"
                    min={1}
                    onChange={(event) =>
                      field.onChange(event.currentTarget.valueAsNumber)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
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
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {mode === "create" ? "Create exercise" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
