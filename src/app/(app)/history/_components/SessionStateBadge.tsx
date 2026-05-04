import { cn } from "@/lib/utils/cn";

type SessionStateBadgeProps = {
  state: "complete" | "in_progress" | "ended_early";
};

const stateClasses: Record<SessionStateBadgeProps["state"], string> = {
  complete: "border-border bg-background/60 text-foreground",
  in_progress: "border-border/70 bg-background/40 text-muted-foreground",
  ended_early: "border-amber-500/40 bg-amber-500/10 text-amber-200",
};

const stateLabels: Record<SessionStateBadgeProps["state"], string> = {
  complete: "Complete",
  in_progress: "In progress",
  ended_early: "Ended early",
};

export function SessionStateBadge({ state }: SessionStateBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-[0.18em]",
        stateClasses[state],
      )}
    >
      {stateLabels[state]}
    </span>
  );
}
