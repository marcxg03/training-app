import { cn } from "@/lib/utils/cn";

type SessionStateBadgeProps = {
  state: "complete" | "in_progress" | "ended_early";
};

const stateClasses: Record<SessionStateBadgeProps["state"], string> = {
  complete: "bg-success/15 text-success",
  in_progress: "bg-warning/15 text-warning",
  ended_early: "bg-warning/15 text-warning",
};

const stateLabels: Record<SessionStateBadgeProps["state"], string> = {
  complete: "Completed",
  in_progress: "In progress",
  ended_early: "Ended early",
};

export function SessionStateBadge({ state }: SessionStateBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em]",
        stateClasses[state],
      )}
    >
      {stateLabels[state]}
    </span>
  );
}
