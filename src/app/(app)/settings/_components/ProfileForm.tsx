"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { GoalModeRecommendationSheet } from "@/app/(app)/settings/_components/GoalModeRecommendationSheet";
import { useDiscardChangesGuard } from "@/app/(app)/library/_components/DiscardChangesDialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
import type { GoalMode } from "@/lib/methodology/nutrition";
import type { NutritionTargets } from "@/lib/nutrition/projections";
import { updateProfile } from "@/lib/settings/mutations";
import type { Profile } from "@/lib/settings/projections";
import { profileSchema, type ProfileFormValues } from "@/lib/settings/schemas";
import { createClient } from "@/lib/supabase/client";

type ProfileFormProps = {
  userId: string;
  profile: Profile | null;
  currentTargets: NutritionTargets | null;
};

const GOAL_MODES: { value: GoalMode; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "maintain", label: "Maintain" },
  { value: "lean_bulk", label: "Lean bulk" },
];

export function ProfileForm({
  userId,
  profile,
  currentTargets,
}: ProfileFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const originalGoalMode = profile?.goal_mode ?? "maintain";
  const [recommendMode, setRecommendMode] =
    useState<GoalMode>(originalGoalMode);

  const defaultValues = useMemo<ProfileFormValues>(
    () => ({
      display_name: profile?.display_name ?? "",
      bodyweight_kg: profile?.bodyweight_kg ?? null,
      height_cm: profile?.height_cm ?? null,
      goal_mode: originalGoalMode,
    }),
    [profile, originalGoalMode],
  );
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues,
    mode: "onBlur",
  });
  const { discardDialog, requestConfirmation } = useDiscardChangesGuard({
    isDirty: form.formState.isDirty,
  });

  const goBack = () => router.push("/settings");

  const handleSubmit = async (values: ProfileFormValues) => {
    setSubmitError(null);
    const supabase = createClient();
    const result = await updateProfile(supabase, userId, values);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    form.reset(values);

    if (values.goal_mode !== originalGoalMode) {
      setRecommendMode(values.goal_mode);
      setRecOpen(true);
      return;
    }

    router.push("/settings");
    router.refresh();
  };

  return (
    <>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => requestConfirmation(goBack)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to settings
        </button>

        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Settings
          </p>
          <h1 className="text-3xl font-semibold text-foreground">Profile</h1>
        </header>

        <Form {...form}>
          <form
            className="space-y-5 rounded-2xl border border-border bg-card p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(handleSubmit)(event);
            }}
          >
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" placeholder="Marcus" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="bodyweight_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bodyweight (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={field.value ?? ""}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        onChange={(event) => {
                          const next = event.currentTarget.valueAsNumber;
                          field.onChange(Number.isNaN(next) ? null : next);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="height_cm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={field.value ?? ""}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        onChange={(event) => {
                          const next = event.currentTarget.valueAsNumber;
                          field.onChange(Number.isNaN(next) ? null : next);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="goal_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal mode</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GOAL_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Changing this suggests updated nutrition targets.
                  </FormDescription>
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
              <Button
                type="button"
                variant="outline"
                onClick={() => requestConfirmation(goBack)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Save profile
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <GoalModeRecommendationSheet
        key={recommendMode}
        open={recOpen}
        onOpenChange={setRecOpen}
        userId={userId}
        newMode={recommendMode}
        currentTargets={currentTargets}
        onResolved={() => {
          router.push("/settings");
          router.refresh();
        }}
      />
      {discardDialog}
    </>
  );
}
