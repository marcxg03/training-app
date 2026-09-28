"use client";

import type { UseFormReturn } from "react-hook-form";

import { type CardioActivityFormValues } from "@/lib/library/schemas";
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
import { Textarea } from "@/components/ui/textarea";

type CardioActivityFormProps = {
  form: UseFormReturn<CardioActivityFormValues>;
  mode: "create" | "edit";
  submitError: string | null;
  onSubmit: (values: CardioActivityFormValues) => Promise<void>;
  onCancel: () => void;
};

const cardioFormatOptions = [
  { value: "speed_run", label: "Speed Run" },
  { value: "endurance_run", label: "Endurance Run" },
  { value: "basketball", label: "Basketball" },
] as const;

const cardioTargetZoneOptions = [
  { value: "sprint", label: "Sprint" },
  { value: "zone_2", label: "Zone 2" },
  { value: "anaerobic", label: "Anaerobic" },
  { value: "game_pace", label: "Game Pace" },
] as const;

export function CardioActivityForm({
  form,
  mode,
  submitError,
  onSubmit,
  onCancel,
}: CardioActivityFormProps) {
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
          name="cardio_format"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Format</FormLabel>
              <Select
                value={field.value ?? undefined}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a format" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {cardioFormatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
          name="cardio_distance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Distance</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cardio_target_zone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target zone</FormLabel>
              <Select
                value={field.value ?? undefined}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a zone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {cardioTargetZoneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
