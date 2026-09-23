import { PR_TYPE_STYLE, type PRType } from "@/lib/methodology/pr-colors";
import { cn } from "@/lib/utils/cn";

type PRTypeBadgeProps = {
  prType: PRType;
};

export function PRTypeBadge({ prType }: PRTypeBadgeProps) {
  const style = PR_TYPE_STYLE[prType];

  return (
    <span
      className={cn(
        "font-mono text-[9px] font-semibold uppercase tracking-[0.1em]",
        style.text,
      )}
    >
      {style.label}
    </span>
  );
}
