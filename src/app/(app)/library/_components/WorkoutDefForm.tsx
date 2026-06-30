"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { BlockComposition } from "@/app/(app)/library/_components/BlockComposition";
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
import { workoutDetailHref, workoutsHref } from "@/lib/library/crossLinks";
import { createWorkoutDef, updateWorkoutDef } from "@/lib/library/mutations";
import type { LiftingBlockSummary } from "@/lib/library/projections";
import {
  workoutDefSchema,
  type WorkoutDefFormValues,
} from "@/lib/library/schemas";
import { createClient } from "@/lib/supabase/client";

type WorkoutDefFormProps = {
  mode: "create" | "edit";
  blocks: LiftingBlockSummary[];
  initialValues?: Partial<WorkoutDefFormValues>;
  workoutDefId?: string;
};

function getDefaultValues(
  mode: "create" | "edit",
  initialValues?: Partial<WorkoutDefFormValues>,
  workoutDefId?: string,
): WorkoutDefFormValues {
  return {
    own_id: mode === "edit" ? workoutDefId : undefined,
    name: initialValues?.name ?? "",
    blocks: initialValues?.blocks ?? [],
  };
}

export function WorkoutDefForm({
  mode,
  blocks,
  initialValues,
  workoutDefId,
}: WorkoutDefFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = useMemo(
    () => getDefaultValues(mode, initialValues, workoutDefId),
    [initialValues, mode, workoutDefId],
  );
  const form = useForm<WorkoutDefFormValues>({
    resolver: zodResolver(workoutDefSchema),
    defaultValues,
    mode: "onBlur",
  });
  const { discardDialog, requestConfirmation } = useDiscardChangesGuard({
    isDirty: form.formState.isDirty,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setSubmitError(null);
  }, [defaultValues, form]);

  const handleBack = () => {
    if (mode === "edit" && workoutDefId) {
      router.push(workoutDetailHref(workoutDefId));
      return;
    }
    router.push(workoutsHref());
  };

  const handleSubmit = async (values: WorkoutDefFormValues) => {
    setSubmitError(null);
    const supabase = createClient();

    if (mode === "create") {
      const result = await createWorkoutDef(supabase, {
        name: values.name,
        blocks: values.blocks,
      });

      if (!result.ok) {
        if (result.error.includes("already exists")) {
          form.setError("name", { type: "manual", message: result.error });
          return;
        }
        setSubmitError(result.error);
        return;
      }

      router.push(workoutDetailHref(result.data.workout_def_id));
      return;
    }

    const result = await updateWorkoutDef(supabase, workoutDefId!, {
      name: values.name,
      blocks: values.blocks,
    });

    if (!result.ok) {
      if (result.error.includes("already exists")) {
        form.setError("name", { type: "manual", message: result.error });
        return;
      }
      setSubmitError(result.error);
      return;
    }

    router.push(workoutDetailHref(workoutDefId!));
  };

  return (
    <>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => requestConfirmation(handleBack)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          <ArrowLeft className="h-4 w-4" />
          {mode === "edit" ? "Back to workout" : "Back to library"}
        </button>

        <div className="space-y-1">
          <p className="eyebrow">Library</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {mode === "create" ? "New Workout" : "Edit Workout"}
          </h1>
        </div>

        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(handleSubmit)(event);
            }}
          >
            <div className="space-y-5 rounded-[var(--radius)] border border-border bg-card p-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="off"
                        placeholder="Push, Upper, Lower…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <BlockComposition blocks={blocks} />

            {submitError ? (
              <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => requestConfirmation(handleBack)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting ||
                  Object.keys(form.formState.errors).length > 0
                }
              >
                {mode === "create" ? "Create workout" : "Save changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
      {discardDialog}
    </>
  );
}
