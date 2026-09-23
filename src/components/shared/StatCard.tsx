import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface StatCardProps {
  /** The headline number/figure, e.g. "12". */
  value: ReactNode;
  /** Primary label under the value, e.g. "workouts". */
  label: ReactNode;
  /** Optional smaller line, e.g. "this month". */
  sublabel?: ReactNode;
  className?: string;
}

/**
 * StatCard — a compact centered metric tile (workouts / PRs / streak on the
 * Progress overview). Extracted from /demo ProgressScreen's stat row. Compose
 * several in a grid.
 */
export function StatCard({ value, label, sublabel, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card py-3",
        className,
      )}
    >
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
        {label}
      </span>
      {sublabel != null && (
        <span className="text-[9px] uppercase tracking-wider text-faint">
          {sublabel}
        </span>
      )}
    </div>
  );
}
