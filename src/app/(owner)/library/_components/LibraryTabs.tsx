"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  cardioHref,
  exercisesHref,
  liftingHref,
  recoveryHref,
  workoutsHref,
} from "@/lib/library/crossLinks";
import { cn } from "@/lib/utils/cn";

const tabs = [
  { href: liftingHref(), label: "Blocks", value: "lifting" },
  { href: workoutsHref(), label: "Workouts", value: "workouts" },
  { href: exercisesHref(), label: "Exercises", value: "exercises" },
  { href: cardioHref(), label: "Cardio", value: "cardio" },
  { href: recoveryHref(), label: "Recovery", value: "recovery" },
] as const;

// Cardio adopts the teal accent when active; every other tab stays purple.
const activeChipClass: Record<string, string> = {
  cardio: "border-cardio bg-input text-cardio",
};
const defaultActiveChipClass = "border-accent bg-input text-accent";

function getActiveValue(pathname: string) {
  if (pathname.startsWith(workoutsHref())) {
    return "workouts";
  }

  if (pathname.startsWith(exercisesHref())) {
    return "exercises";
  }

  if (pathname.startsWith(cardioHref())) {
    return "cardio";
  }

  if (pathname.startsWith(recoveryHref())) {
    return "recovery";
  }

  return "lifting";
}

export function LibraryTabs() {
  const pathname = usePathname();
  const activeValue = getActiveValue(pathname);

  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-0.5">
      {tabs.map((tab) => {
        const isActive = tab.value === activeValue;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex-none rounded-lg border px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
              isActive
                ? (activeChipClass[tab.value] ?? defaultActiveChipClass)
                : "border-border text-faint hover:text-subtle",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
