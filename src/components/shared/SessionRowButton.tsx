"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

import type { SessionRowIconVariant } from "./SessionRow";
import { SessionRowInner } from "./sessionRowInner";

export interface SessionRowButtonProps {
  /** Primary line, e.g. a meal name. */
  title: ReactNode;
  /** Secondary line under the title. */
  subtitle?: ReactNode;
  /** Leading glyph/icon content (a character, an emoji, or an icon node). */
  icon?: ReactNode;
  /**
   * Icon treatment — same vocabulary as `SessionRow`: `plain` = bare inline
   * glyph; `badge` = recessed square (input bg); `accent` = filled accent
   * square (a meal that carries a photo). Default `plain`.
   */
  iconVariant?: SessionRowIconVariant;
  /** Override classes on the icon container (e.g. size, custom color). */
  iconClassName?: string;
  /** Right-aligned content (calories, a chevron). */
  trailing?: ReactNode;
  /** Fired when the whole row is tapped — opens a sheet IN PLACE (no nav). */
  onClick: () => void;
  /** Accessible label when the visible text is not enough on its own. */
  "aria-label"?: string;
  /**
   * Quiet styling: renders the title normal-weight `text-sm` (drops
   * `font-semibold`). Default false keeps the emphasized title.
   */
  quiet?: boolean;
  className?: string;
}

/**
 * SessionRowButton — the CLIENT, tap-in-place twin of the server-safe
 * `SessionRow`. Same visual row, rendered as a `<button onClick>` so a tap opens
 * a sheet/dialog without navigating (S3 Nutrition meal rows → edit sheet). Kept
 * as a separate component (per the S1 decision) so `SessionRow` stays a server
 * component and doesn't drag its callers across the client boundary.
 */
export function SessionRowButton({
  title,
  subtitle,
  icon,
  iconVariant = "plain",
  iconClassName,
  trailing,
  onClick,
  "aria-label": ariaLabel,
  quiet = false,
  className,
}: SessionRowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-card-alt",
        className,
      )}
    >
      <SessionRowInner
        title={title}
        subtitle={subtitle}
        icon={icon}
        iconVariant={iconVariant}
        iconClassName={iconClassName}
        trailing={trailing}
        quiet={quiet}
      />
    </button>
  );
}
