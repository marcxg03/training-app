import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type SetRole = "done" | "active" | "target";

export interface SetRowProps {
  /** Left label, e.g. "Warm-up", "Work 1". */
  label: ReactNode;
  /** The set value, e.g. "135 lbs × 8", or "—" for an unlogged target. */
  value: ReactNode;
  /** Row state: logged (done), the current set (active), or an unlogged slot (target). */
  role: SetRole;
  /** Show the inline PR badge (only meaningful on a done row). */
  pr?: boolean;
  className?: string;
}

/**
 * SetRow — one row in the logger's stacked set list. Extracted from /demo's
 * LoggerSetRow. `done` = solid card, `active` = accent border (current set),
 * `target` = dashed placeholder. A `pr` done row shows the PR badge instead of
 * the check.
 */
export function SetRow({ label, value, role, pr, className }: SetRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        role === "active"
          ? "border-accent bg-card"
          : role === "done"
            ? "border-border bg-card"
            : "border-dashed border-border bg-transparent",
        className,
      )}
    >
      <span
        className={cn(
          "w-16 text-[11px] font-semibold uppercase tracking-wider",
          role === "target" ? "text-faint" : "text-subtle",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "flex-1 text-lg tabular-nums",
          role === "target" ? "text-faint" : "font-semibold text-foreground",
        )}
      >
        {value}
      </span>
      {pr && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
          PR ▲
        </span>
      )}
      {role === "done" && !pr && <span className="text-success">✓</span>}
    </div>
  );
}
