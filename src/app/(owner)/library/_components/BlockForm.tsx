"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";

import { BankComposition } from "@/app/(owner)/library/_components/BankComposition";
import { useDiscardChangesGuard } from "@/components/shared/DiscardChangesDialog";
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
import { blockDetailHref, liftingHref } from "@/lib/library/crossLinks";
import { createBlock, updateBlock } from "@/lib/library/mutations";
import type { ExerciseListItem } from "@/lib/library/projections";
import { blockSchema, type BlockFormValues } from "@/lib/library/schemas";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

const PROTOCOL_OPTIONS = [
  { value: "failure", label: "Failure" },
  { value: "mobility", label: "Mobility" },
  { value: "corrective", label: "Corrective" },
] as const;

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
    warmup_sets: initialValues?.warmup_sets ?? 1,
    working_sets: initialValues?.working_sets ?? 2,
    to_failure: initialValues?.to_failure ?? false,
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
        warmup_sets: values.warmup_sets,
        working_sets: values.working_sets,
        to_failure: values.to_failure,
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
      warmup_sets: values.warmup_sets,
      working_sets: values.working_sets,
      to_failure: values.to_failure,
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

        <div className="space-y-1">
          <p className="eyebrow">Library</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {mode === "create" ? "New Block" : "Edit Block"}
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
                name="block_name"
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
                name="block_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Set protocol</FormLabel>
                    <FormControl>
                      <div className="flex gap-1 rounded-xl border border-border bg-input p-1">
                        {PROTOCOL_OPTIONS.map((option) => {
                          const isActive = field.value === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => field.onChange(option.value)}
                              aria-pressed={isActive}
                              className={cn(
                                "flex-1 rounded-[9px] px-3 py-2.5 text-center text-xs font-semibold tracking-[0.04em] transition-colors",
                                isActive
                                  ? "bg-accent text-accent-foreground"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </FormControl>
                    <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
                      Lifting block · the bank athletes pick from at session
                      time
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="warmup_sets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warm-up sets</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={Number.isNaN(field.value) ? "" : field.value}
                          inputMode="numeric"
                          type="number"
                          min={0}
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
                  name="working_sets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Working sets</FormLabel>
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
                name="to_failure"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 cursor-default">
                        Last working set taken to failure
                      </FormLabel>
                    </div>
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
