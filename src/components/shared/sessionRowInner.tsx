import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

import type { SessionRowIconVariant } from "./SessionRow";

export interface SessionRowInnerProps {
  /** Primary line, e.g. a session/meal/exercise name. */
  title: ReactNode;
  /** Secondary line under the title. */
  subtitle?: ReactNode;
  /** Leading glyph/icon content (a character, an emoji, or an icon node). */
  icon?: ReactNode;
  /** Icon treatment. Default `plain`. */
  iconVariant?: SessionRowIconVariant;
  /** Override classes on the icon container (e.g. size, custom color). */
  iconClassName?: string;
  /** Right-aligned content (calories, time, a PR badge, a chevron). */
  trailing?: ReactNode;
  /** Quiet styling: title normal-weight `text-sm` (drops `font-semibold`). */
  quiet?: boolean;
}

/**
 * SessionRowInner — the shared, presentational innards of the row (icon +
 * title/subtitle + trailing), rendered by BOTH `SessionRow` (server, wraps in
 * Link/div) and `SessionRowButton` (client, wraps in button) so the two never
 * drift. Deliberately hook- and handler-free so it stays usable from a server
 * component. Not a standalone row — the wrapper owns the flex container and
 * layout classes.
 */
export function SessionRowInner({
  title,
  subtitle,
  icon,
  iconVariant = "plain",
  iconClassName,
  trailing,
  quiet = false,
}: SessionRowInnerProps) {
  const iconNode =
    icon == null ? null : iconVariant === "plain" ? (
      <span className={cn("shrink-0", iconClassName)}>{icon}</span>
    ) : (
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs",
          iconVariant === "accent"
            ? "bg-accent text-accent-foreground"
            : "bg-input text-subtle",
          iconClassName,
        )}
      >
        {icon}
      </span>
    );

  return (
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
}
