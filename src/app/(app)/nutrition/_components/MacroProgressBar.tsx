import type { RangeStatus } from "@/lib/methodology/nutrition";
import type { MacroBar } from "@/lib/nutrition/projections";
import { cn } from "@/lib/utils/cn";

const STATUS_META: Record<
  RangeStatus,
  { label: string; text: string; fill: string; band: string }
> = {
  under: {
    label: "Under",
    text: "text-warning",
    fill: "bg-warning",
    band: "bg-warning/30",
  },
  in: {
    label: "On target",
    text: "text-success",
    fill: "bg-success",
    band: "bg-success/30",
  },
  over: {
    label: "Over",
    text: "text-danger",
    fill: "bg-danger",
    band: "bg-danger/30",
  },
};

const pct = (value: number, scale: number) =>
  scale > 0 ? Math.min(100, Math.round((value / scale) * 100)) : 0;

export function MacroProgressBar({ bar }: { bar: MacroBar }) {
  const meta = STATUS_META[bar.status];
  // Scale against the top of the target range. Solid fill to the guaranteed
  // minimum; a lighter band extends to the upper bound (the uncertainty).
  const solidPercent = pct(bar.totalMin, bar.max);
  const bandPercent = pct(bar.totalMax, bar.max);
  const targetMinPercent = pct(bar.min, bar.max);
  const totalLabel =
    bar.totalMin === bar.totalMax
      ? `${bar.totalMin}`
      : `${bar.totalMin}–${bar.totalMax}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">{bar.label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="text-foreground">{totalLabel}</span> / {bar.min}–
          {bar.max} {bar.unit}
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("absolute left-0 top-0 h-full rounded-full", meta.band)}
          style={{ width: `${bandPercent}%` }}
          aria-hidden
        />
        <div
          className={cn("absolute left-0 top-0 h-full rounded-full", meta.fill)}
          style={{ width: `${solidPercent}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-foreground/40"
          style={{ left: `${targetMinPercent}%` }}
          aria-hidden
        />
      </div>
      <div className={cn("text-xs font-medium", meta.text)}>{meta.label}</div>
    </div>
  );
}
