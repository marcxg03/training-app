"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { CardioActivityForm } from "@/app/(app)/library/_components/CardioActivityForm";
import { useDiscardChangesGuard } from "@/app/(app)/library/_components/DiscardChangesDialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createCardioActivity,
  updateCardioActivity,
} from "@/lib/library/mutations";
import { type CardioActivity } from "@/lib/library/projections";
import {
  cardioActivitySchema,
  type CardioActivityFormValues,
} from "@/lib/library/schemas";
import { createClient } from "@/lib/supabase/client";

type CardioActivityEditSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  cardioBlockId?: string;
  activity?: CardioActivity;
};

function getDefaultValues(activity?: CardioActivity): CardioActivityFormValues {
  return {
    own_id: activity?.activity_id,
    name: activity?.name ?? "",
    cardio_format: activity?.cardio_format ?? undefined,
    cardio_distance: activity?.cardio_distance ?? "",
    cardio_target_zone: activity?.cardio_target_zone ?? undefined,
    description: activity?.description ?? "",
  };
}

export function CardioActivityEditSheet({
  open,
  onOpenChange,
  mode,
  cardioBlockId,
  activity,
}: CardioActivityEditSheetProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = useMemo(() => getDefaultValues(activity), [activity]);
  const form = useForm<CardioActivityFormValues>({
    resolver: zodResolver(cardioActivitySchema),
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

  const handleSubmit = async (values: CardioActivityFormValues) => {
    setSubmitError(null);
    const supabase = createClient();
    const cardioFormat = values.cardio_format!;
    const cardioTargetZone = values.cardio_target_zone!;

    const result =
      mode === "create"
        ? await createCardioActivity(supabase, cardioBlockId!, {
            name: values.name,
            cardio_format: cardioFormat,
            cardio_distance: values.cardio_distance,
            cardio_target_zone: cardioTargetZone,
            description: values.description,
          })
        : await updateCardioActivity(supabase, activity!.activity_id, {
            name: values.name,
            cardio_format: cardioFormat,
            cardio_distance: values.cardio_distance,
            cardio_target_zone: cardioTargetZone,
            description: values.description,
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
              {mode === "create"
                ? "Add cardio activity"
                : "Edit cardio activity"}
            </SheetTitle>
            <SheetDescription>
              Save directly to your Library and refresh the list in place.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CardioActivityForm
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
