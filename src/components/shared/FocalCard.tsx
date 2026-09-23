import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface FocalCardProps {
  /** Primary title, e.g. the session name ("Upper"). */
  title: ReactNode;
  /** Secondary line under the title. */
  subtitle?: ReactNode;
  /** Small pill in the top-left, e.g. "Lift · Now". */
  badge?: ReactNode;
  /** Muted text in the top-right, e.g. "~55 min". */
  meta?: ReactNode;
  /** CTA label, e.g. "Start Workout ▸". Rendered as a Link when `actionHref` is set. */
  actionLabel?: ReactNode;
  /** Navigation target for the CTA. */
  actionHref?: string;
  /**
   * Full override of the action slot — pass your own interactive node (e.g. a
   * client button with onClick) when the CTA is not a plain navigation. Takes
   * precedence over `actionLabel`/`actionHref`.
   */
  action?: ReactNode;
  className?: string;
}

/**
 * FocalCard — the single dominant accent card on a screen (the Today Start
 * card). Extracted from /demo TodayScreen. Server-component-safe: interactive
 * CTAs pass `action` (a client node); navigation CTAs use `actionHref`.
 */
export function FocalCard({
  title,
  subtitle,
  badge,
  meta,
  actionLabel,
  actionHref,
  action,
  className,
}: FocalCardProps) {
  const cta =
    action ??
    (actionLabel != null && actionHref != null ? (
      <Link
        href={actionHref}
        className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-foreground text-sm font-bold uppercase tracking-wider text-accent"
      >
        {actionLabel}
      </Link>
    ) : null);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl bg-accent p-5 text-accent-foreground",
        className,
      )}
    >
      {(badge != null || meta != null) && (
        <div className="flex items-center justify-between">
          {badge != null ? (
            <span className="rounded-full bg-accent-foreground/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              {badge}
            </span>
          ) : (
            <span />
          )}
          {meta != null && (
            <span className="text-[11px] tabular-nums text-accent-foreground/60">
              {meta}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-bold tracking-tight">{title}</span>
        {subtitle != null && (
          <span className="text-[13px] text-accent-foreground/70">
            {subtitle}
          </span>
        )}
      </div>
      {cta}
    </div>
  );
}
