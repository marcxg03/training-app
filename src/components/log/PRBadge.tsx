import { Trophy } from "lucide-react";

import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils/cn";

type PRBadgeProps = {
  prType?: Enums<"pr_type_enum">;
};

export function PRBadge({ prType }: PRBadgeProps = {}) {
  const isRepPr = prType === "in_range_rep";

  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-md px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
        isRepPr ? "bg-success/15 text-success" : "bg-accent/[0.18] text-accent",
      )}
    >
      <Trophy className="h-3 w-3" fill="currentColor" />
      {isRepPr ? "Rep PR" : prType === "weight" ? "Weight PR" : "PR"}
    </span>
  );
}
