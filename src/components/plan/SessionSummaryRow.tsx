import type { Enums } from "@/lib/supabase/types";

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

  return (
    <div className="rounded-xl border border-border/80 bg-background/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-[0.18em]">
              {workoutTypeLabel[workoutType]}
            </span>
            {timingLabel ? (
              <span className="text-[11px] uppercase tabular-nums tracking-[0.18em]">
                {timingLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-base font-semibold text-foreground">
            {sessionName}
          </p>
        </div>
        {gym ? (
          <span className="text-right text-xs text-muted-foreground">
            {gym}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{summary}</p>
    </div>
  );
}
