"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";

import { BankComposition } from "@/app/(app)/library/_components/BankComposition";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { blockDetailHref, liftingHref } from "@/lib/library/crossLinks";
import { createBlock, updateBlock } from "@/lib/library/mutations";
import type { ExerciseListItem } from "@/lib/library/projections";
import { blockSchema, type BlockFormValues } from "@/lib/library/schemas";
import { createClient } from "@/lib/supabase/client";

type BlockFormProps = {
  mode: "create" | "edit";
  exercises: ExerciseListItem[];
  initialValues?: Partial<BlockFormValues>;
  blockId?: string;
  historicalSetLogCount?: number;
};

function getDefaultValues(
  mode: "create" | "edit",
  initialValues?: Partial<BlockFormValues>,
  blockId?: string,
): BlockFormValues {
  return {
    own_id: mode === "edit" ? blockId : undefined,
    block_name: initialValues?.block_name ?? "",
    block_category: "lifting",
    block_type: initialValues?.block_type ?? null,
    bank: initialValues?.bank ?? [],
  };
}

export function BlockForm({
  mode,
  exercises,
  initialValues,
  blockId,
  historicalSetLogCount = 0,
}: BlockFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = useMemo(
    () => getDefaultValues(mode, initialValues, blockId),
    [blockId, initialValues, mode],
  );
  const form = useForm<BlockFormValues>({
    resolver: zodResolver(blockSchema),
    defaultValues,
    mode: "onBlur",
  });
  const blockType = useWatch({
    control: form.control,
    name: "block_type",
  });
  const originalType = initialValues?.block_type ?? null;
  const { discardDialog, requestConfirmation } = useDiscardChangesGuard({
    isDirty: form.formState.isDirty,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setSubmitError(null);
  }, [defaultValues, form]);

  const handleBack = () => {
    if (mode === "edit" && blockId) {
      router.push(blockDetailHref(blockId));
      return;
    }

    router.push(liftingHref());
  };

  const handleSubmit = async (values: BlockFormValues) => {
    setSubmitError(null);
    const supabase = createClient();
    const blockType = values.block_type!;

    if (mode === "create") {
      const result = await createBlock(supabase, {
        block_name: values.block_name,
        block_category: "lifting",
        block_type: blockType,
        bank: values.bank,
      });

      if (!result.ok) {
        if (result.error.includes("already exists")) {
          form.setError("block_name", {
            type: "manual",
            message: result.error,
          });
          return;
        }

        setSubmitError(result.error);
        return;
      }

      router.push(blockDetailHref(result.data.block_id));
      return;
    }

    const result = await updateBlock(supabase, blockId!, {
      block_name: values.block_name,
      block_type: blockType,
      bank: values.bank,
    });

    if (!result.ok) {
      if (result.error.includes("already exists")) {
        form.setError("block_name", { type: "manual", message: result.error });
        return;
      }

      setSubmitError(result.error);
      return;
    }

    router.push(blockDetailHref(blockId!));
  };

  const showHistoricalWarning =
    mode === "edit" &&
    historicalSetLogCount > 0 &&
    blockType !== null &&
    blockType !== originalType;

  return (
    <>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => requestConfirmation(handleBack)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          <ArrowLeft className="h-4 w-4" />
          {mode === "edit" ? "Back to block" : "Back to library"}
        </button>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Library
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {mode === "create" ? "Create block" : "Edit block"}
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
            <div className="space-y-5 rounded-2xl border border-border/70 bg-card/60 p-4">
              <FormField
                control={form.control}
                name="block_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Block name</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Category</p>
                <p className="text-sm text-muted-foreground">Lifting block</p>
              </div>

              <FormField
                control={form.control}
                name="block_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protocol</FormLabel>
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(value) => field.onChange(value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a protocol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="failure">Failure</SelectItem>
                        <SelectItem value="mobility">Mobility</SelectItem>
                        <SelectItem value="corrective">Corrective</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showHistoricalWarning ? (
                <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  {historicalSetLogCount} historical sets were logged under{" "}
                  {originalType ?? "this"} protocol. Changing this affects
                  future logs only.
                </p>
              ) : null}
            </div>

            <BankComposition exercises={exercises} />

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
                {mode === "create" ? "Create block" : "Save changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
      {discardDialog}
    </>
  );
}
