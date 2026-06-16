"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { ExerciseForm } from "@/app/(app)/library/_components/ExerciseForm";
import { useDiscardChangesGuard } from "@/app/(app)/library/_components/DiscardChangesDialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createExercise, updateExercise } from "@/lib/library/mutations";
import { type ExerciseListItem } from "@/lib/library/projections";
import {
  exerciseSchema,
  isMuscleGroup,
  type ExerciseFormValues,
} from "@/lib/library/schemas";
import { createClient } from "@/lib/supabase/client";
import { getPrimaryMuscleGroupLabel } from "@/lib/methodology/muscle-groups";

type ExerciseEditSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  exercise?: ExerciseListItem;
  onCreated?: (exercise: ExerciseListItem) => void;
};

function getDefaultValues(exercise?: ExerciseListItem): ExerciseFormValues {
  return {
    own_id: exercise?.exercise_id,
    name: exercise?.name ?? "",
    muscle_groups:
      exercise?.muscle_groups.filter((group) => isMuscleGroup(group)) ?? [],
    is_bodyweight: exercise?.is_bodyweight ?? false,
    prescribed_min: exercise?.prescribed_min ?? 1,
    prescribed_max: exercise?.prescribed_max ?? 1,
    notes: exercise?.notes ?? "",
  };
}

export function ExerciseEditSheet({
  open,
  onOpenChange,
  mode,
  exercise,
  onCreated,
}: ExerciseEditSheetProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = useMemo(() => getDefaultValues(exercise), [exercise]);
  const form = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseSchema),
    defaultValues,
    mode: "onBlur",
  });
  const { discardDialog, requestConfirmation } = useDiscardChangesGuard({
    isDirty: form.formState.isDirty,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setSubmitError(null);
  }, [defaultValues, form, open]);

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

  const handleSubmit = async (values: ExerciseFormValues) => {
    setSubmitError(null);
    const supabase = createClient();

    if (mode === "create") {
      const result = await createExercise(supabase, {
        name: values.name,
        muscle_groups: values.muscle_groups,
        is_bodyweight: values.is_bodyweight,
        prescribed_min: values.prescribed_min,
        prescribed_max: values.prescribed_max,
        notes: values.notes,
      });

      if (!result.ok) {
        if (result.error.includes("already exists")) {
          form.setError("name", { type: "manual", message: result.error });
          return;
        }

        setSubmitError(result.error);
        return;
      }

      onCreated?.({
        exercise_id: result.data.exercise_id,
        name: values.name.trim(),
        muscle_groups: values.muscle_groups,
        primary_muscle_group_label: getPrimaryMuscleGroupLabel(
          values.muscle_groups,
        ),
        is_bodyweight: values.is_bodyweight,
        prescribed_min: values.prescribed_min,
        prescribed_max: values.prescribed_max,
        notes: values.notes,
      });

      router.refresh();
      closeSheet();
      return;
    }

    const result = await updateExercise(supabase, exercise!.exercise_id, {
      name: values.name,
      muscle_groups: values.muscle_groups,
      is_bodyweight: values.is_bodyweight,
      prescribed_min: values.prescribed_min,
      prescribed_max: values.prescribed_max,
      notes: values.notes,
    });

    if (!result.ok) {
      if (result.error.includes("already exists")) {
        form.setError("name", { type: "manual", message: result.error });
        return;
      }

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
            <SheetTitle>
              {mode === "create" ? "Add exercise" : "Edit exercise"}
            </SheetTitle>
            <SheetDescription>
              {mode === "create"
                ? "Create a new exercise for your Library."
                : "Update the shared exercise details everywhere they appear."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ExerciseForm
              form={form}
              mode={mode}
              submitError={submitError}
              onSubmit={handleSubmit}
              onCancel={() => requestConfirmation(closeSheet)}
            />
          </div>
        </SheetContent>
      </Sheet>
      {discardDialog}
    </>
  );
}
