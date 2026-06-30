import { ArrowDown, ArrowUp, Check, type LucideIcon } from "lucide-react";

import type { RangeStatus } from "@/lib/methodology/nutrition";
import type { MacroBar } from "@/lib/nutrition/projections";
import { cn } from "@/lib/utils/cn";

const STATUS_META: Record<
  RangeStatus,
  { label: string; icon: LucideIcon; pill: string; fill: string; glow: string }
> = {
  under: {
    label: "Under",
    icon: ArrowDown,
    pill: "bg-warning/15 text-warning",
    fill: "bg-warning",
    glow: "0 0 12px rgb(var(--warning) / 0.32)",
  },
  in: {
    label: "In range",
    icon: Check,
    pill: "bg-success/15 text-success",
    fill: "bg-success",
    glow: "0 0 12px rgb(var(--success) / 0.38)",
  },
  over: {
    label: "Over",
    icon: ArrowUp,
    pill: "bg-danger/15 text-danger",
    fill: "bg-danger",
    glow: "0 0 12px rgb(var(--danger) / 0.32)",
  },
};

const fmt = (value: number) => value.toLocaleString("en-US");

/** Collapses an exact [min, max] range to a single number. */
const rangeLabel = (min: number, max: number) =>
  min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;

export function MacroProgressBar({ bar }: { bar: MacroBar }) {
  const meta = STATUS_META[bar.status];
  const StatusIcon = meta.icon;

  // Scale every band against a shared maximum so the target band and the intake
  // band are both visible and comparable. Pad by 15% headroom for over-target.
  const scale = Math.max(bar.max, bar.totalMax, 1) * 1.15;
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  const left = (value: number) => clamp((value / scale) * 100);
  const span = (min: number, max: number) => clamp(((max - min) / scale) * 100);

  const targetLeft = left(bar.min);
  const targetWidth = span(bar.min, bar.max);
  const intakeLeft = left(bar.totalMin);
  const intakeWidth = Math.max(span(bar.totalMin, bar.totalMax), 4);

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {bar.label}
        </span>
        <span
          className={cn(
            "eyebrow inline-flex items-center gap-1 rounded-md px-2 py-1 tracking-[0.1em]",
            meta.pill,
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {meta.label}
        </span>
      </div>

      <div className="relative h-3.5 rounded-full bg-input">
        {/* Target band — the acceptable window. */}
        <div
          className="absolute inset-y-0 border-x-[1.5px] border-faint bg-foreground/5"
          style={{ left: `${targetLeft}%`, width: `${targetWidth}%` }}
          aria-hidden
        />
        {/* Intake band — what's actually logged so far. */}
        <div
          className={cn("absolute -inset-y-0.5 rounded-full", meta.fill)}
          style={{
            left: `${intakeLeft}%`,
            width: `${intakeWidth}%`,
            boxShadow: meta.glow,
          }}
          aria-hidden
        />
      </div>

      <div className="mt-2 flex justify-between font-mono text-[10px] font-medium tabular-nums">
        <span className="text-subtle">
          {rangeLabel(bar.totalMin, bar.totalMax)} {bar.unit}
        </span>
        <span className="text-faint">
          target {rangeLabel(bar.min, bar.max)}
        </span>
      </div>
    </div>
  );
}
