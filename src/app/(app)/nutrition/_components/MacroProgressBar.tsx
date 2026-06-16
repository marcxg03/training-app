import type { RangeStatus } from "@/lib/methodology/nutrition";
import type { MacroBar } from "@/lib/nutrition/projections";
import { cn } from "@/lib/utils/cn";

const STATUS_META: Record<
  RangeStatus,
  { label: string; text: string; fill: string }
> = {
  under: { label: "Under", text: "text-warning", fill: "bg-warning" },
  in: { label: "On target", text: "text-success", fill: "bg-success" },
  over: { label: "Over", text: "text-danger", fill: "bg-danger" },
};

export function MacroProgressBar({ bar }: { bar: MacroBar }) {
  const meta = STATUS_META[bar.status];
  // Scale the fill against the top of the target range so "on target" reads as
  // a roughly full bar; cap at 100% so an over-target value pins the bar full.
  const fillPercent =
    bar.max > 0 ? Math.min(100, Math.round((bar.total / bar.max) * 100)) : 0;
  // Where the lower bound sits along the same scale, drawn as a target marker.
  const minPercent =
    bar.max > 0 ? Math.min(100, Math.round((bar.min / bar.max) * 100)) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">{bar.label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="text-foreground">{bar.total}</span> / {bar.min}–
          {bar.max} {bar.unit}
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", meta.fill)}
          style={{ width: `${fillPercent}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-foreground/40"
          style={{ left: `${minPercent}%` }}
          aria-hidden
        />
      </div>
      <div className={cn("text-xs font-medium", meta.text)}>{meta.label}</div>
    </div>
  );
}
