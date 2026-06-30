"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import type { ClientTargets, CoachGoalMode } from "@/lib/coach/types";

type ClientTargetsFormProps = {
  clientId: string;
  clientName: string;
  targets: ClientTargets;
};

const GOAL_MODES: { value: CoachGoalMode; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "maintain", label: "Maintain" },
  { value: "lean_bulk", label: "Lean bulk" },
];

/** A single read-styled numeric range bound. Mirrors the athlete Targets form
 * visuals but is intentionally display-only here (no backend yet). */
function RangeCell({
  value,
  label,
  large = false,
}: {
  value: number;
  label: string;
  large?: boolean;
}) {
  return (
    <input
      aria-label={label}
      defaultValue={value.toLocaleString()}
      className={cn(
        "flex-1 rounded-[10px] border border-border bg-input text-center font-mono font-semibold tabular-nums text-foreground focus-visible:border-accent focus-visible:outline-none",
        large ? "py-3 text-[17px]" : "py-2.5 text-sm",
      )}
    />
  );
}

/** Client nutrition targets (Frame 43). UI-only; "Save" returns to the client
 * workspace without persisting. */
export function ClientTargetsForm({
  clientId,
  clientName,
  targets,
}: ClientTargetsFormProps) {
  const router = useRouter();
  const [goalMode, setGoalMode] = useState<CoachGoalMode>(targets.goalMode);

  const firstName = clientName.split(" ")[0];
  const goBack = () => router.push(`/coach/clients/${clientId}`);

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
          Targets · {firstName}
        </h1>
        <button
          type="button"
          onClick={goBack}
          className="text-sm font-bold text-accent transition-colors hover:text-accent/80"
        >
          Save
        </button>
      </header>

      <div className="flex-1 space-y-6 px-6 py-5">
        <div className="flex items-center gap-2.5 rounded-xl border border-accent/30 bg-accent/[0.06] px-3.5 py-3">
          <Eye className="h-4 w-4 flex-none text-accent" />
          <p className="text-[11px] font-medium text-accent">
            {firstName} will see these targets in their Fuel tab.
          </p>
        </div>

        <div className="space-y-2">
          <p className="eyebrow tracking-[0.16em] text-subtle">Goal mode</p>
          <div className="flex gap-1.5 rounded-xl border border-border bg-input p-1.5">
            {GOAL_MODES.map((mode) => {
              const isActive = mode.value === goalMode;

              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setGoalMode(mode.value)}
                  className={cn(
                    "flex-1 rounded-lg py-2.5 text-center font-mono text-[11px] uppercase tracking-[0.04em] transition-colors",
                    isActive
                      ? "bg-accent font-bold text-black"
                      : "font-semibold text-subtle hover:text-foreground",
                  )}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="eyebrow tracking-[0.16em] text-subtle">
            Daily calories · range
          </p>
          <div className="flex items-center gap-2.5">
            <RangeCell value={targets.calMin} label="Calories minimum" large />
            <span className="font-mono text-sm font-semibold text-faint">
              –
            </span>
            <RangeCell value={targets.calMax} label="Calories maximum" large />
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="eyebrow tracking-[0.16em] text-subtle">
            Macros · range (g)
          </p>
          <div className="space-y-2.5">
            {targets.macros.map((macro) => (
              <div key={macro.label} className="flex items-center gap-3">
                <span className="w-16 flex-none text-xs font-semibold text-subtle">
                  {macro.label}
                </span>
                <RangeCell value={macro.min} label={`${macro.label} minimum`} />
                <span className="font-mono text-sm font-semibold text-faint">
                  –
                </span>
                <RangeCell value={macro.max} label={`${macro.label} maximum`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
