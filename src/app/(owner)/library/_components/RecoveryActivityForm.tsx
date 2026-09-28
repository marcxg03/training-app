"use client";

import type { UseFormReturn } from "react-hook-form";

import { type RecoveryActivityFormValues } from "@/lib/library/schemas";
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
import { Textarea } from "@/components/ui/textarea";

type RecoveryActivityFormProps = {
  form: UseFormReturn<RecoveryActivityFormValues>;
  mode: "create" | "edit";
  submitError: string | null;
  onSubmit: (values: RecoveryActivityFormValues) => Promise<void>;
  onCancel: () => void;
};

export function RecoveryActivityForm({
  form,
  mode,
  submitError,
  onSubmit,
  onCancel,
}: RecoveryActivityFormProps) {
  return (
    <Form {...form}>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
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
            {mode === "create" ? "Create activity" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
