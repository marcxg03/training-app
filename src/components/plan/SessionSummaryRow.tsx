import { ChevronRight } from "lucide-react";

import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils/cn";

type SessionSummaryRowProps = {
  workoutType: Enums<"session_type_enum">;
  sessionName: string;
  timing: Enums<"timing_enum">;
  gym: string | null;
  summary: string;
};

const workoutTypeLabel: Record<Enums<"session_type_enum">, string> = {
  lifting: "Lift",
  cardio: "Cardio",
  recovery: "Recovery",
};

const typeChipClass: Record<Enums<"session_type_enum">, string> = {
  lifting: "bg-accent/[0.16] text-accent",
  cardio: "bg-cardio/[0.14] text-cardio",
  recovery: "bg-success/[0.14] text-success",
};

function formatTimingLabel(timing: Enums<"timing_enum">) {
  if (timing === "anytime") {
    return null;
  }

  return timing.toUpperCase();
}

export function SessionSummaryRow({
  workoutType,
  sessionName,
  timing,
  gym,
  summary,
}: SessionSummaryRowProps) {
  const timingLabel = formatTimingLabel(timing);
  const isLift = workoutType === "lifting";

  return (
    <div className="px-[18px] py-[18px]">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
            typeChipClass[workoutType],
          )}
        >
          {workoutTypeLabel[workoutType]}
        </span>
        {timingLabel ? (
          <span className="inline-flex items-center rounded-md border border-border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.12em] text-subtle">
            {timingLabel}
          </span>
        ) : null}
        {gym ? (
          <span className="ml-auto font-mono text-[11px] tracking-[0.04em] text-faint">
            {gym.toUpperCase()}
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold tracking-tight text-foreground",
              isLift ? "text-[22px]" : "text-[19px]",
            )}
          >
            {sessionName}
          </p>
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
            {summary}
          </p>
        </div>
        {isLift ? null : (
          <ChevronRight className="h-6 w-6 shrink-0 text-faint" />
        )}
      </div>
    </div>
  );
}
