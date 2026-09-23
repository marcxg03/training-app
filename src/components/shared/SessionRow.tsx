import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type SessionRowIconVariant = "plain" | "badge" | "accent";

export interface SessionRowProps {
  /** Primary line, e.g. a session/meal/exercise name. */
  title: ReactNode;
  /** Secondary line under the title. */
  subtitle?: ReactNode;
  /** Leading glyph/icon content (a character, an emoji, or an icon node). */
  icon?: ReactNode;
  /**
   * Icon treatment: `plain` = bare inline glyph (Today "Also today" rows);
   * `badge` = recessed square (input bg); `accent` = filled accent square
   * (meal-with-photo, PR marker). Default `plain`.
   */
  iconVariant?: SessionRowIconVariant;
  /** Override classes on the icon container (e.g. size, custom color). */
  iconClassName?: string;
  /** Right-aligned content (calories, time, a PR badge, a chevron). */
  trailing?: ReactNode;
  /** When set, the whole row navigates (renders a Link). */
  href?: string;
  /**
   * Quiet styling: renders the title normal-weight `text-sm` (drops
   * `font-semibold`) for the recessed Today "Also today" list. Default false
   * keeps the emphasized `font-semibold` title.
   */
  quiet?: boolean;
  className?: string;
}

/**
 * SessionRow — the general list row shared across Today ("Also today"),
 * Nutrition (meal log), and Progress (recent timeline). Extracted from /demo.
 * One row; compose rows inside a divided list container, e.g.
 * `<div className="divide-y divide-border rounded-xl border border-border bg-card">`.
 *
 * SERVER-safe: this row only navigates (`href` → Link) or renders statically
 * (`<div>`), so it stays a server component and does not drag its callers across
 * the client boundary. An in-place tap (open a sheet without navigating) — which
 * S3 (Nutrition) will need — must NOT be added here by making this client again;
 * add a SEPARATE small client component (e.g. `SessionRowButton`) in S3 instead.
 */
export function SessionRow({
  title,
  subtitle,
  icon,
  iconVariant = "plain",
  iconClassName,
  trailing,
  href,
  quiet = false,
  className,
}: SessionRowProps) {
  const iconNode =
    icon == null ? null : iconVariant === "plain" ? (
      <span className={cn("shrink-0", iconClassName)}>{icon}</span>
    ) : (
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs",
          iconVariant === "accent"
            ? "bg-accent text-accent-foreground"
            : "bg-input text-subtle",
          iconClassName,
        )}
      >
        {icon}
      </span>
    );

  const content = (
    <>
      {iconNode}
      <div className="flex flex-1 flex-col text-left">
        <span className={cn("text-sm", !quiet && "font-semibold")}>
          {title}
        </span>
        {subtitle != null && (
          <span className="text-[11px] text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {trailing != null && <div className="shrink-0">{trailing}</div>}
    </>
  );

  const rowClasses = cn("flex w-full items-center gap-3 px-4 py-3", className);

  if (href) {
    return (
      <Link href={href} className={rowClasses}>
        {content}
      </Link>
    );
  }

  return <div className={rowClasses}>{content}</div>;
}
