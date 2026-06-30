import { cn } from "@/lib/utils/cn";

type PRTypeBadgeProps = {
  prType: "weight" | "in_range_rep";
};

const badgeColors: Record<PRTypeBadgeProps["prType"], string> = {
  weight: "text-accent",
  in_range_rep: "text-success",
};

const badgeLabels: Record<PRTypeBadgeProps["prType"], string> = {
  weight: "Weight PR",
  in_range_rep: "In-Range Rep",
};

export function PRTypeBadge({ prType }: PRTypeBadgeProps) {
  return (
    <span
      className={cn(
        "font-mono text-[9px] font-semibold uppercase tracking-[0.1em]",
        badgeColors[prType],
      )}
    >
      {badgeLabels[prType]}
    </span>
  );
}
