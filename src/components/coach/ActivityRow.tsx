import { CalendarX, CheckCircle2, Trophy, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import type { ActivityItem, ActivityKind } from "@/lib/coach/types";

type ActivityRowProps = {
  item: ActivityItem;
};

const kindConfig: Record<
  ActivityKind,
  { icon: typeof Trophy; iconClass: string; tintClass: string }
> = {
  pr: {
    icon: Trophy,
    iconClass: "text-accent",
    tintClass: "bg-accent/15",
  },
  completed: {
    icon: CheckCircle2,
    iconClass: "text-success",
    tintClass: "bg-success/12",
  },
  missed: {
    icon: CalendarX,
    iconClass: "text-warning",
    tintClass: "bg-warning/12",
  },
  joined: {
    icon: UserPlus,
    iconClass: "text-cardio",
    tintClass: "bg-cardio/12",
  },
};

/** One chronological activity item with a kind-colored icon (Frame 46). */
export function ActivityRow({ item }: ActivityRowProps) {
  const config = kindConfig[item.kind];
  const Icon = config.icon;
  const needsAttention = item.kind === "missed";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3",
        needsAttention ? "border-warning/30" : "border-border",
      )}
    >
      <span
        className={cn(
          "flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]",
          config.tintClass,
        )}
      >
        <Icon className={cn("h-[18px] w-[18px]", config.iconClass)} />
      </span>
      <div className="flex-1">
        <p className="text-[13px] text-foreground">
          <span className="font-semibold">{item.clientName}</span> {item.label}
        </p>
        <p
          className={cn(
            "mt-0.5 font-mono text-[9px] uppercase tracking-[0.06em]",
            needsAttention ? "text-warning" : "text-faint",
          )}
        >
          {item.timeLabel}
        </p>
      </div>
    </div>
  );
}
