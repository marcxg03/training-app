"use client";

import Link from "next/link";
import { Check, ChevronDown, Dumbbell, Users } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

type Persona = "training" | "coaching";

type PersonaSwitcherProps = {
  /** Which persona the current surface represents. */
  active: Persona;
};

const personas: {
  key: Persona;
  label: string;
  href: string;
  icon: typeof Dumbbell;
}[] = [
  { key: "training", label: "My Training", href: "/today", icon: Dumbbell },
  { key: "coaching", label: "Coaching", href: "/coach", icon: Users },
];

/** Lightweight, visual persona switcher. NOT real auth/persona state — it just
 * navigates between the athlete surface (/today) and the coach surface (/coach).
 * Replaces the static "My Training ▾" pill from Phase 1. */
export function PersonaSwitcher({ active }: PersonaSwitcherProps) {
  const current =
    personas.find((persona) => persona.key === active) ?? personas[0];
  const isCoaching = active === "coaching";

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors",
          isCoaching
            ? "border-accent bg-accent/10"
            : "border-border hover:border-accent/50",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isCoaching ? "bg-accent" : "bg-accent",
          )}
        />
        <span
          className={cn(
            "font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
            isCoaching ? "text-accent" : "text-subtle",
          )}
        >
          {current.label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-faint" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        <div className="flex flex-col">
          {personas.map((persona) => {
            const Icon = persona.icon;
            const isActive = persona.key === active;

            return (
              <Link
                key={persona.key}
                href={persona.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-card-alt",
                  isActive ? "text-foreground" : "text-subtle",
                )}
              >
                <Icon className="h-4 w-4 text-accent" />
                <span className="flex-1">{persona.label}</span>
                {isActive ? <Check className="h-4 w-4 text-accent" /> : null}
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
