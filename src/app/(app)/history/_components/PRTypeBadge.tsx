import { cn } from "@/lib/utils/cn";

type PRTypeBadgeProps = {
  prType: "weight" | "in_range_rep";
};

const badgeVariants: Record<PRTypeBadgeProps["prType"], string> = {
  weight: "border-accent/50 bg-accent/15 text-accent",
  in_range_rep: "border-sky-400/40 bg-sky-400/10 text-sky-200",
};

const badgeLabels: Record<PRTypeBadgeProps["prType"], string> = {
  weight: "Weight PR",
  in_range_rep: "In-Range PR",
};

export function PRTypeBadge({ prType }: PRTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-[0.18em]",
        badgeVariants[prType],
      )}
    >
      {badgeLabels[prType]}
    </span>
  );
}
