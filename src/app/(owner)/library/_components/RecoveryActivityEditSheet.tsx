"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { RecoveryActivityForm } from "@/app/(owner)/library/_components/RecoveryActivityForm";
import { useDiscardChangesGuard } from "@/components/shared/DiscardChangesDialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createRecoveryActivity,
  updateRecoveryActivity,
} from "@/lib/library/mutations";
import { type RecoveryActivity } from "@/lib/library/projections";
import {
  recoveryActivitySchema,
  type RecoveryActivityFormValues,
} from "@/lib/library/schemas";
import { createClient } from "@/lib/supabase/client";

type RecoveryActivityEditSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  recoveryBlockId?: string;
  activity?: RecoveryActivity;
};

function getDefaultValues(
  activity?: RecoveryActivity,
): RecoveryActivityFormValues {
  return {
    own_id: activity?.activity_id,
    name: activity?.name ?? "",
    description: activity?.description ?? "",
  };
}

export function RecoveryActivityEditSheet({
  open,
  onOpenChange,
  mode,
  recoveryBlockId,
  activity,
}: RecoveryActivityEditSheetProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = useMemo(() => getDefaultValues(activity), [activity]);
  const form = useForm<RecoveryActivityFormValues>({
    resolver: zodResolver(recoveryActivitySchema),
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

  const handleSubmit = async (values: RecoveryActivityFormValues) => {
    setSubmitError(null);
    const supabase = createClient();

    const result =
      mode === "create"
        ? await createRecoveryActivity(supabase, recoveryBlockId!, {
            name: values.name,
            description: values.description,
          })
        : await updateRecoveryActivity(supabase, activity!.activity_id, {
            name: values.name,
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
                ? "Add recovery activity"
                : "Edit recovery activity"}
            </SheetTitle>
            <SheetDescription>
              Save directly to your Library and refresh the list in place.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <RecoveryActivityForm
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
