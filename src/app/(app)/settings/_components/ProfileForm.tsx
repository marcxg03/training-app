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
import { cn } from "@/lib/utils/cn";
import type { GoalMode } from "@/lib/methodology/nutrition";
import type { NutritionTargets } from "@/lib/nutrition/projections";
import { updateProfile } from "@/lib/settings/mutations";
import type { Profile } from "@/lib/settings/projections";
import { profileSchema, type ProfileFormValues } from "@/lib/settings/schemas";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_APP_TIMEZONE } from "@/lib/time/appDay";

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

// Full IANA list from the runtime — zero maintenance, always valid values.
const TIMEZONES: string[] = Intl.supportedValuesOf("timeZone");

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
      timezone: profile?.timezone ?? DEFAULT_APP_TIMEZONE,
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

    if (result.warning) {
      // Partial save (timezone column missing pre-migration): stay on the
      // page and show it — navigating away would hide that the timezone
      // choice was NOT persisted.
      setSubmitError(result.warning);
      form.reset({ ...values, timezone: defaultValues.timezone });
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
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to settings
        </button>

        <header className="space-y-1">
          <p className="eyebrow">Settings</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Profile
          </h1>
        </header>

        <Form {...form}>
          <form
            className="space-y-5 rounded-[var(--radius)] border border-border bg-card p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(handleSubmit)(event);
            }}
          >
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="eyebrow">Display name</FormLabel>
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
                  <FormItem className="space-y-2">
                    <FormLabel className="eyebrow">Bodyweight (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        className="font-mono tabular-nums"
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
                  <FormItem className="space-y-2">
                    <FormLabel className="eyebrow">Height (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        className="font-mono tabular-nums"
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
                <FormItem className="space-y-2">
                  <FormLabel className="eyebrow">Goal mode</FormLabel>
                  <FormControl>
                    <div className="flex gap-1.5 rounded-xl border border-border bg-input p-1.5">
                      {GOAL_MODES.map((mode) => {
                        const selected = field.value === mode.value;
                        return (
                          <button
                            key={mode.value}
                            type="button"
                            onClick={() => field.onChange(mode.value)}
                            aria-pressed={selected}
                            className={cn(
                              "flex-1 rounded-lg px-2 py-2.5 text-center font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors",
                              selected
                                ? "bg-accent text-accent-foreground"
                                : "text-subtle hover:text-foreground",
                            )}
                          >
                            {mode.label}
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Changing this suggests updated nutrition targets.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="eyebrow">Timezone</FormLabel>
                  <FormControl>
                    <select
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                      className="h-11 w-full appearance-none rounded-xl border border-border bg-input px-3.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormDescription>
                    The app&apos;s clock: decides when &ldquo;today&rdquo; rolls
                    over for workouts, meals, and charts.
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
