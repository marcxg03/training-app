"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";

import { assignTraining } from "@/lib/coach/actions";
import { cn } from "@/lib/utils/cn";
import type { ClientAssignment } from "@/lib/coach/types";

type AssignTrainingFormProps = {
  clientId: string;
  clientName: string;
  assignment: ClientAssignment;
};

const DAY_LABELS: Record<string, string> = {
  mon: "MON",
  tue: "TUE",
  wed: "WED",
  thu: "THU",
  fri: "FRI",
  sat: "SAT",
  sun: "SUN",
};

/** Assign Training picker (Frame 42). Persists the chosen plan to the client
 * relationship, then returns to the client workspace. */
export function AssignTrainingForm({
  clientId,
  clientName,
  assignment,
}: AssignTrainingFormProps) {
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    assignment.selectedPlanId,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const goBack = () => router.push(`/coach/clients/${clientId}`);

  const handleAssign = () => {
    if (pending) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await assignTraining(clientId, selectedPlanId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/coach/clients/${clientId}`);
      router.refresh();
    });
  };

  return (
    <div className="-mx-6 -my-8 flex min-h-[calc(100vh-0px)] flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <button
          type="button"
          onClick={goBack}
          className="text-sm font-medium text-subtle transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <h1 className="text-sm font-semibold text-foreground">
          Assign · {clientName.split(" ")[0]}
        </h1>
        <button
          type="button"
          onClick={handleAssign}
          disabled={pending}
          className="text-sm font-bold text-accent transition-colors hover:text-accent/80 disabled:opacity-50"
        >
          Assign
        </button>
      </header>

      {error ? (
        <p className="px-6 pt-3 text-[12px] font-medium text-warning">
          {error}
        </p>
      ) : null}

      <div className="flex-1 space-y-6 px-6 py-5">
        <div className="space-y-2.5">
          <p className="eyebrow tracking-[0.16em] text-subtle">
            Plan · from your library
          </p>
          <div className="space-y-2">
            {assignment.plans.map((plan) => {
              const isSelected = plan.id === selectedPlanId;

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                    isSelected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card hover:border-accent/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2",
                      isSelected ? "border-accent" : "border-faint",
                    )}
                  >
                    {isSelected ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                    ) : null}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {plan.name}
                    </span>
                    <span
                      className={cn(
                        "eyebrow mt-0.5 block tracking-[0.06em]",
                        isSelected ? "text-accent" : "text-faint",
                      )}
                    >
                      {plan.workoutCount} workout
                      {plan.workoutCount === 1 ? "" : "s"} · {plan.trainDays}{" "}
                      train days
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-faint px-4 py-3 text-xs font-semibold text-subtle transition-colors hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Assign individual workouts instead
          </button>
        </div>

        <div className="space-y-2.5">
          <p className="eyebrow tracking-[0.16em] text-subtle">
            Weekly schedule
          </p>
          <div className="space-y-1.5">
            {assignment.schedule.map((slot) => {
              const isRest = slot.workoutName === null;

              return (
                <div key={slot.day} className="flex items-center gap-2.5">
                  <span className="w-9 flex-none font-mono text-[10px] font-semibold tracking-[0.06em] text-faint">
                    {DAY_LABELS[slot.day]}
                  </span>
                  {isRest ? (
                    <span className="flex-1 rounded-[10px] border border-dashed border-border px-3.5 py-2.5 text-xs font-medium text-faint">
                      Rest day
                    </span>
                  ) : (
                    <span className="flex flex-1 items-center justify-between rounded-[10px] border border-border bg-card px-3.5 py-2.5 text-xs font-semibold text-foreground">
                      {slot.workoutName}
                      <Check className="h-3.5 w-3.5 text-accent" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
