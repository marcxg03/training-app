"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { activatePlan } from "@/lib/plan/plan-mutations";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

type PlanOption = { plan_id: string; name: string };

type PlanSelectorProps = {
  plans: PlanOption[];
  activePlanId: string | null;
  userId: string;
};

/**
 * PlanSelector — the mobile plan switch/load control (Slice S4, D18/D22).
 *
 * VIEWER-ONLY: it lists the user's plans and switches the ACTIVE plan (a viewer
 * action, allowed on mobile) via the EXISTING `activatePlan` mutation. It
 * deliberately carries NO create / rename / delete affordance — all plan
 * authoring is owner-only and lives on the future desktop builder (D18). The
 * active plan drives Today, so switching here re-drives Today on next render.
 *
 * Matches the /demo PlanScreen: a collapsed "Active plan · Switch ⌄" button that
 * reveals the plan list; each non-active plan gets a "Load" button, the active
 * one shows "✓ Active".
 */
export function PlanSelector({
  plans,
  activePlanId,
  userId,
}: PlanSelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeName =
    plans.find((plan) => plan.plan_id === activePlanId)?.name ?? "No plan";

  const handleLoad = async (planId: string) => {
    if (planId === activePlanId || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await activatePlan(createClient(), userId, planId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    // Re-render the server tree so the week + active marker reflect the switch
    // (and Today re-reads the now-active plan on its next render).
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* collapsed selector — tap to reveal the list */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center justify-between rounded-xl border border-accent bg-card px-4 py-3.5 text-left transition-colors hover:border-accent/70"
      >
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight text-foreground">
            {activeName}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {plans.length} {plans.length === 1 ? "plan" : "plans"} · your plans
          </span>
        </div>
        <span className="flex items-center gap-1 rounded-lg bg-input px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
          Switch
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* revealed plan list — your plans; Load switches the active plan */}
      {open ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card-alt p-2">
          {plans.map((plan) => {
            const isActive = plan.plan_id === activePlanId;
            return (
              <div
                key={plan.plan_id}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5",
                  isActive ? "bg-accent text-accent-foreground" : "bg-card",
                )}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-semibold">
                    {plan.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider",
                      isActive ? "text-accent-foreground/60" : "text-faint",
                    )}
                  >
                    {isActive ? "active" : "your plan"}
                  </span>
                </div>
                {isActive ? (
                  <span className="shrink-0 text-[11px] font-semibold">
                    ✓ Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleLoad(plan.plan_id)}
                    disabled={busy}
                    className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-subtle transition-colors hover:border-accent/60 hover:text-foreground disabled:opacity-50"
                  >
                    Load
                  </button>
                )}
              </div>
            );
          })}
          {plans.length === 0 ? (
            <p className="px-2 py-3 text-[13px] text-muted-foreground">
              No plans yet. Build one on the desktop app.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
