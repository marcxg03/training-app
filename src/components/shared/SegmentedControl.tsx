"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface SegmentedOption {
  value: string;
  label: ReactNode;
}

export interface SegmentedControlProps {
  /** Options — a plain string is used as both value and label. */
  options: Array<string | SegmentedOption>;
  /** Currently-selected value. */
  value: string;
  /**
   * Selection handler. When omitted the control renders as a static,
   * non-interactive display (segments are plain text).
   */
  onChange?: (value: string) => void;
  /** Accessible label for the control group. */
  ariaLabel?: string;
  className?: string;
}

function normalize(option: string | SegmentedOption): SegmentedOption {
  return typeof option === "string" ? { value: option, label: option } : option;
}

/**
 * SegmentedControl — the pill toggle used on Progress (Overview / By exercise /
 * History) and Community (Discover / Feed). Extracted from /demo. Client
 * component: pass `onChange` for an interactive switcher; omit it for a
 * read-only display.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  const segments = options.map(normalize);

  return (
    <div
      role={onChange ? "tablist" : undefined}
      aria-label={ariaLabel}
      className={cn(
        "flex rounded-lg bg-input p-1 text-[11px] font-semibold uppercase tracking-wider",
        className,
      )}
    >
      {segments.map((segment) => {
        const isActive = segment.value === value;
        const classes = cn(
          "flex-1 rounded-md py-1.5 text-center transition-colors",
          isActive ? "bg-card text-foreground shadow-sm" : "text-faint",
        );

        if (!onChange) {
          return (
            <span key={segment.value} className={classes}>
              {segment.label}
            </span>
          );
        }

        return (
          <button
            key={segment.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(segment.value)}
            className={classes}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
